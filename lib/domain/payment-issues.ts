import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/core/db";

/**
 * Payment Issues — Duplicate detection, Refund state machine & Issue queue
 * ─────────────────────────────────────────────────────────────────────────────
 * এই module-টি payment সংক্রান্ত সব "সমস্যা" একটি জায়গায় সংজ্ঞায়িত করে, যাতে
 * gateway webhook (UddoktaPay), admin API এবং admin UI — সবাই একই
 * নিয়ম মানে।
 *
 * তিনটি কাজ করে:
 *  1. **Duplicate detection** — একই user-এর একই amount-এর দুটি successful
 *     payment ধরা (double click, double webhook, ভুলে দুইবার pay)।
 *  2. **Refund state machine** — `requested → approved | rejected → refunded`।
 *  3. **Issue queue** — admin-এর "Payment Issues" tab যে তালিকা দেখায়।
 */

/** Duplicate শনাক্তকরণের সময়সীমা (ঘণ্টা)। এর বাইরে হলে ভিন্ন purchase ধরা হয়। */
export const DUPLICATE_WINDOW_HOURS = 24;

/** `amount` column Float, তাই exact equality নিরাপদ নয় — সামান্য সহনশীলতা রাখা হয়। */
const AMOUNT_EPSILON = 0.01;

/** যে status গুলোকে "টাকা এসেছে" ধরা হয়। */
const PAID_STATUSES = ["paid", "completed", "succeeded"];

// ─────────────────────────────────────────────────────────────────────────────
// 1. Duplicate detection
// ─────────────────────────────────────────────────────────────────────────────

export interface DuplicateCandidate {
  id: string;
  sessionId: string;
}

/**
 * এই transaction-টির আগেই একই user একই amount-এর একটি successful payment
 * করেছে কি না খুঁজে বের করে।
 *
 * কেন দরকার: gateway একই webhook দুবার পাঠাতে পারে, merchant "Pay" button
 * দুবার চাপতে পারে, অথবা ভুলে দুইবার pay করতে পারে। আগে কোনো guard ছিল না —
 * ফলে **credit দুবার যোগ হয়ে যেত**। এখন দ্বিতীয়টি duplicate হিসেবে চিহ্নিত
 * হয়, credit যোগ হয় না, এবং admin queue-তে দেখা যায় (এক click-এ refund)।
 *
 * নিজের row বাদ দেওয়া হয় (`id: { not: ... }`), তাই একই session-এর webhook
 * পুনরাবৃত্তি এখানে ধরা পড়ে না — সেটি `applyPaymentGrant`-এর atomic claim
 * আটকায়।
 */
export async function findDuplicatePayment(args: {
  transactionId: string;
  userId: string;
  amount: number;
  currency: string;
  gateway?: string;
  windowHours?: number;
}): Promise<DuplicateCandidate | null> {
  const since = new Date(
    Date.now() - (args.windowHours ?? DUPLICATE_WINDOW_HOURS) * 60 * 60 * 1000
  );

  return db.paymentTransaction.findFirst({
    where: {
      id: { not: args.transactionId },
      userId: args.userId,
      currency: args.currency,
      amount: {
        gte: args.amount - AMOUNT_EPSILON,
        lte: args.amount + AMOUNT_EPSILON,
      },
      paymentStatus: { in: PAID_STATUSES },
      duplicateOfId: null,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "asc" }, // প্রথমটি-ই আসল payment
    select: { id: true, sessionId: true },
  });
}

/**
 * একটি transaction-কে duplicate হিসেবে চিহ্নিত করে (credit apply হয় না)।
 * `resolvedAt` ইচ্ছাকৃতভাবে খালি রাখা হয় — admin refund/void করে নিষ্পত্তি করবেন।
 */
export async function markAsDuplicate(
  transactionId: string,
  originalTransactionId: string
): Promise<void> {
  await db.paymentTransaction.update({
    where: { id: transactionId },
    data: {
      duplicateOfId: originalTransactionId,
      paymentStatus: "duplicate",
      failureReason: "Duplicate of an earlier successful payment",
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Issue classification & queue
// ─────────────────────────────────────────────────────────────────────────────

export type PaymentIssueType =
  | "disputed" // chargeback — gateway-এর পক্ষ থেকে
  | "refund_requested" // merchant refund চেয়েছে
  | "duplicate" // একই payment দুইবার
  | "failed" // gateway payment ব্যর্থ করেছে
  | "cancelled"; // merchant নিজে বাতিল করেছে

export interface PaymentIssueRow {
  transactionId: string;
  sessionId: string;
  invoiceNumber: string | null;
  kind: string;
  amount: number;
  currency: string;
  gateway: string;
  paymentStatus: string;
  issueType: PaymentIssueType;
  reason: string | null;
  failureCode: string | null;
  duplicateOfId: string | null;
  refundStatus: string | null;
  /** খোলা refund request-এর id — admin UI এর approve/reject action-এর জন্য। */
  refundRequestId: string | null;
  refundAmount: number | null;
  refundReason: string | null;
  adminNote: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  user: { userId: string; name: string; email: string; picture: string | null };
}

/** যে field গুলো queue-এর জন্য লাগে। */
const ISSUE_SELECT = {
  id: true,
  sessionId: true,
  invoiceNumber: true,
  kind: true,
  amount: true,
  currency: true,
  gateway: true,
  paymentStatus: true,
  status: true,
  failureReason: true,
  failureCode: true,
  duplicateOfId: true,
  refundStatus: true,
  refundAmount: true,
  refundReason: true,
  adminNote: true,
  createdAt: true,
  resolvedAt: true,
  metadata: true,
  refundRequests: {
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { id: true, reason: true, amountRequested: true },
  },
  user: {
    select: { userId: true, name: true, email: true, picture: true },
  },
} satisfies Prisma.PaymentTransactionSelect;

type IssueRecord = Prisma.PaymentTransactionGetPayload<{ select: typeof ISSUE_SELECT }>;

/**
 * একটি transaction কোন ধরনের সমস্যা — না হলে `null` (অর্থাৎ সুস্থ payment)।
 *
 * ক্রম গুরুত্বপূর্ণ: chargeback সবচেয়ে জরুরি, তারপর refund request, তারপর
 * duplicate, তারপর ব্যর্থ payment।
 */
export function classifyIssue(tx: IssueRecord): PaymentIssueType | null {
  if (tx.paymentStatus === "disputed" || tx.status === "disputed") return "disputed";

  if (tx.refundStatus === "requested" || tx.refundRequests.length > 0) {
    return "refund_requested";
  }

  if (tx.paymentStatus === "duplicate" || tx.duplicateOfId) return "duplicate";

  if (tx.paymentStatus === "failed" || tx.status === "failed") return "failed";

  if (tx.paymentStatus === "cancelled" || tx.status === "cancelled") return "cancelled";

  return null;
}

/** Issue queue-এর filter — নিষ্পত্তি না হওয়া সমস্যাগুলো। */
function issueWhere(userId?: string): Prisma.PaymentTransactionWhereInput {
  return {
    resolvedAt: null,
    ...(userId ? { userId } : {}),
    OR: [
      { paymentStatus: { in: ["failed", "cancelled", "duplicate", "disputed"] } },
      { status: { in: ["failed", "cancelled", "disputed"] } },
      { duplicateOfId: { not: null } },
      { refundStatus: "requested" },
      { refundRequests: { some: { status: "pending" } } },
    ],
  };
}

/** `?type=issues` — admin-এর Payment Issues tab-এর তালিকা। */
export async function listPaymentIssues(args: {
  userId?: string;
  limit?: number;
}): Promise<PaymentIssueRow[]> {
  const records = await db.paymentTransaction.findMany({
    where: issueWhere(args.userId),
    orderBy: { createdAt: "desc" },
    take: Math.min(args.limit ?? 100, 500),
    select: ISSUE_SELECT,
  });

  return records.flatMap((record) => {
    const issueType = classifyIssue(record);
    if (!issueType) return [];

    const pendingRequest = record.refundRequests[0];

    return [
      {
        transactionId: record.id,
        sessionId: record.sessionId,
        invoiceNumber: record.invoiceNumber,
        kind: record.kind,
        amount: record.amount,
        currency: record.currency,
        gateway: record.gateway,
        paymentStatus: record.paymentStatus,
        issueType,
        reason: record.failureReason ?? pendingRequest?.reason ?? record.refundReason ?? null,
        failureCode: record.failureCode,
        duplicateOfId: record.duplicateOfId,
        refundStatus: record.refundStatus,
        refundRequestId: pendingRequest?.id ?? null,
        refundAmount: record.refundAmount ?? pendingRequest?.amountRequested ?? null,
        refundReason: record.refundReason ?? pendingRequest?.reason ?? null,
        adminNote: record.adminNote,
        createdAt: record.createdAt,
        resolvedAt: record.resolvedAt,
        user: record.user,
      },
    ];
  });
}

/** একটি user-এর (বা পুরো সিস্টেমের) খোলা issue সংখ্যা — workspace card-এ দেখানো হয়। */
export async function countPaymentIssues(userId?: string): Promise<number> {
  return db.paymentTransaction.count({ where: issueWhere(userId) });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Refund state machine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Refund-এর অনুমোদিত অবস্থা। `requested → approved | rejected → refunded`
 * ছাড়া অন্য কোনো রূপান্তর অনুমোদিত নয়, তাই ভুল অবস্থায় refund হয়ে যেতে পারে না।
 */
export const REFUND_TRANSITIONS: Record<string, string[]> = {
  requested: ["approved", "rejected"],
  approved: ["refunded", "rejected"],
  rejected: [],
  refunded: [],
  // gateway নিজে থেকে refund করলে কোনো request ছাড়াই সরাসরি refunded
  none: ["refunded"],
};

/** `from` থেকে `to`-তে যাওয়া অনুমোদিত কি না। */
export function canTransitionRefund(from: string | null, to: string): boolean {
  const current = from ?? "none";
  return REFUND_TRANSITIONS[current]?.includes(to) ?? false;
}

/**
 * কোন gateway programmatic refund সমর্থন করে।
 *
 * ⚠️ এখন `false` — UddoktaPay-এর refund API এখনো wire করা হয়নি (ইচ্ছাকৃতভাবে
 * paused)। Admin panel তখন **manual refund** রেকর্ড করে: টাকা gateway-এর
 * dashboard থেকে ফেরত দিয়ে admin এখানে সেটি লিখে রাখেন, যাতে merchant হিসাব
 * মেলে। ভবিষ্যতে UddoktaPay API যুক্ত হলে এই ফাংশনেই `"uddoktapay"` ফেরত দিলেই
 * automatic path চালু হয়ে যাবে — বাকি flow অপরিবর্তিত।
 */
export function supportsAutomaticRefund(_gateway: string): boolean {
  return false;
}

/** Merchant কি এখন refund চাইতে পারবে — শুধু successful ও অ-refunded payment-এ। */
export function canRequestRefund(tx: {
  paymentStatus: string;
  refundStatus: string | null;
}): boolean {
  return PAID_STATUSES.includes(tx.paymentStatus) && !tx.refundStatus;
}
