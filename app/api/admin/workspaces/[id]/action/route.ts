import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";
import {
  adjustUserCredits,
  setUserPlan,
  CreditAdjustmentError,
} from "@/lib/services/admin-credits";
import { createPayableInvoice } from "@/lib/services/invoices";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const body = await req.json();
    const { action } = body;

    if (!id || !action) {
      return NextResponse.json(
        { error: "Workspace ID and action type are required" },
        { status: 400 }
      );
    }

    // 1. Find Workspace & Owner
    const workspace = await db.workspace.findFirst({
      where: {
        OR: [{ id }, { workspaceId: id }],
      },
      include: {
        user: true,
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // ── ACTION 1: UPDATE WORKSPACE STATUS ───────────────────────────────────
    if (action === "update_status") {
      const { status } = body;
      if (!["active", "warning", "suspended"].includes(status)) {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      }

      await db.workspace.update({
        where: { id: workspace.id },
        data: { status },
      });

      return NextResponse.json({
        success: true,
        message: `Workspace status updated to ${status}`,
        status,
      });
    }

    // ── ACTION 2: ADJUST CREDITS WITH AUDIT NOTE ─────────────────────────────
    // `admin.add` / `admin.deduct` দুটোই এখন shared service-এ যায় — তাই
    // `/admin/billing`-এর সাথে behaviour হুবহু এক থাকে এবং deduction-টি atomic
    // হয় (আগে read → Math.max(0,…) → set ছিল, যা concurrent request-এ
    // হারিয়ে যেত)।
    if (action === "adjust_credits") {
      const { amount, type, auditNote } = body;
      const isDeduct = type === "deduct";

      try {
        const result = await adjustUserCredits({
          userId: workspace.userId,
          amount: parseInt(amount, 10),
          direction: isDeduct ? "deduct" : "add",
          reason: auditNote,
          admin: { userId: authResult.userId, email: authResult.user.email },
        });

        return NextResponse.json({
          success: true,
          message: `Successfully ${isDeduct ? "deducted" : "added"} ${result.amount} credits.`,
          newBalance: result.newBalance,
        });
      } catch (err) {
        if (err instanceof CreditAdjustmentError) {
          return NextResponse.json(
            { error: err.message, code: err.code },
            { status: err.code === "USER_NOT_FOUND" ? 404 : 400 }
          );
        }
        throw err;
      }
    }

    // ── ACTION 3: CHANGE SUBSCRIPTION PLAN ───────────────────────────────────
    // আগে এখানে stale hardcoded map ছিল (pro/agency plan সহ, যা এই প্রোডাক্টে
    // নেই) এবং credits `increment` হত (reset নয়)। এখন `plan-config.ts`
    // থেকে region-aware মান আসে এবং credit reset হয়।
    if (action === "change_plan") {
      const { plan, auditNote } = body;
      const reason =
        typeof auditNote === "string" && auditNote.trim()
          ? auditNote
          : "Plan changed by admin from workspace console";

      try {
        const result = await setUserPlan({
          userId: workspace.userId,
          plan,
          reason,
          admin: { userId: authResult.userId, email: authResult.user.email },
        });

        const paused =
          (result.pausedChatbots ?? 0) + (result.pausedIntegrations ?? 0);

        return NextResponse.json({
          success: true,
          message:
            `Plan changed to ${result.newPlan.toUpperCase()}` +
            (paused > 0 ? `. ${paused} resource(s) paused to fit the new limits.` : ""),
          plan: result.newPlan,
          direction: result.direction,
          pausedChatbots: result.pausedChatbots ?? 0,
          pausedIntegrations: result.pausedIntegrations ?? 0,
        });
      } catch (err) {
        if (err instanceof CreditAdjustmentError) {
          return NextResponse.json(
            { error: err.message, code: err.code },
            { status: err.code === "USER_NOT_FOUND" ? 404 : 400 }
          );
        }
        throw err;
      }
    }

    // ── ACTION 4: PAYABLE INVOICE ────────────────────────────────────────────
    // আগে এই action একটি "completed" transaction লিখে দিত — টাকা না এলেও
    // revenue report-এ যোগ হত, এবং merchant-কে কোনো invoice পাঠানো হত না।
    // এখন সত্যিকারের payable invoice তৈরি হয়: status `awaiting_payment`,
    // email-এ PDF + "Pay Now" link, এবং payment হলে webhook নিজেই credit দেয়।
    //
    // `credits` না দিলে invoice-টি record-only থাকে (kind: manual_invoice) —
    // অর্থাৎ credit যোগ হবে না, শুধু হিসাবের জন্য থাকবে।
    if (action === "manual_invoice") {
      const { amount, currency = "BDT", description, credits, plan } = body;

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return NextResponse.json(
          { error: "Invoice amount must be a positive number" },
          { status: 400 }
        );
      }

      const normalizedCurrency = String(currency).toLowerCase() === "usd" ? "usd" : "bdt";
      const creditAmount = credits ? parseInt(credits, 10) : 0;

      try {
        // Plan invoice — merchant-এর plan বদলে যাবে
        if (plan) {
          const result = await createPayableInvoice({
            userId: workspace.userId,
            kind: "plan",
            amount: numAmount,
            currency: normalizedCurrency,
            description: description || `${String(plan).toUpperCase()} plan`,
            plan: String(plan),
            admin: { userId: authResult.userId, email: authResult.user.email },
          });

          return NextResponse.json({
            success: true,
            message: `Invoice ${result.invoiceNumber} created and emailed to the merchant.`,
            invoice: result,
          });
        }

        // Credit invoice — payment হলে credit যোগ হবে
        if (creditAmount > 0) {
          const result = await createPayableInvoice({
            userId: workspace.userId,
            kind: "credits",
            amount: numAmount,
            currency: normalizedCurrency,
            description: description || `${creditAmount.toLocaleString()} Credit Top-up`,
            creditsToGrant: creditAmount,
            admin: { userId: authResult.userId, email: authResult.user.email },
          });

          return NextResponse.json({
            success: true,
            message: `Invoice ${result.invoiceNumber} created and emailed to the merchant.`,
            invoice: result,
          });
        }

        // Record-only — কোনো credit/plan apply হবে না
        const record = await db.paymentTransaction.create({
          data: {
            sessionId: `invoice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            userId: workspace.userId,
            packageId: "admin_invoice_record",
            amount: numAmount,
            currency: normalizedCurrency,
            gateway: "manual_admin",
            // record-only: টাকা আসেনি, তাই status `pending` — revenue-তে যোগ হবে না
            paymentStatus: "pending",
            status: "record_only",
            kind: "manual_invoice",
            metadata: {
              description: description || "Manual Admin Invoice (record only)",
              adminId: authResult.userId,
              adminEmail: authResult.user.email,
              source: "admin_invoice_record",
            },
          },
        });

        return NextResponse.json({
          success: true,
          message: `Record-only invoice saved (#${record.id.slice(-6)}). No credits were granted.`,
          invoice: { transactionId: record.id },
        });
      } catch (err) {
        if (err instanceof CreditAdjustmentError) {
          return NextResponse.json(
            { error: err.message, code: err.code },
            { status: err.code === "USER_NOT_FOUND" ? 404 : 400 }
          );
        }
        throw err;
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[ADMIN_WORKSPACE_ACTION_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
