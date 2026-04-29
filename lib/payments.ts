import "server-only";
import Stripe from "stripe";
import { db } from "@/lib/db";

type PaymentCurrency = "usd" | "bdt";

export type PaymentPackageId = "pro_usd" | "pro_bdt";

export type PaymentPackage = {
  plan: "pro";
  amount: number;
  currency: PaymentCurrency;
  label: string;
};

export const PAYMENT_PACKAGES: Record<PaymentPackageId, PaymentPackage> = {
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
  metadata?: Record<string, unknown>;
};

export async function finalizePayment(args: FinalizePaymentArgs) {
  const existing = await db.paymentTransaction.findUnique({
    where: { sessionId: args.sessionId },
  });

  const resolvedUserId = existing?.userId ?? args.userId;
  const resolvedPackageId = existing?.packageId ?? args.packageId;
  const resolvedMetadata =
    existing && typeof existing.metadata === "object" && existing.metadata !== null
      ? (existing.metadata as Record<string, unknown>)
      : {};
  const mergedMetadata = {
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

  await db.user.update({
    where: { userId: resolvedUserId },
    data: {
      plan: resolvedPlan,
      points: 10000,
      pointsUsed: 0,
    },
  });

  return { updated: true, transaction };
}

export function buildHostedPaymentUrl(baseUrl: string, invoiceId: string, amount: number) {
  const url = new URL(baseUrl);
  url.searchParams.set("amount", String(amount));
  url.searchParams.set("invoice", invoiceId);
  return url.toString();
}
