/**
 * Payment Package Catalog — DRIPLARE AI
 *
 * সব purchasable plan ও top-up pack-এর একমাত্র তালিকা।
 *
 * এই module-টিকে ইচ্ছাকৃতভাবে **leaf** রাখা হয়েছে — এর কোনো **runtime**
 * import নেই যা এখানে ফিরে আসে। কারণ `admin-credits.ts` (grant logic) এবং
 * `payments.ts` (gateway orchestration) দুটোই এই data পড়ে, অথচ `payments.ts`
 * `admin-credits.ts`-এ depend করে। Data আলাদা রাখলে সেই circular dependency
 * তৈরি হয় না।
 *
 * ⚠️ ১৫.৩-এ একটি import যোগ হলো — `getPlanIfDefined` (`lib/domain/plan-config`)।
 *    leaf-গুণটি অটুট: `plan-config.ts` কেবল `@/lib/core/region` থেকে একটি
 *    **type** আনে (`import type`, compile-এ মুছে যায়), অর্থাৎ শৃঙ্খলটি
 *    এখানেই শেষ। নতুন কোনো import যোগ করার আগে এই দিকটি মিলিয়ে নিন।
 *
 * ⚠️ Plan-এর credit পরিমাণ এখানে নয় — সেটির source of truth
 * `lib/domain/plan-config.ts`। এখানে শুধু pricing ও top-up pack আছে।
 *
 * ⚠️ Gateway-টি এখন শুধু **UddoktaPay (BDT)**। তাই সব purchasable package
 * BDT-তে — international/USD checkout নেই। (Global region-এর pricing এখনো
 * USD-তে *দেখানো* হয়, কিন্তু সেখানে payment-এর সুবিধাই নেই।)
 */

import { getPlanIfDefined } from "@/lib/domain/plan-config";
import type { Region } from "@/lib/core/region";

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

/**
 * এই plan-টি এই package-টি কিনতে পারে কি না।
 *
 * ⚠️ **কেন এই check কেবল checkout-এ, grant-এ নয়:** টাকা গেটওয়ে নেওয়ার
 *    *আগে* আটকানো যায়, আর কেবল তখনই আটকানো উচিত। payment সফল হওয়ার পরে
 *    `applyPaymentGrant`-এ একই নিয়ম চাপালে ফল হত — merchant-এর টাকা কাটা
 *    হয়েছে, credit পেলেন না। তাই gate-এর জায়গা একটি: এখানে, checkout-এ।
 *
 * নিয়ম: **top-up pack কেবল সেই plan-ই কিনতে পারে যার নামে pack-টি।**
 * কারণ pack-এর দাম plan-ভিত্তিক (Business ৫০হাজার ৳৪০০, Enterprise ৳২৫০),
 * তাই mismatch মানে হয় ফাঁকা credit, নয় ছাড়।
 *
 * Plan package (যেমন `business_bdt`) সীমাবদ্ধ **নয়** — সেটি আপগ্রেডের পথ,
 * এবং ঠিক সেই পথটিই এই gate-এর পুরো কারণ: একজন Starter কেবল Business কিনে
 * সব সীমা মুছে ফেলতে পারেন, আর সেটাই কাম্য।
 *
 * ⚠️ **একটি ব্যতিক্রম (১৫.৫):** যে plan নেগোসিয়েটেড (`contact: true`), তার
 *    package কেনা যায় না। কারণ ওই tier-এর **প্রকাশিত দামই নেই** — চার্জ করার
 *    মতো একটি সংখ্যা এখানে নেই। BD Enterprise আগে ৳৪,৯৯৯-এ self-serve ছিল,
 *    অথচ তার ব্যবহার সীমাহীন (∞ chatbot, ∞ credit) — অর্থাৎ দাম নির্দিষ্ট,
 *    খরচ নয়। এখন সেটি Global Enterprise-এর মতো চুক্তিভিত্তিক, আর পথটি
 *    admin-এর payable plan-invoice (`kind: "invoice_plan"`)।
 *
 *    ⚠️ এই সীমাটি **বিক্রয়ের**, এবং জায়গাটি checkout — ইচ্ছাকৃতভাবে। এখানে
 *    (charge route-এ) আটকানো যায় কারণ টাকা এখনো কাটা হয়নি; কিন্তু
 *    `applyPaymentGrant`-এ একই নিয়ম চাপা যাবে না, কারণ ওটি চলে টাকা কাটার
 *    **পরে** — আর তখন আটকালে merchant-এর টাকা গেছে অথচ কিছু মেলেনি।
 *    `enterprise_bdt` তাই ক্যাটালগে **থাকে** (পুরনো transaction-এর grant path
 *    এটি পড়ে `resolvePlanForGrant`-এ)।
 */
export function isPackageAllowedForPlan(
  packageId: string,
  plan: string,
  region: Region
): boolean {
  const pkg = getPaymentPackage(packageId);
  if (!pkg) return false;

  if (!pkg.isTopUp) {
    // নেগোসিয়েটেড plan বিক্রি হয় না — দাম নেই, অতএব চার্জও নেই।
    // অজানা/legacy target (যেমন BD-তে `growth_bdt` → "growth") এখানে `null`
    // পায়, অর্থাৎ "এই region-এ ওই নামে কোনো নিয়ম নেই" → অনুমোদিত (fail-open)।
    const target = getPlanIfDefined(region, String(pkg.plan));
    return target?.contact !== true;
  }

  const buyer = String(plan ?? "").trim().toLowerCase();
  if (!buyer) return false;

  if (String(pkg.plan).trim().toLowerCase() === buyer) return true;

  // এই region-এর catalogue ওই key-র নামে কোনো plan রাখে না → তার জন্য কোনো
  // নিয়মও বলে না। এখানে নিয়ম বানানো মানে legacy `growth`/`pro` merchant-কে
  // বলা "আপনি credit কিনতে পারবেন না" — অথচ তিনি টাকা দিচ্ছেন। ঠিক যে
  // fail-open নিয়মটি `planAllowsPlatform` ও `planAllowsEcommerce`-এ আছে।
  return getPlanIfDefined(region, buyer) === null;
}
