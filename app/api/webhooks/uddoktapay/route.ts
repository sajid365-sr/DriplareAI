import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { finalizePayment } from "@/lib/services/payments";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const status = String(body?.status || "").toUpperCase();
    const metadata = body?.metadata || {};
    const invoiceId = body?.invoice_id || metadata?.invoice_id || metadata?.invoiceId;

    if (!invoiceId) {
      return NextResponse.json({ ok: false });
    }

    if (status === "COMPLETED") {
      const tx = await db.paymentTransaction.findUnique({
        where: { sessionId: invoiceId },
      });

      if (tx) {
        await finalizePayment({
          sessionId: invoiceId,
          status: "complete",
          paymentStatus: "paid",
          amount:
            typeof body?.amount === "string"
              ? parseFloat(body.amount)
              : typeof body?.amount === "number"
                ? body.amount
                : tx.amount,
          currency: tx.currency,
          gateway: "uddoktapay",
          userId: tx.userId,
          packageId: tx.packageId,
          metadata: {
            ...(typeof tx.metadata === "object" && tx.metadata !== null
              ? (tx.metadata as Record<string, unknown>)
              : {}),
            plan:
              metadata?.plan ||
              (typeof tx.metadata === "object" && tx.metadata !== null
                ? (tx.metadata as Record<string, unknown>).plan
                : "pro"),
          },
        });
      }
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[UDDOKTAPAY_WEBHOOK]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
