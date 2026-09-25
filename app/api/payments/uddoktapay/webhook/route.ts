import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/core/db";
import { finalizePayment, findTransactionByGatewaySession, recordPaymentFailure } from "@/lib/services/payments";

/**
 * UddoktaPay Webhook
 * ─────────────────────────────────────────────────────────────────────────────
 * UddoktaPay নিজের invoice id দিয়ে callback করে, যা আমাদের transaction-এর
 * `sessionId`-এর সমান **নয়** যখন payment-টি admin-issued invoice থেকে আসে
 * (তখন আমাদের sessionId `invoice_xxx`, gateway-এর id আলাদা)।
 *
 * তাই `resolveOurSessionId()` তিন ধাপে মেলায়:
 *   1. gateway id সরাসরি আমাদের sessionId কি না
 *   2. webhook body-র metadata.session_id (gateway echo করলে)
 *   3. invoice pay flow-এ সংরক্ষিত `metadata.gatewaySessionId`
 *
 * ব্যর্থ/বাতিল হলে merchant-কে জানানো হয় — আগে শুধু status লেখা হত, কেউ
 * জানত না।
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { invoice_id, amount } = body;

    console.log("[UDDOKTAPAY_WEBHOOK]", body);

    const normalizedStatus = normalizeUddoktapayStatus(body);
    const webhookMetadata = buildUddoktapayMetadata(body);
    const ourSessionId = invoice_id ? await resolveOurSessionId(String(invoice_id), body) : null;

    if (normalizedStatus === "complete" && ourSessionId) {
      await finalizePayment({
        sessionId: ourSessionId,
        status: "complete",
        paymentStatus: "paid",
        amount: amount ? parseFloat(amount) : undefined,
        gateway: "uddoktapay",
        metadata: webhookMetadata,
      });
      return NextResponse.json({ message: "Success" });
    }

    if (invoice_id && (normalizedStatus === "failed" || normalizedStatus === "cancelled")) {
      // `recordPaymentFailure` নিজেই metadata merge করে লেখে (description,
      // creditsToGrant ইত্যাদি অক্ষত থাকে) — তাই এখানে আলাদা update লাগে না।
      await recordPaymentFailure({
        sessionId: ourSessionId ?? String(invoice_id),
        reason:
          normalizedStatus === "cancelled"
            ? "Payment was cancelled before completion"
            : String(body.message || body.reason || "Payment failed at UddoktaPay"),
        code: body.status ? String(body.status) : undefined,
        gateway: "uddoktapay",
      });

      return NextResponse.json({ message: "Status updated" });
    }

    return NextResponse.json({ message: "Ignored" });
  } catch (error) {
    console.error("[UDDOKTAPAY_WEBHOOK_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

/**
 * gateway-এর invoice id থেকে আমাদের transaction-এর `sessionId` বের করে।
 * কিছু না মিললে gateway id-টাই ফেরত দেওয়া হয় (পুরনো behaviour অপরিবর্তিত)।
 */
async function resolveOurSessionId(
  gatewayInvoiceId: string,
  body: Record<string, unknown>
): Promise<string> {
  const direct = await db.paymentTransaction.findUnique({
    where: { sessionId: gatewayInvoiceId },
    select: { sessionId: true },
  });
  if (direct) return direct.sessionId;

  const echoed = readNestedString(body, "metadata", "session_id");
  if (echoed) {
    const byEcho = await db.paymentTransaction.findUnique({
      where: { sessionId: echoed },
      select: { sessionId: true },
    });
    if (byEcho) return byEcho.sessionId;
  }

  const byGatewayRef = await findTransactionByGatewaySession(gatewayInvoiceId);
  return byGatewayRef?.sessionId ?? gatewayInvoiceId;
}

/** `body[group][key]` — string হলে মান, নাহলে undefined। */
function readNestedString(
  body: Record<string, unknown>,
  group: string,
  key: string
): string | undefined {
  const nested = body[group];
  if (typeof nested !== "object" || nested === null) return undefined;

  const value = (nested as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : undefined;
}

function normalizeUddoktapayStatus(data: Record<string, unknown>): "complete" | "failed" | "cancelled" | "pending" {
  const raw = String(data.status || data.payment_status || data.paymentStatus || "").toLowerCase();

  if (["completed", "complete", "paid", "success", "succeeded"].includes(raw)) {
    return "complete";
  }

  if (["failed", "failure", "declined", "error"].includes(raw)) {
    return "failed";
  }

  if (["cancelled", "canceled", "cancel"].includes(raw)) {
    return "cancelled";
  }

  return "pending";
}

function buildUddoktapayMetadata(data: Record<string, unknown>): Prisma.InputJsonObject {
  const paymentMethod =
    data.payment_method ||
    data.paymentMethod ||
    data.method ||
    data.payment_type ||
    data.paymentType;
  const transactionId =
    data.transaction_id ||
    data.transactionId ||
    data.txn_id ||
    data.bank_tran_id ||
    data.payment_id;

  return {
    ...(paymentMethod ? { payment_method: String(paymentMethod).toLowerCase() } : {}),
    ...(transactionId ? { transaction_id: String(transactionId) } : {}),
    ...(data.invoice_id ? { gateway_invoice_id: String(data.invoice_id) } : {}),
    ipn_received: true,
    webhook_status: String(data.status || data.payment_status || "pending"),
    webhook_received_at: new Date().toISOString(),
  };
}
