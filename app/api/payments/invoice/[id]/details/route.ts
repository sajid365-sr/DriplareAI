import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";

/**
 * GET /api/payments/invoice/[id]/details
 * ─────────────────────────────────────────────────────────────────────────────
 * Merchant-এর invoice page-এ দেখানোর জন্য JSON বিবরণ।
 *
 * PDF route (`/api/payments/invoice/[id]`) আলাদা রাখা হয়েছে — সেটি ফাইল
 * download করে, এটি ডেটা দেয়। একই route-এ দুটো behavior গুঁজে দিলে
 * caching/content-type নিয়ে বিভ্রান্তি তৈরি হয়।
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const invoice = await db.paymentTransaction.findUnique({
      where: { id },
      select: {
        id: true,
        sessionId: true,
        userId: true,
        amount: true,
        currency: true,
        gateway: true,
        paymentStatus: true,
        status: true,
        kind: true,
        invoiceNumber: true,
        failureReason: true,
        refundStatus: true,
        createdAt: true,
        completedAt: true,
        grantedAt: true,
        metadata: true,
      },
    });

    // অন্যের invoice-এর existence ফাঁস না করে 404 দেওয়া হয়
    if (!invoice || invoice.userId !== user.userId) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const meta = isJsonObject(invoice.metadata) ? invoice.metadata : {};

    return NextResponse.json({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      currency: invoice.currency,
      kind: invoice.kind,
      description:
        typeof meta.description === "string" && meta.description
          ? meta.description
          : "DRIPLARE AI Invoice",
      creditsToGrant:
        typeof meta.creditsToGrant === "number" ? meta.creditsToGrant : null,
      plan: typeof meta.plan === "string" ? meta.plan : null,
      paymentStatus: invoice.paymentStatus,
      status: invoice.status,
      gateway: invoice.gateway,
      failureReason: invoice.failureReason,
      refundStatus: invoice.refundStatus,
      createdAt: invoice.createdAt,
      completedAt: invoice.completedAt,
      // Merchant UI-তে "Pay Now" দেখানো হবে কি না — server-ই সিদ্ধান্ত নেয়,
      // যাতে client-এ নিয়ম দুবার লেখা না হয়।
      // ⚠️ অনলাইন payment শুধু BDT invoice-এ — non-BDT invoice admin offline
      // (bank/cash) নিষ্পত্তি করেন, তাই সেখানে pay button ওঠা উচিত নয়।
      isPayable:
        invoice.currency === "bdt" &&
        !invoice.grantedAt &&
        invoice.paymentStatus === "pending" &&
        invoice.status === "awaiting_payment",
    });
  } catch (error) {
    console.error("[INVOICE_DETAILS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

function isJsonObject(value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
