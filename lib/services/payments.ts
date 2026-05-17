import "server-only";
import { Prisma } from "@prisma/client";
import Stripe from "stripe";
import { db } from "@/lib/core/db";

type PaymentCurrency = "usd" | "bdt";

export type PaymentPackageId = 
  | "growth_usd" 
  | "growth_bdt" 
  | "business_usd" 
  | "business_bdt"
  | "pro_usd" 
  | "pro_bdt";

export type PaymentPackage = {
  plan: string;
  amount: number;
  currency: PaymentCurrency;
  label: string;
};

export const PAYMENT_PACKAGES: Record<string, PaymentPackage> = {
  growth_usd: {
    plan: "growth",
    amount: 29,
    currency: "usd",
    label: "Growth Plan (USD)",
  },
  growth_bdt: {
    plan: "growth",
    amount: 999,
    currency: "bdt",
    label: "Growth Plan (BDT)",
  },
  business_usd: {
    plan: "business",
    amount: 79,
    currency: "usd",
    label: "Business Plan (USD)",
  },
  business_bdt: {
    plan: "business",
    amount: 2499,
    currency: "bdt",
    label: "Business Plan (BDT)",
  },
  pro_usd: {
    plan: "pro",
    amount: 29,
    currency: "usd",
    label: "Pro Monthly (USD)",
  },
  pro_bdt: {
    plan: "pro",
    amount: 2900,
    currency: "bdt",
    label: "Pro Monthly (BDT)",
  },
};

export function getPaymentPackage(packageId: string) {
  return PAYMENT_PACKAGES[packageId as PaymentPackageId] ?? null;
}

export function getStripeSecretKey() {
  const apiKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Stripe secret key পাওয়া যায়নি। `.env`-এ `STRIPE_SECRET_KEY=sk_test_...` বা valid secret key দিন।"
    );
  }

  if (apiKey.startsWith("pk_")) {
    throw new Error(
      "আপনি publishable Stripe key (`pk_...`) দিয়েছেন। Checkout session তৈরি করতে secret key (`sk_test_...` বা `sk_live_...`) লাগবে।"
    );
  }

  return apiKey;
}

export function getStripeClient() {
  const apiKey = getStripeSecretKey();

  return new Stripe(apiKey, {
    apiVersion: "2024-12-18.acacia" as never,
  });
}

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
  const resolvedPlan = String(mergedMetadata.plan ?? "pro");

  if (!resolvedUserId || !resolvedPackageId) {
    return { updated: false, transaction: existing };
  }

  const amount = args.amount ?? existing?.amount ?? 0;
  const currency = args.currency ?? existing?.currency ?? "usd";
  const gateway = args.gateway ?? existing?.gateway ?? "stripe";
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

  // Calculate new total messages based on plan + referral bonus
  const { getPlan } = await import("@/lib/domain/plan-config");
  const currentUserInfo = await db.user.findUnique({ where: { userId: resolvedUserId } });
  
  if (!currentUserInfo) {
    return { updated: false, transaction };
  }

  let currentBonus = 0;
  const currentPlanConfig = getPlan((currentUserInfo.region as any) || "bd", currentUserInfo.plan as any);
  currentBonus = Math.max(0, currentUserInfo.includedMessages - currentPlanConfig.includedMessages);

  const newPlanConfig = getPlan("bd", resolvedPlan as any); // Assuming "bd" for now, or fetch from user
  const newIncludedMessages = newPlanConfig.includedMessages + currentBonus;

  await db.user.update({
    where: { userId: resolvedUserId },
    data: {
      plan: resolvedPlan,
      includedMessages: newIncludedMessages,
      messagesUsedThisCycle: 0,
    },
  });

  // --- Send Invoice Email ---
  try {
    const settings = (currentUserInfo.notificationSettings as any) || {};
    // Only send if billing_email is not explicitly disabled
    if (settings.billing_email !== false) {
      const { generateInvoicePDF } = await import("@/lib/services/pdf");
      const { sendMail, MailTemplates } = await import("@/lib/services/mail");

      const pdfBuffer = await generateInvoicePDF({
        invoiceNumber: transaction.id.substring(0, 8).toUpperCase(),
        date: new Date().toLocaleDateString(),
        userName: currentUserInfo.name,
        userEmail: currentUserInfo.email,
        planName: resolvedPlan,
        amount: transaction.amount,
        currency: transaction.currency,
        paymentMethod: transaction.gateway
      });

      await sendMail({
        to: currentUserInfo.email,
        subject: `Invoice for your ${resolvedPlan.toUpperCase()} plan - Driplare AI`,
        html: MailTemplates.paymentReceipt(
          currentUserInfo.name, 
          resolvedPlan, 
          `${transaction.amount} ${transaction.currency.toUpperCase()}`
        ),
        attachments: [
          {
            filename: `Driplare-Invoice-${transaction.id.substring(0, 8)}.pdf`,
            content: pdfBuffer.toString("base64"),
          }
        ]
      });
    }
  } catch (emailError) {
    console.error("[INVOICE_EMAIL_ERROR]", emailError);
  }

  // Award referral reward if this user was referred
  const { awardReferralReward } = await import("@/lib/core/auth");
  await awardReferralReward(resolvedUserId);

  // --- Create Real-time Notification ---
  try {
    const settings = (currentUserInfo.notificationSettings as any) || {};
    // Default to true if not set explicitly to false
    if (settings.billing_app !== false) {
      await db.notification.create({
        data: {
          userId: resolvedUserId,
          type: "plan",
          title: "Plan Upgraded",
          message: `Welcome to the ${resolvedPlan.toUpperCase()} plan! You now have ${newIncludedMessages.toLocaleString()} messages.`,
        }
      });
    }
  } catch (notifError) {
    console.error("[PLAN_NOTIF_ERROR]", notifError);
  }

  return { updated: true, transaction, plan: resolvedPlan };
}

export function buildHostedPaymentUrl(baseUrl: string, invoiceId: string, amount: number) {
  const url = new URL(baseUrl);
  url.searchParams.set("amount", String(amount));
  url.searchParams.set("invoice", invoiceId);
  return url.toString();
}
