import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildHostedPaymentUrl, getPaymentPackage } from "@/lib/payments";

export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { package_id } = body;
    const paymentPackage = getPaymentPackage(package_id);

    if (!paymentPackage || paymentPackage.currency !== "bdt") {
      return NextResponse.json({ error: "Invalid BDT package" }, { status: 400 });
    }

    const hostedUrl = process.env.UDDOKTAPAY_HOSTED_URL;
    if (!hostedUrl) {
      return NextResponse.json(
        { error: "Missing UDDOKTAPAY_HOSTED_URL" },
        { status: 500 }
      );
    }

    const invoiceId = `inv_${randomUUID().replace(/-/g, "").slice(0, 10)}`;

    await db.paymentTransaction.create({
      data: {
        sessionId: invoiceId,
        userId: user.userId,
        packageId: package_id,
        amount: paymentPackage.amount,
        currency: paymentPackage.currency,
        gateway: "uddoktapay",
        paymentStatus: "initiated",
        status: "pending",
        metadata: {
          plan: paymentPackage.plan,
          invoice_id: invoiceId,
        },
      },
    });

    return NextResponse.json({
      url: buildHostedPaymentUrl(hostedUrl, invoiceId, paymentPackage.amount),
      invoice_id: invoiceId,
    });
  } catch (error) {
    console.error("[UDDOKTAPAY_CHARGE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
