import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAndSyncUser } from "@/lib/core/auth";
import { db } from "@/lib/core/db";

/**
 * POST /api/payments/invoice/[id]/pay
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-issued invoice-টির জন্য একটি gateway session তৈরি করে এবং payment URL
 * ফেরত দেয়।
 *
 * গুরুত্বপূর্ণ: **নতুন transaction তৈরি হয় না** — gateway-এর session id টি
 * invoice-এর নিজের `sessionId`-এর সাথে map করা হয় (`metadata.gatewaySessionId`)।
 * ফলে webhook এলে `finalizePayment()` ঠিক এই invoice row-টিই paid হিসেবে
 * চিহ্নিত করে এবং `applyPaymentGrant()` একবারই credit দেয়।
 *
 * ⚠️ অনলাইন payment শুধু **BDT** invoice-এর জন্য। USD invoice admin offline
 * (bank/cash) নিষ্পত্তি করেন — সেখানে gateway নেই, তাই 400 ফেরত যায়।
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const invoice = await db.paymentTransaction.findUnique({
      where: { id },
      select: {
        id: true,
        sessionId: true,
        userId: true,
        amount: true,
        currency: true,
        status: true,
        paymentStatus: true,
        grantedAt: true,
        invoiceNumber: true,
        metadata: true,
      },
    });

    // অন্যের invoice দেখা যাবে না — 404 দিয়ে existence গোপন রাখা হয়
    if (!invoice || invoice.userId !== user.userId) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.grantedAt || invoice.paymentStatus === "paid") {
      return NextResponse.json({ error: "Invoice already paid" }, { status: 409 });
    }

    if (invoice.status !== "awaiting_payment" || invoice.paymentStatus !== "pending") {
      return NextResponse.json(
        { error: `Invoice is not payable (status: ${invoice.status})` },
        { status: 409 }
      );
    }

    // USD (বা অন্য যেকোনো non-BDT) invoice অনলাইনে পরিশোধযোগ্য নয়
    if (invoice.currency !== "bdt") {
      return NextResponse.json(
        { error: "Online payment is not available for this invoice" },
        { status: 400 }
      );
    }

    const meta = isJsonObject(invoice.metadata) ? invoice.metadata : {};
    const description =
      typeof meta.description === "string" && meta.description
        ? meta.description
        : `Invoice ${invoice.invoiceNumber ?? invoice.id}`;

    const origin = getOrigin(_req);

    const result = await createUddoktapaySession({ invoice, user, description, origin });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // gateway session id সংরক্ষণ — webhook এই invoice-টিকে খুঁজে পাওয়ার জন্য।
    // `gateway` column ইচ্ছাকৃতভাবে "manual_admin" থাকে; payment সফল হলে
    // `finalizePayment()` সেটি প্রকৃত gateway-এ ("uddoktapay") বদলে দেয়।
    await db.paymentTransaction.update({
      where: { id: invoice.id },
      data: {
        metadata: {
          ...meta,
          gatewaySessionId: result.gatewaySessionId,
          checkoutStartedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error("[INVOICE_PAY]", error);
    const message = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── UddoktaPay (BDT invoice) ────────────────────────────────────────────────

async function createUddoktapaySession(args: {
  invoice: { id: string; sessionId: string; amount: number; invoiceNumber: string | null };
  user: { userId: string; email: string; name: string };
  description: string;
  origin: string;
}): Promise<{ url: string; gatewaySessionId: string } | { error: string }> {
  const apiKey = process.env.UDDOKTAPAY_API_KEY;
  const apiBase = process.env.UDDOKTAPAY_API_BASE || "https://sandbox.uddoktapay.com/api";

  if (!apiKey) {
    return { error: "Payment gateway is not configured" };
  }

  const localReference = `inv_${randomUUID().replace(/-/g, "").slice(0, 14)}`;

  const response = await fetch(`${apiBase.replace(/\/$/, "")}/checkout-v2`, {
    method: "POST",
    headers: {
      "RT-UDDOKTAPAY-API-KEY": apiKey,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      full_name: args.user.name || "User",
      email: args.user.email,
      amount: args.invoice.amount,
      metadata: {
        user_id: args.user.userId,
        // webhook কোন invoice-টি পরিশোধিত হয়েছে তা এই session_id দিয়ে মেলায়
        session_id: args.invoice.sessionId,
        invoice_id: args.invoice.id,
        local_reference: localReference,
      },
      redirect_url: `${args.origin}/dashboard/payment/success?gateway=uddoktapay&invoice=${args.invoice.id}`,
      cancel_url: `${args.origin}/dashboard/payment/invoice/${args.invoice.id}`,
      webhook_url: `${args.origin}/api/payments/uddoktapay/webhook`,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.payment_url) {
    console.error("[UDDOKTAPAY_INVOICE_ERROR]", data);
    return { error: data.message || "Failed to initiate payment" };
  }

  let gatewaySessionId = data.invoice_id || data.payment_id || data.id;
  if (!gatewaySessionId && data.payment_url) {
    const parts = String(data.payment_url).split("/");
    gatewaySessionId = parts[parts.length - 1];
  }

  return {
    url: String(data.payment_url),
    gatewaySessionId: String(gatewaySessionId ?? localReference),
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function getOrigin(req: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");

  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/+$/, "");

  const host = req.headers.get("host");
  const proto = host?.startsWith("localhost") ? "http" : "https";
  return host ? `${proto}://${host}` : "";
}

function isJsonObject(value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
