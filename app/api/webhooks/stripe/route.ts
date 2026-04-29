import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { finalizePayment, getStripeClient } from "@/lib/payments";

export async function POST(req: Request) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ ok: true, mode: "polling" });
    }

    const stripe = getStripeClient();
    const body = await req.text();
    const signature = (await headers()).get("stripe-signature");

    if (!signature) {
      return new NextResponse("Missing Stripe signature", { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown webhook error";
      return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_status === "paid") {
        await finalizePayment({
          sessionId: session.id,
          status: session.status || "complete",
          paymentStatus: session.payment_status,
          amount: session.amount_total ? session.amount_total / 100 : undefined,
          currency: session.currency || undefined,
          gateway: "stripe",
          userId: session.metadata?.user_id,
          packageId: session.metadata?.package_id,
          metadata: {
            plan: session.metadata?.plan || "pro",
          },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[STRIPE_WEBHOOK]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
