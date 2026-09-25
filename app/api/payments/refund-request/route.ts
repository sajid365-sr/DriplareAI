import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import { canRequestRefund } from "@/lib/domain/payment-issues";

/**
 * POST /api/payments/refund-request
 * ─────────────────────────────────────────────────────────────────────────────
 * Merchant-এর পক্ষ থেকে refund চাওয়ার একমাত্র পথ। অনুরোধটি
 * `RefundRequest`-এ জমা হয় এবং `/admin/billing`-এর **Payment Issues** tab-এ
 * admin-এর queue-তে ওঠে।
 *
 * ⚠️ এখানে কোনো টাকা ফেরত যায় না — gateway refund শুধু admin-ই করতে পারেন
 * (এখন সব gateway-এ manual record — `supportsAutomaticRefund()` দেখুন)। এটি
 * ইচ্ছাকৃত: refund একটি আর্থিক সিদ্ধান্ত, তাই merchant এক click-এ টাকা ফেরত
 * নিতে পারবে না।
 */
const RefundRequestSchema = z.object({
  transactionId: z.string().min(1),
  reason: z.string().min(10, "Please describe the issue (at least 10 characters)"),
  /** না দিলে সম্পূর্ণ amount চাওয়া বোঝায়। */
  amountRequested: z.number().positive().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = RefundRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { transactionId, reason, amountRequested } = parsed.data;

    const transaction = await db.paymentTransaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        userId: true,
        amount: true,
        currency: true,
        invoiceNumber: true,
        paymentStatus: true,
        refundStatus: true,
      },
    });

    if (!transaction || transaction.userId !== user.userId) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (!canRequestRefund(transaction)) {
      // ইতিমধ্যে request আছে কি না আলাদা করে জানানো হয়, যাতে UI সঠিক বার্তা দেয়
      const existing = await db.refundRequest.findFirst({
        where: { transactionId, status: "pending" },
        select: { id: true },
      });

      return NextResponse.json(
        {
          error: existing
            ? "A refund request is already pending for this payment"
            : "This payment is not eligible for a refund request",
          code: existing ? "ALREADY_REQUESTED" : "NOT_ELIGIBLE",
        },
        { status: 409 }
      );
    }

    if (amountRequested && amountRequested > transaction.amount) {
      return NextResponse.json(
        { error: "Requested amount exceeds the paid amount" },
        { status: 400 }
      );
    }

    const request = await db.$transaction(async (tx) => {
      const created = await tx.refundRequest.create({
        data: {
          transactionId: transaction.id,
          userId: user.userId,
          reason,
          amountRequested: amountRequested ?? null,
          status: "pending",
        },
        select: { id: true, status: true, createdAt: true },
      });

      // Transaction-এ ইঙ্গিত রাখা হয় যাতে history/admin list-এ দেখা যায়
      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: { refundStatus: "requested" },
      });

      return created;
    });

    await notifyAdmins({
      merchantName: user.name || user.email,
      merchantEmail: user.email,
      amount: amountRequested ?? transaction.amount,
      currency: transaction.currency,
      invoiceNumber: transaction.invoiceNumber,
      reason,
    });

    return NextResponse.json({ success: true, request });
  } catch (error) {
    console.error("[REFUND_REQUEST_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

/** Admin-দের in-app notification — যাতে queue দ্রুত চোখে পড়ে। */
async function notifyAdmins(args: {
  merchantName: string;
  merchantEmail: string;
  amount: number;
  currency: string;
  invoiceNumber: string | null;
  reason: string;
}): Promise<void> {
  try {
    const admins = await db.user.findMany({
      where: { role: { in: ["admin", "super_admin"] } },
      select: { userId: true },
    });

    if (admins.length === 0) return;

    const amountLabel = `${args.currency.toUpperCase()} ${args.amount.toLocaleString()}`;

    await db.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.userId,
        type: "payment",
        title: "New Refund Request",
        message: `${args.merchantName} (${args.merchantEmail}) requested a refund of ${amountLabel}${
          args.invoiceNumber ? ` for ${args.invoiceNumber}` : ""
        }. Reason: ${args.reason}`,
      })),
    });
  } catch (err) {
    // Notification ব্যর্থ হলেও অনুরোধটি জমা থাকবে — admin queue-তে দেখতে পাবেন
    console.error("[REFUND_REQUEST_NOTIFY_ERROR]", err);
  }
}
