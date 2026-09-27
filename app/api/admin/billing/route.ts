import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";
import {
  adjustUserCredits,
  CreditAdjustmentError,
} from "@/lib/services/admin-credits";
import {
  createPayableInvoice,
  markInvoicePaid,
  voidInvoice,
} from "@/lib/services/invoices";
import {
  listPaymentIssues,
  supportsAutomaticRefund,
} from "@/lib/domain/payment-issues";
import { notifyRefundUpdate } from "@/lib/services/payments";
import { z } from "zod";

// ─── Helper: parse pagination params ──────────────────────────────────────────
function parsePagination(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/** Service-layer error → HTTP status mapping। */
function errorResponse(error: unknown, tag: string) {
  if (error instanceof CreditAdjustmentError) {
    const status =
      error.code === "USER_NOT_FOUND" ? 404 : error.code === "INSUFFICIENT_BALANCE" ? 409 : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  console.error(`[${tag}]`, error);
  return NextResponse.json({ error: "Internal Error" }, { status: 500 });
}

// ─── GET /api/admin/billing ────────────────────────────────────────────────────
// Query params:
//   ?type=overview          → aggregate stat cards
//   ?type=payments          → paginated PaymentTransaction list
//   ?type=credits           → paginated CreditTransaction list (+ optional &actionType=)
//   ?type=ai_usage          → paginated AIUsageLog list
//   ?type=issues            → failed / duplicate / refund / dispute queue (+ optional &userId=)
export async function GET(req: Request) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? "overview";

    // ── Overview metrics ────────────────────────────────────────────────────
    if (type === "overview") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        totalRevenueAgg,
        mrrAgg,
        totalCreditsAgg,
        activePaidSubs,
        recentPayments,
      ] = await Promise.all([
        // Total revenue (all completed payments)
        db.paymentTransaction.aggregate({
          _sum: { amount: true },
          where: { paymentStatus: "completed" },
        }),
        // MRR: last 30 days completed payments
        db.paymentTransaction.aggregate({
          _sum: { amount: true },
          where: {
            paymentStatus: "completed",
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        // Credits issued by admin (goodwill/compensation) — শুধু admin_topup
        // ledger entry গুলো, এবং `Math.abs()` কারণ grant ঋণাত্মকভাবে লেখা হয়।
        // আগে সব `credits_spent` যোগ করা হত, ফলে grant বাড়লে metric **কমে** যেত
        // (deduction ধনাত্মক, grant ঋণাত্মক) — অর্থহীন সংখ্যা।
        db.creditTransaction.aggregate({
          _sum: { credits_spent: true },
          where: { action_type: "admin_topup" },
        }),
        // Active paid subscriptions (users NOT on starter plan)
        db.user.count({
          where: { plan: { not: "starter" } },
        }),
        // Recent 5 payments for quick preview
        db.paymentTransaction.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          where: { paymentStatus: "completed" },
          select: {
            id: true,
            amount: true,
            currency: true,
            gateway: true,
            paymentStatus: true,
            createdAt: true,
            user: { select: { name: true, email: true } },
          },
        }),
      ]);

      return NextResponse.json({
        totalRevenue: totalRevenueAgg._sum.amount ?? 0,
        mrr: mrrAgg._sum.amount ?? 0,
        totalCreditsDistributed: Math.abs(totalCreditsAgg._sum.credits_spent ?? 0),
        activePaidSubscriptions: activePaidSubs,
        recentPayments,
      });
    }

    // ── Payment transactions (paginated) ────────────────────────────────────
    if (type === "payments") {
      const { page, limit, skip } = parsePagination(url);
      const status = url.searchParams.get("status") ?? "";

      const where = status ? { paymentStatus: status } : {};

      const [transactions, total] = await Promise.all([
        db.paymentTransaction.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            sessionId: true,
            amount: true,
            currency: true,
            gateway: true,
            paymentStatus: true,
            status: true,
            packageId: true,
            createdAt: true,
            completedAt: true,
            user: {
              select: { name: true, email: true, picture: true, userId: true },
            },
          },
        }),
        db.paymentTransaction.count({ where }),
      ]);

      return NextResponse.json({
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    // ── Credit transactions (paginated, filterable by action type) ──────────
    if (type === "credits") {
      const { page, limit, skip } = parsePagination(url);
      const actionType = url.searchParams.get("actionType") ?? "";

      const where = actionType ? { action_type: actionType } : {};

      const [credits, total] = await Promise.all([
        db.creditTransaction.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            action_type: true,
            model_tier: true,
            credits_spent: true,
            chatbotId: true,
            metadata: true,
            createdAt: true,
            user: {
              select: { name: true, email: true, picture: true, userId: true },
            },
          },
        }),
        db.creditTransaction.count({ where }),
      ]);

      return NextResponse.json({
        credits,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    // ── AI Usage logs (paginated) ───────────────────────────────────────────
    if (type === "ai_usage") {
      const { page, limit, skip } = parsePagination(url);

      const [logs, total] = await Promise.all([
        db.aIUsageLog.findMany({
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            chatbotId: true,
            sessionId: true,
            channel: true,
            model: true,
            modelId: true,
            promptTokens: true,
            completionTokens: true,
            totalTokens: true,
            costUsd: true,
            costBdt: true,
            creditsDeducted: true,
            isFreeMessage: true,
            createdAt: true,
            user: {
              select: { name: true, email: true, picture: true, userId: true },
            },
          },
        }),
        db.aIUsageLog.count(),
      ]);

      return NextResponse.json({
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    // ── Payment issues queue ────────────────────────────────────────────────
    // failed / duplicate / refund-requested / disputed — সব এক জায়গায়।
    if (type === "issues") {
      const userId = url.searchParams.get("userId") ?? undefined;
      const issues = await listPaymentIssues({ userId });

      return NextResponse.json({
        issues,
        total: issues.length,
        // কোন gateway স্বয়ংক্রিয় refund সমর্থন করে তা UI-কে জানিয়ে দেওয়া হয়,
        // যাতে "Refund" button-এর পাশে সঠিক প্রত্যাশা দেখানো যায়।
        gatewayCapabilities: {
          uddoktapay: supportsAutomaticRefund("uddoktapay"),
        },
      });
    }

    return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
  } catch (error) {
    console.error("[ADMIN_BILLING_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// ─── POST /api/admin/billing ───────────────────────────────────────────────────
// একটি `action` discriminator দিয়ে সব admin billing action এখানেই আসে —
// workspace action route-এর pattern অনুসরণ করে, যাতে আলাদা route ছড়িয়ে না পড়ে।
//
//   action ছাড়া / "grant_credits" → manual credit grant (backward compatible)
//   "create_invoice"               → payable invoice তৈরি + merchant-কে email
//   "mark_invoice_paid"            → gateway-এর বাইরে টাকা পেলে invoice নিষ্পত্তি
//   "void_invoice"                 → invoice বাতিল
//   "refund"                       → refund (record only — টাকা gateway-এর বাইরে ফেরত)
//   "mark_duplicate"               → duplicate হিসেবে চিহ্নিত + admin note
//   "retry_payment"                → merchant-কে আবার payment link email
//   "resolve_issue"                → issue নিষ্পত্তি (dismiss) হিসেবে চিহ্নিত
//   "resolve_request"              → merchant-এর refund request approve/reject
//
// প্রকৃত balance/plan পরিবর্তন কখনো এখানে হয় না — সব
// `lib/services/admin-credits.ts` ও `lib/services/invoices.ts`-এ, যাতে
// workspace page ও billing page-এর behaviour কখনো আলাদা হয়ে না যায়।
const GrantCreditsSchema = z.object({
  action: z.literal("grant_credits").optional(),
  userId: z.string().min(1, "userId is required"),
  amount: z.number().int().positive("amount must be a positive integer"),
  reason: z.string().min(10, "reason must be at least 10 characters"),
});

const CreateInvoiceSchema = z.object({
  action: z.literal("create_invoice"),
  userId: z.string().min(1),
  kind: z.enum(["credits", "plan"]),
  amount: z.number().positive("amount must be positive"),
  currency: z.enum(["usd", "bdt"]),
  description: z.string().min(3, "description is required"),
  creditsToGrant: z.number().int().positive().optional(),
  plan: z.string().optional(),
  sendEmail: z.boolean().optional(),
});

const InvoiceActionSchema = z.object({
  action: z.enum(["mark_invoice_paid", "void_invoice"]),
  transactionId: z.string().min(1),
  note: z.string().min(3).optional(),
  reason: z.string().min(3).optional(),
  method: z.string().optional(),
});

const RefundSchema = z.object({
  action: z.literal("refund"),
  transactionId: z.string().min(1),
  /** না দিলে সম্পূর্ণ amount। Partial refund সমর্থিত। */
  amount: z.number().positive().optional(),
  reason: z.string().min(3, "a refund reason is required"),
});

const IssueActionSchema = z.object({
  action: z.enum(["mark_duplicate", "retry_payment", "resolve_issue"]),
  transactionId: z.string().min(1),
  note: z.string().min(3).optional(),
});

const ResolveRequestSchema = z.object({
  action: z.literal("resolve_request"),
  requestId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  adminNote: z.string().min(3).optional(),
});

const ActionSchema = z.union([
  GrantCreditsSchema,
  CreateInvoiceSchema,
  InvoiceActionSchema,
  RefundSchema,
  IssueActionSchema,
  ResolveRequestSchema,
]);

export async function POST(req: Request) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const admin = { userId: authResult.userId, email: authResult.user.email };
    const body = await req.json();
    const parsed = ActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const payload = parsed.data;

    switch (payload.action) {
      // ── Manual credit grant (goodwill / compensation — টাকা ছাড়া) ────────
      case undefined:
      case "grant_credits": {
        const result = await adjustUserCredits({
          userId: payload.userId,
          amount: payload.amount,
          direction: "add",
          reason: payload.reason,
          admin,
        });

        return NextResponse.json({
          success: true,
          newBalance: result.newBalance,
          user: { name: result.name, email: result.email },
          amountAdded: result.amount,
        });
      }

      // ── Payable invoice তৈরি ──────────────────────────────────────────────
      case "create_invoice": {
        const result = await createPayableInvoice({
          userId: payload.userId,
          kind: payload.kind,
          amount: payload.amount,
          currency: payload.currency,
          description: payload.description,
          creditsToGrant: payload.creditsToGrant,
          plan: payload.plan,
          admin,
          sendEmail: payload.sendEmail,
        });

        return NextResponse.json({ success: true, invoice: result });
      }

      // ── Invoice নিষ্পত্তি (bank transfer / cash) ──────────────────────────
      case "mark_invoice_paid": {
        const result = await markInvoicePaid({
          transactionId: payload.transactionId,
          admin,
          note: payload.note,
          method: payload.method,
        });

        return NextResponse.json({ success: true, grant: result });
      }

      case "void_invoice": {
        await voidInvoice({
          transactionId: payload.transactionId,
          admin,
          reason: payload.reason ?? "Voided by admin",
        });

        return NextResponse.json({ success: true });
      }

      // ── Refund ────────────────────────────────────────────────────────────
      case "refund":
        return handleRefund(payload, admin);

      case "mark_duplicate":
        return handleMarkDuplicate(payload, admin);

      case "retry_payment":
        return handleRetry(payload);

      case "resolve_issue":
        return handleResolveIssue(payload, admin);

      case "resolve_request":
        return handleResolveRequest(payload, admin);

      default:
        return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }
  } catch (error) {
    return errorResponse(error, "ADMIN_BILLING_POST");
  }
}

// ─── Action handlers ─────────────────────────────────────────────────────────

type AdminActor = { userId: string; email: string };

/**
 * Refund — **record only**।
 *
 * কেন automatic নয়: UddoktaPay-এর refund API এখনো wire করা হয়নি (ইচ্ছাকৃতভাবে
 * paused — `supportsAutomaticRefund()` দেখুন)। তাই টাকা আসলে gateway-এর
 * dashboard থেকে ফেরত দিতে হয়, আর admin এখানে সেটি লিখে রাখেন যাতে merchant-এর
 * হিসাব ও admin revenue report মিলে যায়।
 *
 * ⚠️ এই action credit **কাটে না** — credit adjust করা admin-এর আলাদা সিদ্ধান্ত।
 */
async function handleRefund(
  payload: { transactionId: string; amount?: number; reason: string },
  admin: AdminActor
) {
  const tx = await db.paymentTransaction.findUnique({
    where: { id: payload.transactionId },
    select: {
      id: true,
      userId: true,
      amount: true,
      currency: true,
      gateway: true,
      invoiceNumber: true,
      refundStatus: true,
    },
  });

  if (!tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // ইতিমধ্যে refund হয়ে গেলে আবার করা যাবে না। "requested"/"approved" অবস্থা
  // থেকে সরাসরি refund করা যায় (admin চাইলে request আগে reject না করেই)।
  const refundableStatuses = [null, "requested", "approved"];
  if (!refundableStatuses.includes(tx.refundStatus)) {
    return NextResponse.json(
      { error: `Cannot refund a payment with refund status "${tx.refundStatus}"` },
      { status: 409 }
    );
  }

  const refundAmount = Math.min(payload.amount ?? tx.amount, tx.amount);

  await db.paymentTransaction.update({
    where: { id: tx.id },
    data: {
      refundStatus: "refunded",
      refundAmount,
      refundReason: payload.reason,
      refundedAt: new Date(),
      refundedBy: admin.userId,
      resolvedAt: new Date(),
      resolvedBy: admin.userId,
      adminNote: `Manual refund (record only) via ${tx.gateway}: ${payload.reason}`,
    },
  });

  // Merchant-এর refund request থাকলে সেটিও processed হিসেবে বন্ধ করা হয়
  await db.refundRequest.updateMany({
    where: { transactionId: tx.id, status: { in: ["pending", "approved"] } },
    data: {
      status: "processed",
      reviewedBy: admin.userId,
      reviewedAt: new Date(),
      adminNote: payload.reason,
    },
  });

  await notifyRefundUpdate({
    userId: tx.userId,
    invoiceNumber: tx.invoiceNumber,
    amount: refundAmount,
    currency: tx.currency,
    status: "refunded",
    adminNote: payload.reason,
  });

  return NextResponse.json({
    success: true,
    // UI-কে জানানো হয় যে এটি record-only — টাকা gateway-এর বাইরে ফেরত দিতে হবে।
    mode: "manual",
    refundAmount,
  });
}

/** Duplicate হিসেবে চিহ্নিত করা (credit দেওয়া হয়নি — নিশ্চিত করা হয়)। */
async function handleMarkDuplicate(
  payload: { transactionId: string; note?: string },
  admin: AdminActor
) {
  const tx = await db.paymentTransaction.findUnique({
    where: { id: payload.transactionId },
    select: { id: true, duplicateOfId: true, grantedAt: true, metadata: true },
  });

  if (!tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (tx.grantedAt) {
    return NextResponse.json(
      { error: "This transaction has already granted credits — refund it instead" },
      { status: 409 }
    );
  }

  await db.paymentTransaction.update({
    where: { id: tx.id },
    data: {
      duplicateOfId: tx.duplicateOfId ?? "admin-confirmed",
      paymentStatus: "duplicate",
      adminNote: payload.note ?? "Marked as duplicate by admin",
      resolvedAt: new Date(),
      resolvedBy: admin.userId,
      metadata: { ...toJsonObject(tx.metadata), duplicateReviewedBy: admin.email },
    },
  });

  return NextResponse.json({ success: true });
}

/** ব্যর্থ payment-এর জন্য merchant-কে আবার payment link পাঠানো। */
async function handleRetry(payload: { transactionId: string; note?: string }) {
  const tx = await db.paymentTransaction.findUnique({
    where: { id: payload.transactionId },
    select: {
      id: true,
      userId: true,
      amount: true,
      currency: true,
      kind: true,
      invoiceNumber: true,
      status: true,
      grantedAt: true,
      metadata: true,
    },
  });

  if (!tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (tx.grantedAt) {
    return NextResponse.json({ error: "Payment already completed" }, { status: 409 });
  }

  const isInvoice = tx.kind === "invoice_credits" || tx.kind === "invoice_plan";

  // Invoice হলে আবার সচল করা হয় যাতে merchant আবার pay করতে পারে
  if (isInvoice && tx.status !== "awaiting_payment") {
    await db.paymentTransaction.update({
      where: { id: tx.id },
      data: { status: "awaiting_payment", paymentStatus: "pending" },
    });
  }

  const user = await db.user.findUnique({
    where: { userId: tx.userId },
    select: { name: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
  }

  const meta = toJsonObject(tx.metadata);
  const description =
    typeof meta.description === "string" && meta.description
      ? meta.description
      : `Invoice ${tx.invoiceNumber ?? tx.id}`;

  const { sendMail, MailTemplates, appUrl } = await import("@/lib/services/mail");
  const retryPath = isInvoice
    ? `/dashboard/payment/invoice/${tx.id}`
    : "/dashboard/payment";

  const mail = await sendMail({
    to: user.email,
    subject: "Complete your pending payment — DRIPLARE AI",
    html: MailTemplates.paymentFailed({
      name: user.name,
      description,
      amount: `${tx.currency.toUpperCase()} ${tx.amount.toLocaleString()}`,
      reason: "This payment is still awaiting completion.",
      retryUrl: appUrl(retryPath),
    }),
  });

  return NextResponse.json({ success: mail.success, retryPath });
}

/** Issue নিষ্পত্তি — কোনো action লাগেনি, শুধু queue থেকে সরানো। */
async function handleResolveIssue(
  payload: { transactionId: string; note?: string },
  admin: AdminActor
) {
  const result = await db.paymentTransaction.updateMany({
    where: { id: payload.transactionId },
    data: {
      resolvedAt: new Date(),
      resolvedBy: admin.userId,
      adminNote: payload.note ?? "Reviewed and dismissed by admin",
    },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

/** Merchant-এর refund request approve/reject। */
async function handleResolveRequest(
  payload: { requestId: string; decision: "approved" | "rejected"; adminNote?: string },
  admin: AdminActor
) {
  const request = await db.refundRequest.findUnique({
    where: { id: payload.requestId },
    select: {
      id: true,
      transactionId: true,
      status: true,
      amountRequested: true,
      transaction: { select: { userId: true, amount: true, currency: true, invoiceNumber: true } },
    },
  });

  if (!request) {
    return NextResponse.json({ error: "Refund request not found" }, { status: 404 });
  }

  if (request.status !== "pending") {
    return NextResponse.json(
      { error: `Request already ${request.status}` },
      { status: 409 }
    );
  }

  await db.$transaction([
    db.refundRequest.update({
      where: { id: request.id },
      data: {
        status: payload.decision,
        adminNote: payload.adminNote,
        reviewedBy: admin.userId,
        reviewedAt: new Date(),
      },
    }),
    db.paymentTransaction.update({
      where: { id: request.transactionId },
      data: {
        refundStatus: payload.decision,
        refundReason: payload.adminNote,
        ...(payload.decision === "rejected"
          ? { resolvedAt: new Date(), resolvedBy: admin.userId }
          : {}),
      },
    }),
  ]);

  await notifyRefundUpdate({
    userId: request.transaction.userId,
    invoiceNumber: request.transaction.invoiceNumber,
    amount: request.amountRequested ?? request.transaction.amount,
    currency: request.transaction.currency,
    status: payload.decision,
    adminNote: payload.adminNote,
  });

  return NextResponse.json({ success: true, status: payload.decision });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function toJsonObject(value: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Prisma.JsonObject)
    : {};
}
