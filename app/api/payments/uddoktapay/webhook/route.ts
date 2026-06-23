import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/core/db";
import { finalizePayment } from "@/lib/services/payments";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { invoice_id, amount } = body;

    console.log("[UDDOKTAPAY_WEBHOOK]", body);

    const normalizedStatus = normalizeUddoktapayStatus(body);
    const webhookMetadata = buildUddoktapayMetadata(body);

    if (normalizedStatus === "complete") {
      await finalizePayment({
        sessionId: invoice_id,
        status: "complete",
        paymentStatus: "paid",
        amount: amount ? parseFloat(amount) : undefined,
        gateway: "uddoktapay",
        metadata: webhookMetadata,
      });
      return NextResponse.json({ message: "Success" });
    }

    if (invoice_id && (normalizedStatus === "failed" || normalizedStatus === "cancelled")) {
      const tx = await db.paymentTransaction.findUnique({
        where: { sessionId: String(invoice_id) },
      });

      if (tx) {
        const existingMetadata = isJsonObject(tx.metadata) ? tx.metadata : {};

        await db.paymentTransaction.update({
          where: { id: tx.id },
          data: {
            status: normalizedStatus,
            paymentStatus: normalizedStatus,
            metadata: {
              ...existingMetadata,
              ...webhookMetadata,
            },
          },
        });
      }

      return NextResponse.json({ message: "Status updated" });
    }

    return NextResponse.json({ message: "Ignored" });
  } catch (error) {
    console.error("[UDDOKTAPAY_WEBHOOK_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

function isJsonObject(value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
