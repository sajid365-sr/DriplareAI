import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const invoiceId =
      searchParams.get("invoice_id") ||
      searchParams.get("invoice") ||
      searchParams.get("payment_id");
    const reference = searchParams.get("reference") || searchParams.get("local_reference");
    const { userId } = await auth();

    if (!invoiceId && !reference && !userId) {
      return NextResponse.redirect(new URL("/dashboard/payment/history", req.url));
    }

    const ownershipFilter = userId ? { userId } : {};
    const identifierFilters: Prisma.PaymentTransactionWhereInput[] = [];

    if (invoiceId) {
      identifierFilters.push(
        { sessionId: invoiceId },
        { metadata: { path: ["invoice_id"], equals: invoiceId } },
        { metadata: { path: ["gateway_invoice_id"], equals: invoiceId } }
      );
    }

    if (reference) {
      identifierFilters.push({ metadata: { path: ["local_reference"], equals: reference } });
    }

    const tx =
      identifierFilters.length > 0
        ? await db.paymentTransaction.findFirst({
            where: {
              ...ownershipFilter,
              OR: identifierFilters,
            },
            orderBy: { createdAt: "desc" },
          })
        : await db.paymentTransaction.findFirst({
            where: {
              ...ownershipFilter,
              status: "pending",
            },
            orderBy: { createdAt: "desc" },
          });

    if (tx && (tx.status === "pending" || tx.paymentStatus === "initiated")) {
      const metadata = isJsonObject(tx.metadata) ? tx.metadata : {};

      await db.paymentTransaction.update({
        where: { id: tx.id },
        data: {
          status: "cancelled",
          paymentStatus: "cancelled",
          metadata: {
            ...metadata,
            cancel_reference: reference || invoiceId || tx.sessionId,
            cancelled_at: new Date().toISOString(),
          },
        },
      });
    }

    return NextResponse.redirect(
      new URL("/dashboard/payment/history?cancelled=true", req.url)
    );
  } catch (error) {
    console.error("[UDDOKTAPAY_CANCEL_ROUTE_ERROR]", error);
    return NextResponse.redirect(new URL("/dashboard/payment/history", req.url));
  }
}

function isJsonObject(value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
