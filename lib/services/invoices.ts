import "server-only";

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/core/db";
import { appUrl } from "@/lib/services/mail";
import {
  applyPaymentGrant,
  CreditAdjustmentError,
  type AdminActor,
  type PaymentKind,
} from "@/lib/services/admin-credits";

/**
 * Admin-issued Payable Invoice Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Workflow (professional invoicing):
 *
 *   1. Admin invoice তৈরি করে   → `createPayableInvoice()`
 *      transaction টি `pending` / `awaiting_payment` অবস্থায় থাকে — অর্থাৎ
 *      **কোনো credit দেওয়া হয় না এবং revenue-তেও যোগ হয় না** (টাকা আসেনি)।
 *   2. Merchant email পায় (PDF + "Pay Now" link)।
 *   3. Merchant `/dashboard/payment/invoice/<id>`-এ গিয়ে gateway-এ pay করে।
 *   4. Webhook → `applyPaymentGrant()` → credit/plan প্রয়োগ + revenue-তে যোগ।
 *
 * Admin চাইলে gateway-এর বাইরে (bank transfer / cash) টাকা নিয়েও
 * `markInvoicePaid()` দিয়ে invoice টি নিষ্পত্তি করতে পারেন — তখনও grant
 * একই path দিয়ে যায়, তাই নিয়ম কখনো আলাদা হয় না।
 *
 * ⚠️ আগের `manual_invoice` action সরাসরি `paymentStatus: "completed"` লিখত,
 * ফলে টাকা না এলেও `totalRevenue`/`mrr` বেড়ে যেত। এখন invoice `pending`
 * থাকা অবস্থায় revenue-তে গোনা হয় না।
 */

/** Invoice-এর minimum amount — ০ বা ঋণাত্মক invoice তৈরি হতে দেওয়া হয় না। */
const MIN_INVOICE_AMOUNT = 1;

export interface CreateInvoiceArgs {
  /** যে merchant-কে invoice করা হচ্ছে (Clerk userId)। */
  userId: string;
  /** `credits` = credit বিক্রি, `plan` = plan upgrade। */
  kind: "credits" | "plan";
  amount: number;
  currency: "usd" | "bdt";
  /** Invoice-এ দেখানো description (যেমন "50,000 Credit Top-up")। */
  description: string;
  /** kind === "credits" হলে কত credit যোগ হবে — বাধ্যতামূলক। */
  creditsToGrant?: number;
  /** kind === "plan" হলে কোন plan — bাধ্যতামূলক। */
  plan?: string;
  admin: AdminActor;
  /** false হলে merchant-কে email পাঠানো হবে না (শুধু record)। */
  sendEmail?: boolean;
}

export interface InvoiceResult {
  transactionId: string;
  sessionId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  payUrl: string;
  emailSent: boolean;
}

/** Merchant যে صفحায় invoice দেখে ও pay করে। */
export function invoicePayUrl(transactionId: string): string {
  return appUrl(`/dashboard/payment/invoice/${transactionId}`);
}

/**
 * `INV-YYYYMM-NNNNNN` ধাঁচের invoice number বানায়।
 *
 * Sequential রাখা হয়েছে (random নয়) কারণ VAT/audit-এ ধারাবাহিকতা দরকার।
 * Race-safe করতে: চলতি মাসের count থেকে পরের সংখ্যা ধরে নিয়ে insert করা হয়,
 * এবং unique constraint-এ ধাক্কা খেলে (P2002) পরের সংখ্যায় আবার চেষ্টা করা হয়।
 */
async function nextInvoiceNumber(period: string, offset: number): Promise<string> {
  const issuedThisPeriod = await db.paymentTransaction.count({
    where: { invoiceNumber: { startsWith: `INV-${period}-` } },
  });

  const sequence = issuedThisPeriod + 1 + offset;
  return `INV-${period}-${String(sequence).padStart(6, "0")}`;
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Admin-এর পক্ষ থেকে একটি payable invoice তৈরি করে।
 *
 * Transaction টি `manual_admin` gateway ও `awaiting_payment` status নিয়ে
 * তৈরি হয় — এতে বোঝা যায় টাকা এখনো আসেনি, এবং revenue calculation থেকে
 * বাদ পড়ে।
 */
export async function createPayableInvoice(
  args: CreateInvoiceArgs
): Promise<InvoiceResult> {
  const { userId, kind, amount, currency, description, admin } = args;

  if (!Number.isFinite(amount) || amount < MIN_INVOICE_AMOUNT) {
    throw new CreditAdjustmentError(
      `Invoice amount must be at least ${MIN_INVOICE_AMOUNT}`,
      "INVALID_AMOUNT"
    );
  }

  if (!description?.trim()) {
    throw new CreditAdjustmentError("A description is required", "MISSING_REASON");
  }

  if (kind === "credits" && (!args.creditsToGrant || args.creditsToGrant <= 0)) {
    throw new CreditAdjustmentError(
      "creditsToGrant must be a positive integer for a credit invoice",
      "INVALID_AMOUNT"
    );
  }

  if (kind === "plan" && !args.plan) {
    throw new CreditAdjustmentError("A plan is required for a plan invoice", "INVALID_PLAN");
  }

  const user = await db.user.findUnique({
    where: { userId },
    select: { userId: true, name: true, email: true, notificationSettings: true },
  });

  if (!user) {
    throw new CreditAdjustmentError("User not found", "USER_NOT_FOUND");
  }

  // `kind` column-এ invoice-এর প্রকৃত ধরনটাই লেখা হয়, তাই grant path
  // `metadata` না পড়েও সঠিক সিদ্ধান্ত নিতে পারে।
  const invoiceKind: PaymentKind = kind === "credits" ? "invoice_credits" : "invoice_plan";
  const metadata: Prisma.InputJsonObject = {
    kind: invoiceKind,
    description: description.trim(),
    adminId: admin.userId,
    adminEmail: admin.email,
    source: "admin_invoice",
    ...(kind === "credits" ? { creditsToGrant: args.creditsToGrant } : {}),
    ...(kind === "plan" ? { plan: args.plan } : {}),
  };

  // Invoice number-এ unique constraint আছে, তাই race হলে আবার চেষ্টা করা হয়
  const period = currentPeriod();
  let created: { id: string; sessionId: string; invoiceNumber: string | null } | null = null;

  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    const invoiceNumber = await nextInvoiceNumber(period, attempt);

    try {
      created = await db.paymentTransaction.create({
        data: {
          sessionId: `invoice_${randomUUID().replace(/-/g, "")}`,
          userId,
          packageId: `admin_invoice_${kind}`,
          amount,
          currency,
          gateway: "manual_admin",
          paymentStatus: "pending",
          status: "awaiting_payment",
          kind: invoiceKind,
          invoiceNumber,
          metadata,
        },
        select: { id: true, sessionId: true, invoiceNumber: true },
      });
    } catch (err) {
      // P2002 = invoiceNumber ইতিমধ্যেই ব্যবহৃত — পরের সংখ্যায় চেষ্টা
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        attempt < 4
      ) {
        continue;
      }
      throw err;
    }
  }

  if (!created) {
    throw new CreditAdjustmentError("Could not allocate an invoice number", "INVALID_AMOUNT");
  }

  const payUrl = invoicePayUrl(created.id);
  const emailSent = args.sendEmail === false ? false : await sendInvoiceEmail({
    invoiceNumber: created.invoiceNumber ?? created.id,
    description: description.trim(),
    amount,
    currency,
    payUrl,
    user,
  });

  return {
    transactionId: created.id,
    sessionId: created.sessionId,
    invoiceNumber: created.invoiceNumber ?? created.id,
    amount,
    currency,
    status: "awaiting_payment",
    payUrl,
    emailSent,
  };
}

/**
 * Invoice-টি পরিশোধিত হিসেবে চিহ্নিত করে এবং credit/plan প্রয়োগ করে।
 *
 * Gateway-এর বাইরে টাকা নেওয়া হলে (bank transfer, cash) admin এই function
 * call করেন — grant একই `applyPaymentGrant` path দিয়ে যায়।
 */
export async function markInvoicePaid(args: {
  transactionId: string;
  admin: AdminActor;
  note?: string;
  /** Payment method: "manual" | "bank_transfer" | "cash" ইত্যাদি (audit-এর জন্য)। */
  method?: string;
}): Promise<{ applied: boolean; plan?: string; creditsGranted?: number; reason?: string }> {
  const transaction = await db.paymentTransaction.findUnique({
    where: { id: args.transactionId },
    select: { id: true, kind: true, grantedAt: true, paymentStatus: true },
  });

  if (!transaction) {
    throw new CreditAdjustmentError("Invoice not found", "USER_NOT_FOUND");
  }

  await db.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      paymentStatus: "paid",
      status: "complete",
      completedAt: new Date(),
      resolvedAt: new Date(),
      resolvedBy: args.admin.userId,
      ...(args.note ? { adminNote: args.note } : {}),
      metadata: {
        ...(await readMetadata(transaction.id)),
        paidManuallyBy: args.admin.email,
        paymentMethod: args.method ?? "manual",
        paidAt: new Date().toISOString(),
      },
    },
  });

  const grant = await applyPaymentGrant(transaction.id);

  await notifyInvoicePaid({
    transactionId: transaction.id,
    adminNote: args.note,
  });

  return {
    applied: grant.applied,
    plan: grant.plan,
    creditsGranted: grant.creditsGranted,
    reason: grant.reason,
  };
}

/**
 * Invoice বাতিল করে (merchant আর pay করতে পারবে না)।
 * `paymentStatus: "cancelled"` — revenue-তে যোগ হয় না।
 */
export async function voidInvoice(args: {
  transactionId: string;
  admin: AdminActor;
  reason: string;
}): Promise<void> {
  const result = await db.paymentTransaction.updateMany({
    // ইতিমধ্যে paid/granted invoice বাতিল করা যাবে না
    where: { id: args.transactionId, grantedAt: null, paymentStatus: { not: "paid" } },
    data: {
      paymentStatus: "cancelled",
      status: "cancelled",
      failureReason: args.reason,
      resolvedAt: new Date(),
      resolvedBy: args.admin.userId,
      adminNote: args.reason,
    },
  });

  if (result.count === 0) {
    throw new CreditAdjustmentError(
      "Invoice not found, already paid, or already cancelled",
      "USER_NOT_FOUND"
    );
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function readMetadata(transactionId: string): Promise<Prisma.InputJsonObject> {
  const row = await db.paymentTransaction.findUnique({
    where: { id: transactionId },
    select: { metadata: true },
  });

  const meta = row?.metadata;
  return typeof meta === "object" && meta !== null && !Array.isArray(meta)
    ? (meta as Prisma.InputJsonObject)
    : {};
}

async function sendInvoiceEmail(args: {
  invoiceNumber: string;
  description: string;
  amount: number;
  currency: string;
  payUrl: string;
  user: { name: string; email: string; notificationSettings: Prisma.JsonValue };
}): Promise<boolean> {
  try {
    const { generateInvoicePDF } = await import("@/lib/services/pdf");
    const { sendMail, MailTemplates } = await import("@/lib/services/mail");

    const amountLabel = `${args.currency.toUpperCase()} ${args.amount.toLocaleString()}`;

    const pdfBuffer = await generateInvoicePDF({
      invoiceNumber: args.invoiceNumber,
      date: new Date().toLocaleDateString(),
      userName: args.user.name,
      userEmail: args.user.email,
      planName: args.description,
      amount: args.amount,
      currency: args.currency,
      gateway: "Pending",
      transactionId: args.invoiceNumber,
      status: "awaiting_payment",
    });

    const result = await sendMail({
      to: args.user.email,
      subject: `Invoice ${args.invoiceNumber} from DRIPLARE AI`,
      html: MailTemplates.invoiceIssued({
        name: args.user.name,
        invoiceNumber: args.invoiceNumber,
        description: args.description,
        amount: amountLabel,
        payUrl: args.payUrl,
      }),
      attachments: [
        {
          filename: `DRIPLARE-${args.invoiceNumber}.pdf`,
          content: pdfBuffer.toString("base64"),
        },
      ],
    });

    return result.success;
  } catch (err) {
    // Email ব্যর্থ হলেও invoice টি তৈরি থাকে — admin link কপি করে পাঠাতে পারেন
    console.error("[INVOICE_EMAIL_ERROR]", err);
    return false;
  }
}

/** Invoice পরিশোধ হলে merchant-এর in-app notification। */
async function notifyInvoicePaid(args: { transactionId: string; adminNote?: string }) {
  try {
    const tx = await db.paymentTransaction.findUnique({
      where: { id: args.transactionId },
      select: { userId: true, invoiceNumber: true, amount: true, currency: true },
    });

    if (!tx) return;

    const user = await db.user.findUnique({
      where: { userId: tx.userId },
      select: { notificationSettings: true },
    });

    const settings =
      typeof user?.notificationSettings === "object" &&
      user.notificationSettings !== null &&
      !Array.isArray(user.notificationSettings)
        ? (user.notificationSettings as Prisma.JsonObject)
        : {};

    if (settings.billing_app === false) return;

    await db.notification.create({
      data: {
        userId: tx.userId,
        type: "payment",
        title: "Payment Received",
        message: `Invoice ${tx.invoiceNumber ?? ""} (${tx.currency.toUpperCase()} ${tx.amount.toLocaleString()}) has been marked as paid.`.trim(),
      },
    });
  } catch (err) {
    console.error("[INVOICE_NOTIFICATION_ERROR]", err);
  }
}
