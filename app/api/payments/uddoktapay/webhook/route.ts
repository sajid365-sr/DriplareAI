import { NextResponse } from "next/server";
import { finalizePayment } from "@/lib/services/payments";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { status, invoice_id, amount, transaction_id } = body;

    console.log("[UDDOKTAPAY_WEBHOOK]", body);

    if (status === "COMPLETED") {
      await finalizePayment({
        sessionId: invoice_id,
        status: "complete",
        paymentStatus: "paid",
        amount: parseFloat(amount),
        gateway: "uddoktapay",
        metadata: {
          transaction_id,
          ipn_received: true,
        },
      });
      return NextResponse.json({ message: "Success" });
    }

    return NextResponse.json({ message: "Ignored" });
  } catch (error) {
    console.error("[UDDOKTAPAY_WEBHOOK_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
