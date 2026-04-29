import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { finalizePayment } from "@/lib/payments";

export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { invoice_id } = body;

    if (!invoice_id) {
      return NextResponse.json({ error: "invoice_id is required" }, { status: 400 });
    }

    const tx = await db.paymentTransaction.findFirst({
      where: { sessionId: invoice_id, userId: user.userId },
    });

    if (!tx) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const apiKey = process.env.UDDOKTAPAY_API_KEY;
    const apiBase =
      process.env.UDDOKTAPAY_API_BASE || "https://sandbox.uddoktapay.com/api";

    let paid = tx.paymentStatus === "paid";

    if (!paid && apiKey) {
      try {
        const response = await fetch(`${apiBase.replace(/\/$/, "")}/verify-payment`, {
          method: "POST",
          headers: {
            "RT-UDDOKTAPAY-API-KEY": apiKey,
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({ invoice_id }),
        });

        if (response.ok) {
          const data = await response.json();
          paid =
            data?.status === "COMPLETED" || data?.payment_status === "paid";
        }
      } catch (error) {
        console.error("[UDDOKTAPAY_VERIFY_REMOTE]", error);
      }
    }

    if (paid) {
      await finalizePayment({
        sessionId: invoice_id,
        status: "complete",
        paymentStatus: "paid",
        gateway: "uddoktapay",
      });
    }

    return NextResponse.json({
      payment_status: paid ? "paid" : tx.paymentStatus || "pending",
    });
  } catch (error) {
    console.error("[UDDOKTAPAY_VERIFY]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
