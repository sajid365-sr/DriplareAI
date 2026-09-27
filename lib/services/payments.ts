import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/core/db";

// ── Package catalog ───────────────────────────────────────────────────────────
// Data এখন `lib/domain/payment-packages.ts`-এ (leaf module, কোনো import নেই)।
// এখানে backward compatibility-র জন্য re-export করা হচ্ছে, যাতে বিদ্যমান
// `import { PAYMENT_PACKAGES } from "@/lib/services/payments"` গুলো না ভাঙে।
export {
  PAYMENT_PACKAGES,
  getPaymentPackage,
  type PaymentPackage,
  type PaymentPackageId,
  type PaymentCurrency,
} from "@/lib/domain/payment-packages";

import { getPaymentPackage } from "@/lib/domain/payment-packages";
import { applyPaymentGrant, type PaymentKind } from "@/lib/services/admin-credits";
import { findDuplicatePayment, markAsDuplicate } from "@/lib/domain/payment-issues";

type FinalizePaymentArgs = {
  sessionId: string;
  status?: string;
  paymentStatus?: string;
  amount?: number;
  currency?: string;
  gateway?: string;
  userId?: string;
  packageId?: string;
  metadata?: Prisma.InputJsonObject;
};

function isJsonObject(value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type NotificationSettings = {
  billing_email?: boolean;
  billing_app?: boolean;
};

function getNotificationSettings(value: Prisma.JsonValue): NotificationSettings {
  if (!isJsonObject(value)) {
    return {};
  }

  return {
    billing_email: typeof value.billing_email === "boolean" ? value.billing_email : undefined,
    billing_app: typeof value.billing_app === "boolean" ? value.billing_app : undefined,
  };
}

export async function finalizePayment(args: FinalizePaymentArgs) {
  const existing = await db.paymentTransaction.findUnique({
    where: { sessionId: args.sessionId },
  });

  const resolvedUserId = existing?.userId ?? args.userId;
  const resolvedPackageId = existing?.packageId ?? args.packageId;
  const resolvedMetadata: Prisma.InputJsonObject =
    existing && isJsonObject(existing.metadata)
      ? (existing.metadata as Prisma.InputJsonObject)
      : {};
  const mergedMetadata: Prisma.InputJsonObject = {
    ...resolvedMetadata,
    ...(args.metadata ?? {}),
  };

  if (!resolvedUserId || !resolvedPackageId) {
    return { updated: false, transaction: existing };
  }

  const amount = args.amount ?? existing?.amount ?? 0;
  const currency = args.currency ?? existing?.currency ?? "bdt";
  const gateway = args.gateway ?? existing?.gateway ?? "uddoktapay";
  const paymentStatus = args.paymentStatus ?? "paid";

  const transaction = await db.paymentTransaction.upsert({
    where: { sessionId: args.sessionId },
    update: {
      paymentStatus,
      status: args.status ?? "complete",
      completedAt: new Date(),
      amount,
      currency,
      gateway,
      metadata: mergedMetadata,
    },
    create: {
      sessionId: args.sessionId,
      userId: resolvedUserId,
      packageId: resolvedPackageId,
      amount,
      currency,
      gateway,
      paymentStatus,
      status: args.status ?? "complete",
      completedAt: new Date(),
      metadata: mergedMetadata,
    },
  });

  // ── কোন ধরনের payment — column-এ লিখে রাখা হয় যাতে Payment Issues tab
  //    filter করতে পারে। Invoice payment হলে metadata.kind অগ্রাধিকার পায়।
  const metaKind = isJsonObject(transaction.metadata)
    ? asString((transaction.metadata as Prisma.JsonObject).kind)
    : undefined;
  const pkg = getPaymentPackage(transaction.packageId);
  const kind: PaymentKind = isPaymentKind(metaKind)
    ? metaKind
    : pkg?.isTopUp
      ? "topup"
      : "plan";

  if (transaction.kind !== kind) {
    await db.paymentTransaction.update({
      where: { id: transaction.id },
      data: { kind },
    });
  }

  // ── Duplicate guard ───────────────────────────────────────────────────────
  // একই user-এর একই amount-এর একটি completed transaction ইতিমধ্যেই থাকলে
  // (double webhook / double click / দুইবার pay) দ্বিতীয়টি duplicate হিসেবে
  // চিহ্নিত হয় এবং credit **যোগ হয় না**। আগে এই guard ছিল না, তাই merchant
  // দ্বিগুণ credit পেয়ে যেত।
  if (kind !== "manual_invoice") {
    const duplicate = await findDuplicatePayment({
      transactionId: transaction.id,
      userId: resolvedUserId,
      amount,
      currency,
    });

    if (duplicate) {
      await markAsDuplicate(transaction.id, duplicate.id);
      console.warn(
        `[PAYMENT_DUPLICATE] ${transaction.sessionId} duplicates ${duplicate.sessionId} — grant skipped`
      );
      return { updated: false, transaction, duplicateOf: duplicate.id };
    }
  }

  // ── Grant — একমাত্র path, admin flow-এর সাথে শেয়ার করা ────────────────────
  const grant = await applyPaymentGrant(transaction.id);

  // ── Receipt email (শুধু plan কেনার জন্য; top-up-এ আলাদা email নেই) ─────────
  // Invoice-এর email invoice flow নিজেই পাঠায়, তাই এখানে পাঠানো হয় না।
  const isPlanGrant = grant.kind === "plan" || grant.kind === "invoice_plan";
  if (grant.applied && isPlanGrant) {
    const currentUserInfo = await db.user.findUnique({
      where: { userId: resolvedUserId },
    });

    if (currentUserInfo) {
      const resolvedPlan = grant.plan ?? currentUserInfo.plan;
      await sendPlanReceiptEmail({
        user: currentUserInfo,
        plan: resolvedPlan,
        transaction,
      });

      // Award referral reward if this user was referred
      const { awardReferralReward } = await import("@/lib/core/auth");
      await awardReferralReward(resolvedUserId);
    }
  }

  return {
    updated: grant.applied,
    transaction,
    plan: grant.plan,
    kind: grant.kind,
    duplicateOf: undefined,
  };
}

/** Plan কেনার receipt email (PDF invoice attached)। */
async function sendPlanReceiptEmail(args: {
  user: {
    name: string;
    email: string;
    notificationSettings: Prisma.JsonValue;
  };
  plan: string;
  transaction: { id: string; sessionId: string; amount: number; currency: string; gateway: string; status: string };
}) {
  try {
    const settings = getNotificationSettings(args.user.notificationSettings);
    // Only send if billing_email is not explicitly disabled
    if (settings.billing_email === false) return;

    const { generateInvoicePDF } = await import("@/lib/services/pdf");
    const { sendMail, MailTemplates } = await import("@/lib/services/mail");

    const pdfBuffer = await generateInvoicePDF({
      invoiceNumber: args.transaction.id.substring(0, 8).toUpperCase(),
      date: new Date().toLocaleDateString(),
      userName: args.user.name,
      userEmail: args.user.email,
      planName: args.plan,
      amount: args.transaction.amount,
      currency: args.transaction.currency,
      gateway: args.transaction.gateway,
      transactionId: args.transaction.sessionId,
      status: args.transaction.status,
    });

    await sendMail({
      to: args.user.email,
      subject: `Invoice for your ${args.plan.toUpperCase()} plan - DRIPLARE AI`,
      html: MailTemplates.paymentReceipt(
        args.user.name,
        args.plan,
        `${args.transaction.amount} ${args.transaction.currency.toUpperCase()}`
      ),
      attachments: [
        {
          filename: `DRIPLARE-Invoice-${args.transaction.id.substring(0, 8)}.pdf`,
          content: pdfBuffer.toString("base64"),
        },
      ],
    });
  } catch (emailError) {
    // Email ব্যর্থ হলেও payment সফল থাকবে
    console.error("[INVOICE_EMAIL_ERROR]", emailError);
  }
}

const PAYMENT_KINDS: PaymentKind[] = [
  "plan",
  "topup",
  "invoice_credits",
  "invoice_plan",
  "manual_invoice",
];

function isPaymentKind(value: string | undefined): value is PaymentKind {
  return typeof value === "string" && PAYMENT_KINDS.includes(value as PaymentKind);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export function buildHostedPaymentUrl(baseUrl: string, invoiceId: string, amount: number) {
  const url = new URL(baseUrl);
  url.searchParams.set("amount", String(amount));
  url.searchParams.set("invoice", invoiceId);
  return url.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Gateway reference mapping
// ─────────────────────────────────────────────────────────────────────────────

/** UddoktaPay-এর নিজের invoice id → আমাদের transaction (invoice pay flow)। */
export async function findTransactionByGatewaySession(gatewaySessionId: string) {
  return db.paymentTransaction.findFirst({
    where: { metadata: { path: ["gatewaySessionId"], equals: gatewaySessionId } },
    select: { id: true, sessionId: true, userId: true, paymentStatus: true },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Failed payment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ব্যর্থ payment রেকর্ড করে + merchant-কে retry link সহ email পাঠায়।
 *
 * আগে ব্যর্থ payment শুধু DB-তে status লিখে রাখত — merchant টের পেত না যে তার
 * payment হয়নি, এবং admin-ও জানত না। ফলে merchant ভাবত plan কিনে ফেলেছে।
 */
export async function recordPaymentFailure(args: {
  sessionId?: string;
  userId?: string;
  packageId?: string;
  reason?: string;
  code?: string;
  gateway: string;
}): Promise<void> {
  try {
    const tx = await resolveFailedTransaction(args);

    if (!tx) return;

    // ইতিমধ্যে grant হয়ে গেলে payment ব্যর্থ নয় — webhook এলোমেলো এসেছে
    if (tx.grantedAt) return;

    const meta = isJsonObject(tx.metadata) ? tx.metadata : {};

    await db.paymentTransaction.update({
      where: { id: tx.id },
      data: {
        paymentStatus: "failed",
        status: "failed",
        failureReason: args.reason ?? "Payment failed at gateway",
        failureCode: args.code ?? null,
        metadata: {
          ...meta,
          failureGateway: args.gateway,
          failedAt: new Date().toISOString(),
        },
      },
    });

    await notifyPaymentFailure({
      userId: tx.userId,
      invoiceNumber: tx.invoiceNumber,
      amount: tx.amount,
      currency: tx.currency,
      description: typeof meta.description === "string" ? meta.description : tx.kind,
      reason: args.reason,
      transactionId: tx.id,
      kind: tx.kind,
    });
  } catch (err) {
    console.error("[PAYMENT_FAILURE_RECORD_ERROR]", err);
  }
}

/**
 * ব্যর্থ payment-এর সাথে সম্পর্কিত transaction খুঁজে বের করে।
 *
 * ক্রম: sessionId → user + package-এর সর্বশেষ pending transaction। শেষ
 * fallback-টি দরকার কারণ UddoktaPay-এর failed callback-এ কখনো আমাদের
 * session id থাকে না, শুধু gateway-এর নিজের invoice id থাকে।
 */
async function resolveFailedTransaction(args: {
  sessionId?: string;
  userId?: string;
  packageId?: string;
}) {
  const select = {
    id: true,
    sessionId: true,
    userId: true,
    amount: true,
    currency: true,
    kind: true,
    invoiceNumber: true,
    grantedAt: true,
    metadata: true,
    paymentStatus: true,
  } as const;

  if (args.sessionId) {
    const bySession = await db.paymentTransaction.findUnique({
      where: { sessionId: args.sessionId },
      select,
    });
    if (bySession) return bySession;
  }

  if (!args.userId) return null;

  // ২৪ ঘণ্টার মধ্যে তৈরি সর্বশেষ অ-সম্পন্ন transaction
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return db.paymentTransaction.findFirst({
    where: {
      userId: args.userId,
      ...(args.packageId ? { packageId: args.packageId } : {}),
      grantedAt: null,
      paymentStatus: { in: ["initiated", "pending", "unpaid"] },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    select,
  });
}

/** ব্যর্থ payment-এ merchant-কে email + in-app notification। */
async function notifyPaymentFailure(args: {
  userId: string;
  transactionId: string;
  kind: string;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  description: string;
  reason?: string;
}): Promise<void> {
  const user = await db.user.findUnique({
    where: { userId: args.userId },
    select: { name: true, email: true, notificationSettings: true },
  });

  if (!user) return;

  const settings = isJsonObject(user.notificationSettings) ? user.notificationSettings : {};
  const amountLabel = `${args.currency.toUpperCase()} ${args.amount.toLocaleString()}`;

  // Invoice-এর জন্য merchant invoice page-এ ফিরে যায়, সাধারণ checkout-এর
  // জন্য payment page-এ — যাতে retry করতে এক click লাগে।
  const retryPath =
    args.kind === "invoice_credits" || args.kind === "invoice_plan"
      ? `/dashboard/payment/invoice/${args.transactionId}`
      : "/dashboard/payment";

  if (settings.billing_email !== false) {
    try {
      const { sendMail, MailTemplates, appUrl } = await import("@/lib/services/mail");
      await sendMail({
        to: user.email,
        subject: "Your payment could not be completed — DRIPLARE AI",
        html: MailTemplates.paymentFailed({
          name: user.name,
          description: args.description,
          amount: amountLabel,
          reason: args.reason,
          retryUrl: appUrl(retryPath),
        }),
      });
    } catch (err) {
      console.error("[PAYMENT_FAILED_EMAIL_ERROR]", err);
    }
  }

  if (settings.billing_app === false) return;

  try {
    await db.notification.create({
      data: {
        userId: args.userId,
        type: "payment",
        title: "Payment Failed",
        message: `Your payment of ${amountLabel} could not be completed. No charge was made — you can retry from the payment page.`,
      },
    });
  } catch (err) {
    console.error("[PAYMENT_FAILED_NOTIF_ERROR]", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Refund (gateway-এর পক্ষ থেকে আসা)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gateway থেকে refund নিশ্চিত হলে রেকর্ড করে ও merchant-কে জানায়।
 *
 * ⚠️ এখানে credit **কাটা হয় না** — gateway থেকে কেউ refund করলে সেটি একটি
 * business decision, এবং credit কাটা না কাটা admin-এর সিদ্ধান্ত। Admin
 * queue-তে issue-টি দেখা যাবে যাতে প্রয়োজনে credit adjust করা যায়।
 */
export async function recordGatewayRefund(args: {
  transactionId: string;
  amount: number;
  reason?: string;
  gateway: string;
}): Promise<void> {
  try {
    const tx = await db.paymentTransaction.findUnique({
      where: { id: args.transactionId },
      select: {
        id: true,
        userId: true,
        amount: true,
        currency: true,
        invoiceNumber: true,
        refundStatus: true,
      },
    });

    if (!tx) return;

    await db.paymentTransaction.update({
      where: { id: tx.id },
      data: {
        refundStatus: "refunded",
        refundAmount: args.amount,
        refundedAt: new Date(),
        refundReason: args.reason ?? `Refunded via ${args.gateway}`,
        resolvedAt: new Date(),
      },
    });

    await notifyRefundUpdate({
      userId: tx.userId,
      invoiceNumber: tx.invoiceNumber,
      amount: args.amount,
      currency: tx.currency,
      status: "refunded",
    });
  } catch (err) {
    console.error("[GATEWAY_REFUND_RECORD_ERROR]", err);
  }
}

/** Refund-এর অবস্থা বদলালে merchant-কে email + in-app notification। */
export async function notifyRefundUpdate(args: {
  userId: string;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  status: "approved" | "rejected" | "refunded";
  adminNote?: string | null;
}): Promise<void> {
  const user = await db.user.findUnique({
    where: { userId: args.userId },
    select: { name: true, email: true, notificationSettings: true },
  });

  if (!user) return;

  const settings = isJsonObject(user.notificationSettings) ? user.notificationSettings : {};
  const amountLabel = `${args.currency.toUpperCase()} ${args.amount.toLocaleString()}`;

  if (settings.billing_email !== false) {
    try {
      const { sendMail, MailTemplates } = await import("@/lib/services/mail");
      await sendMail({
        to: user.email,
        subject: `Refund update for your DRIPLARE AI payment`,
        html: MailTemplates.refundUpdate({
          name: user.name,
          invoiceNumber: args.invoiceNumber,
          amount: amountLabel,
          status: args.status,
          adminNote: args.adminNote,
        }),
      });
    } catch (err) {
      console.error("[REFUND_EMAIL_ERROR]", err);
    }
  }

  if (settings.billing_app === false) return;

  const titles = {
    approved: "Refund Approved",
    rejected: "Refund Declined",
    refunded: "Refund Completed",
  } as const;

  try {
    await db.notification.create({
      data: {
        userId: args.userId,
        type: "payment",
        title: titles[args.status],
        message: `Your refund of ${amountLabel} has been ${args.status}.`,
      },
    });
  } catch (err) {
    console.error("[REFUND_NOTIF_ERROR]", err);
  }
}
