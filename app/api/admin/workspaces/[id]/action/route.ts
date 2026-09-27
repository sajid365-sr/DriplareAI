import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";

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
    if (action === "adjust_credits") {
      const { amount, type, auditNote } = body;

      const numAmount = parseInt(amount, 10);
      if (isNaN(numAmount) || numAmount <= 0) {
        return NextResponse.json({ error: "Amount must be a positive integer" }, { status: 400 });
      }

      if (!auditNote || typeof auditNote !== "string" || !auditNote.trim()) {
        return NextResponse.json(
          { error: "Mandatory audit note / reason is required for credit adjustments" },
          { status: 400 }
        );
      }

      const isDeduct = type === "deduct";
      const adjustmentValue = isDeduct ? -numAmount : numAmount;

      const newBalance = Math.max(0, workspace.user.creditsBalance + adjustmentValue);

      await db.$transaction([
        db.user.update({
          where: { userId: workspace.userId },
          data: {
            creditsBalance: newBalance,
            ...(!isDeduct && { includedCredits: { increment: numAmount } }),
          },
        }),
        db.creditTransaction.create({
          data: {
            userId: workspace.userId,
            action_type: isDeduct ? "admin_deduct" : "admin_topup",
            model_tier: "manual_adjustment",
            credits_spent: isDeduct ? numAmount : -numAmount,
            metadata: {
              auditNote: auditNote.trim(),
              adminUserId: authResult.userId,
              adminEmail: authResult.user.email,
              previousBalance: workspace.user.creditsBalance,
              newBalance,
            },
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: `Successfully ${isDeduct ? "deducted" : "added"} ${numAmount} credits.`,
        newBalance,
      });
    }

    // ── ACTION 3: CHANGE SUBSCRIPTION PLAN ───────────────────────────────────
    if (action === "change_plan") {
      const { plan } = body;
      if (!["starter", "growth", "pro", "agency", "enterprise"].includes(plan?.toLowerCase())) {
        return NextResponse.json({ error: "Invalid plan type" }, { status: 400 });
      }

      const targetPlan = plan.toLowerCase();

      // Include default credits for the new plan if upgraded
      const PLAN_CREDITS: Record<string, number> = {
        starter: 500,
        growth: 5000,
        pro: 15000,
        agency: 35000,
        enterprise: 100000,
      };

      const newCredits = PLAN_CREDITS[targetPlan] ?? 500;

      await db.user.update({
        where: { userId: workspace.userId },
        data: {
          plan: targetPlan,
          includedCredits: newCredits,
          creditsBalance: { increment: newCredits },
        },
      });

      return NextResponse.json({
        success: true,
        message: `Plan changed to ${targetPlan.toUpperCase()}`,
        plan: targetPlan,
      });
    }

    // ── ACTION 4: MANUAL INVOICE / PAYMENT RECORD ───────────────────────────
    if (action === "manual_invoice") {
      const { amount, currency = "BDT", description } = body;

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return NextResponse.json({ error: "Invoice amount must be a positive number" }, { status: 400 });
      }

      const sessionId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const invoice = await db.paymentTransaction.create({
        data: {
          sessionId,
          userId: workspace.userId,
          packageId: "manual_invoice",
          amount: numAmount,
          currency,
          gateway: "manual_admin",
          paymentStatus: "completed",
          status: "paid",
          completedAt: new Date(),
          metadata: {
            description: description || "Manual Admin Invoice",
            adminUserId: authResult.userId,
            adminEmail: authResult.user.email,
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: `Manual invoice created successfully (#${invoice.id.slice(-6)})`,
        invoice,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[ADMIN_WORKSPACE_ACTION_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
