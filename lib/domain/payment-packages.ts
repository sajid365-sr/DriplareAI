/**
 * Payment Package Catalog — DRIPLARE AI
 *
 * সব purchasable plan ও top-up pack-এর একমাত্র তালিকা।
 *
 * এই module-টিকে ইচ্ছাকৃতভাবে **leaf** রাখা হয়েছে — এর কোনো import নেই। কারণ
 * `admin-credits.ts` (grant logic) এবং `payments.ts` (gateway orchestration)
 * দুটোই এই data পড়ে, অথচ `payments.ts` `admin-credits.ts`-এ depend করে।
 * Data আলাদা রাখলে সেই circular dependency তৈরি হয় না।
 *
 * ⚠️ Plan-এর credit পরিমাণ এখানে নয় — সেটির source of truth
 * `lib/domain/plan-config.ts`। এখানে শুধু pricing ও top-up pack আছে।
 *
 * ⚠️ Gateway-টি এখন শুধু **UddoktaPay (BDT)**। তাই সব purchasable package
 * BDT-তে — international/USD checkout নেই। (Global region-এর pricing এখনো
 * USD-তে *দেখানো* হয়, কিন্তু সেখানে payment-এর সুবিধাই নেই।)
 */

export type PaymentCurrency = "bdt";

export type PaymentPackageId =
  | "starter_bdt"
  | "business_bdt"
  | "enterprise_bdt"
  // Legacy plan IDs (backward compat — পুরনো transaction-এর grant path অটুট রাখে)
  | "growth_bdt"
  | "pro_bdt"
  // Top-up packs
  | "topup_50k_business_bdt"
  | "topup_100k_business_bdt"
  | "topup_50k_enterprise_bdt"
  | "topup_100k_enterprise_bdt"
  | "topup_500k_enterprise_bdt";

export type PaymentPackage = {
  plan: string;
  amount: number;
  currency: PaymentCurrency;
  label: string;
  isTopUp?: boolean;
  topUpCredits?: number;
};

export const PAYMENT_PACKAGES: Record<string, PaymentPackage> = {
  // ─── New 3-Tier Plans (BD) ──────────────────────────────────────────────
  starter_bdt: {
    plan: "starter",
    amount: 999,
    currency: "bdt",
    label: "Starter Plan (BDT)",
  },
  business_bdt: {
    plan: "business",
    amount: 2499,
    currency: "bdt",
    label: "Business Plan (BDT)",
  },
  enterprise_bdt: {
    plan: "enterprise",
    amount: 4999,
    currency: "bdt",
    label: "Enterprise Plan (BDT)",
  },

  // ─── Legacy Plans (backward compat) ─────────────────────────────────────
  // পুরনো BDT transaction-এর grant path যেন ভাঙে না, তাই এই দুটি রাখা হলো।
  growth_bdt: {
    plan: "growth",
    amount: 999,
    currency: "bdt",
    label: "Growth Plan (BDT)",
  },
  pro_bdt: {
    plan: "pro",
    amount: 2900,
    currency: "bdt",
    label: "Pro Monthly (BDT)",
  },

  // ─── Top-up Credit Packs (BDT) ─────────────────────────────────────────
  topup_50k_business_bdt: {
    plan: "business",
    amount: 400,
    currency: "bdt",
    label: "50K Credits Top-up (Business)",
    isTopUp: true,
    topUpCredits: 50000,
  },
  topup_100k_business_bdt: {
    plan: "business",
    amount: 800,
    currency: "bdt",
    label: "100K Credits Top-up (Business)",
    isTopUp: true,
    topUpCredits: 100000,
  },
  topup_50k_enterprise_bdt: {
    plan: "enterprise",
    amount: 250,
    currency: "bdt",
    label: "50K Credits Top-up (Enterprise)",
    isTopUp: true,
    topUpCredits: 50000,
  },
  topup_100k_enterprise_bdt: {
    plan: "enterprise",
    amount: 450,
    currency: "bdt",
    label: "100K Credits Top-up (Enterprise)",
    isTopUp: true,
    topUpCredits: 100000,
  },
  topup_500k_enterprise_bdt: {
    plan: "enterprise",
    amount: 2000,
    currency: "bdt",
    label: "500K Credits Top-up (Enterprise)",
    isTopUp: true,
    topUpCredits: 500000,
  },
};

export function getPaymentPackage(packageId: string): PaymentPackage | null {
  return PAYMENT_PACKAGES[packageId] ?? null;
}

/** Top-up pack-এর credit সংখ্যা; pack না হলে null। */
export function getTopUpCredits(packageId: string): number | null {
  const pkg = getPaymentPackage(packageId);
  if (pkg?.isTopUp && pkg.topUpCredits) return pkg.topUpCredits;
  return null;
}
