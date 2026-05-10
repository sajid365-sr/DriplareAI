import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPaymentPackage, getStripeClient } from "@/lib/payments";

export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { package_id, origin_url } = body;
    const paymentPackage = getPaymentPackage(package_id);

    if (!paymentPackage) {
      return NextResponse.json({ error: "Invalid package" }, { status: 400 });
    }

    if (paymentPackage.currency !== "usd") {
      return NextResponse.json(
        { error: "USD checkout only - use /uddoktapay/charge for BDT" },
        { status: 400 }
      );
    }

    const origin = String(origin_url || "").replace(/\/$/, "");
    if (!origin) {
      return NextResponse.json({ error: "origin_url is required" }, { status: 400 });
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: paymentPackage.currency,
            product_data: {
              name: paymentPackage.label,
            },
            unit_amount: Math.round(paymentPackage.amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}&gateway=stripe`,
      cancel_url: `${origin}/dashboard/payment`,
      metadata: {
        user_id: user.userId,
        package_id,
        plan: paymentPackage.plan,
      },
    });

    await db.paymentTransaction.upsert({
      where: { sessionId: session.id },
      update: {
        userId: user.userId,
        packageId: package_id,
        amount: paymentPackage.amount,
        currency: paymentPackage.currency,
        gateway: "stripe",
        paymentStatus: session.payment_status || "initiated",
        status: session.status || "pending",
        metadata: {
          plan: paymentPackage.plan,
        },
      },
      create: {
        sessionId: session.id,
        userId: user.userId,
        packageId: package_id,
        amount: paymentPackage.amount,
        currency: paymentPackage.currency,
        gateway: "stripe",
        paymentStatus: session.payment_status || "initiated",
        status: session.status || "pending",
        metadata: {
          plan: paymentPackage.plan,
        },
      },
    });

    return NextResponse.json({ url: session.url, session_id: session.id });
  } catch (error) {
    console.error("[STRIPE_CHECKOUT]", error);
    const message = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
