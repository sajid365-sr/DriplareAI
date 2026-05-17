import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { buildHostedPaymentUrl, getPaymentPackage } from "@/lib/services/payments";

export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { package_id, origin_url } = body;
    const paymentPackage = getPaymentPackage(package_id);

    if (!paymentPackage || paymentPackage.currency !== "bdt") {
      return NextResponse.json({ error: "Invalid BDT package" }, { status: 400 });
    }

    const apiKey = process.env.UDDOKTAPAY_API_KEY;
    const apiBase = process.env.UDDOKTAPAY_API_BASE || "https://sandbox.uddoktapay.com/api";

    if (!apiKey) {
      return NextResponse.json({ error: "Missing UDDOKTAPAY_API_KEY" }, { status: 500 });
    }

    const origin = String(origin_url || "").replace(/\/$/, "");
    if (!origin) {
      return NextResponse.json({ error: "origin_url is required" }, { status: 400 });
    }


    // Call Uddoktapay Checkout API
    const response = await fetch(`${apiBase.replace(/\/$/, "")}/checkout-v2`, {
      method: "POST",
      headers: {
        "RT-UDDOKTAPAY-API-KEY": apiKey,
        "accept": "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        full_name: user.name || "User",
        email: user.email,
        amount: paymentPackage.amount,
        metadata: {
          user_id: user.userId,
          package_id: package_id,
          plan: paymentPackage.plan,
        },
        redirect_url: `${origin}/dashboard/payment/success?gateway=uddoktapay`,
        cancel_url: `${origin}/dashboard/payment`,
        webhook_url: `${origin}/api/payments/uddoktapay/webhook`,
      }),
    });

    const data = await response.json();
    console.log("[UDDOKTAPAY_API_RESPONSE]", data);

    if (!response.ok || !data.payment_url) {
      console.error("[UDDOKTAPAY_API_ERROR]", data);
      throw new Error(data.message || "Failed to initiate payment with Uddoktapay");
    }

    // Uddoktapay generates its own id. Fallback to various common field names.
    let invoiceId = data.invoice_id || data.payment_id || data.id;

    // If still missing, try to extract from payment_url
    if (!invoiceId && data.payment_url) {
      const parts = data.payment_url.split("/");
      invoiceId = parts[parts.length - 1];
    }

    invoiceId = String(invoiceId || `inv_${randomUUID().replace(/-/g, "").slice(0, 10)}`);

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
          raw_response: data,
        },
      },
    });

    // We manually append the invoice_id to the payment_url's redirect logic if possible, 
    // but since we can't change the remote URL, we will ensure our Success Page 
    // can fallback to the latest pending transaction if ID is missing, 
    // OR we can try to use a middle-man redirect.
    
    // Actually, the best way is to return the invoice_id to the frontend 
    // so it can be stored in localStorage/state if needed, 
    // but for now, let's just return the URL.
    
    return NextResponse.json({
      url: data.payment_url,
      invoice_id: invoiceId,
    });
  } catch (error) {
    console.error("[UDDOKTAPAY_CHARGE]", error);
    const message = error instanceof Error ? error.message : "Internal Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
