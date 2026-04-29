import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { finalizePayment, getStripeClient } from "@/lib/payments";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    void req;
    const user = await getAndSyncUser();
    const { sessionId } = await params;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tx = await db.paymentTransaction.findFirst({
      where: { sessionId, userId: user.userId },
    });

    if (!tx) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      await finalizePayment({
        sessionId,
        status: session.status || "complete",
        paymentStatus: session.payment_status,
        amount: session.amount_total ? session.amount_total / 100 : tx.amount,
        currency: session.currency || tx.currency,
        gateway: "stripe",
      });
    } else {
      await db.paymentTransaction.update({
        where: { sessionId },
        data: {
          paymentStatus: session.payment_status || tx.paymentStatus,
          status: session.status || tx.status,
        },
      });
    }

    return NextResponse.json({
      payment_status: session.payment_status,
      status: session.status,
      amount_total: session.amount_total,
      currency: session.currency,
    });
  } catch (error) {
    console.error("[STRIPE_STATUS]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
