import { NextResponse } from "next/server";
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
          paid = data?.status === "COMPLETED" || data?.payment_status === "paid";
        }
      } catch (error) {
        console.error("[UDDOKTAPAY_VERIFY_REMOTE_ERROR]", error);
      }
    }

    let planName = tx.metadata && (tx.metadata as any).plan ? (tx.metadata as any).plan : "pro";

    if (paid) {
      const result = await finalizePayment({
        sessionId: invoice_id,
        status: "complete",
        paymentStatus: "paid",
        gateway: "uddoktapay",
      });
      if (result.plan) planName = result.plan;
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
