import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAndSyncUser } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { finalizePayment } from "@/lib/services/payments";

export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();
    const body = await req.json().catch(() => ({}));
    let { invoice_id } = body;

    let tx = null;

    if (invoice_id) {
      tx = await db.paymentTransaction.findFirst({
        where: { 
          sessionId: invoice_id,
          ...(user ? { userId: user.userId } : {})
        },
      });
    } else if (user) {
      // Fallback: Find the latest pending transaction for this user
      tx = await db.paymentTransaction.findFirst({
        where: { userId: user.userId, status: "pending" },
        orderBy: { createdAt: "desc" },
      });
      if (tx) invoice_id = tx.sessionId;
    }

    if (!tx || !invoice_id) {
      console.warn("[UDDOKTAPAY_VERIFY] Transaction not found or user mismatch. ID:", invoice_id);
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const apiKey = process.env.UDDOKTAPAY_API_KEY;
    const apiBase =
      process.env.UDDOKTAPAY_API_BASE || "https://sandbox.uddoktapay.com/api";

    let paid = tx.paymentStatus === "paid";
    let remoteMetadata: Prisma.InputJsonObject = {};
    let terminalStatus: "failed" | "cancelled" | null = null;

    // --- DEVELOPMENT BYPASS ---
    // Since Sandbox doesn't return invoice_id and Webhooks don't work on localhost,
    // we bypass the actual API check during local development to test the UI flow.
    if (!paid && process.env.NODE_ENV === "development" && apiBase.includes("sandbox")) {
      console.log("[UDDOKTAPAY_DEV_BYPASS] Bypassing remote verification for local testing.");
      paid = true;
    }

    if (!paid && apiKey) {
      try {
        const verifyUrl = `${apiBase.replace(/\/$/, "")}/verify-payment`;
        console.log("[UDDOKTAPAY_VERIFY_REMOTE] Checking:", verifyUrl, invoice_id);

        const response = await fetch(verifyUrl, {
          method: "POST",
          headers: {
            "RT-UDDOKTAPAY-API-KEY": apiKey,
            "accept": "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({ invoice_id }),
        });

        const data = await response.json();
        console.log("[UDDOKTAPAY_VERIFY_REMOTE] Response:", data);

        if (response.ok) {
          const normalizedStatus = normalizeUddoktapayStatus(data);
          remoteMetadata = buildUddoktapayMetadata(data);
          paid = normalizedStatus === "complete";

          if (normalizedStatus === "failed" || normalizedStatus === "cancelled") {
            terminalStatus = normalizedStatus;
          }
        }
      } catch (error) {
        console.error("[UDDOKTAPAY_VERIFY_REMOTE_ERROR]", error);
      }
    }

    const txMetadata = isJsonObject(tx.metadata) ? tx.metadata : {};
    let planName = typeof txMetadata.plan === "string" ? txMetadata.plan : "pro";

    if (terminalStatus) {
      await db.paymentTransaction.update({
        where: { id: tx.id },
        data: {
          status: terminalStatus,
          paymentStatus: terminalStatus,
          metadata: {
            ...txMetadata,
            ...remoteMetadata,
          },
        },
      });

      return NextResponse.json({
        payment_status: terminalStatus,
        plan: planName,
      });
    }

    if (paid) {
      const result = await finalizePayment({
        sessionId: invoice_id,
        status: "complete",
        paymentStatus: "paid",
        gateway: "uddoktapay",
        metadata: remoteMetadata,
      });
      if (result.plan) planName = result.plan;
    } else if (Object.keys(remoteMetadata).length > 0) {
      await db.paymentTransaction.update({
        where: { id: tx.id },
        data: {
          metadata: {
            ...txMetadata,
            ...remoteMetadata,
          },
        },
      });
    }

    return NextResponse.json({
      payment_status: paid ? "paid" : tx.paymentStatus || "pending",
      plan: planName,
    });
  } catch (error) {
    console.error("[UDDOKTAPAY_VERIFY]", error);
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
    verify_status: String(data.status || data.payment_status || "pending"),
    verified_at: new Date().toISOString(),
  };
}
