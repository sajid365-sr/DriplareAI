/**
 * Plan configuration for DRIPLARE — separate BD and Global pricing.
 *
 * BD market:  Lower prices (lower CAC), BDT currency, Uddoktapay
 * Global:     Higher prices (higher CAC), USD currency — browse-only, no gateway
 */

import type { Region } from "@/lib/core/region";

/**
 * প্রতিটি plan key, নিচু থেকে উঁচু ক্রমে।
 *
 * ⚠️ ক্রমটাই hierarchy — আলাদা করে আর কোথাও "কোন planটা বড়" লেখা থাকা উচিত নয়।
 *    `growth` BD-তে আজ নেই, কিন্তু টাইপে ও তালিকায় রাখা হয়েছে: যেসব user
 *    একদিন ওই plan-এ ছিলেন তাঁদের DB মান আর পুরনো payment record পড়ার সময়
 *    অজানা key পেলে সব হিসাব চুপচাপ ভুল হয়ে যেত।
 */
export const PLAN_KEYS = ["starter", "growth", "business", "enterprise"] as const;

export type PlanKey = (typeof PLAN_KEYS)[number];

/**
 * একটা plan কত উঁচু — `PLAN_KEYS`-এর ক্রমই hierarchy, তাই এখানে আলাদা করে
 * কোনো "rank" টেবিল নেই।
 *
 * ⚠️ অজানা key-র জন্য `-1` — অর্থাৎ "কোনো plan-ই নয়"। এটা ইচ্ছাকৃত, আর
 *    `canUseProMode`-এর সাথে মিলে এটাই নিরাপদ দিকটা বেছে দেয়: অজানা কিছু
 *    ডানে-বাঁয়ে না ভেসে **সুবিধা না-পাওয়া** দিকে পড়ে। মানটা `User.plan`
 *    থেকে আসে, তাই তুলনার আগে trim + lowercase করা হয় — নাহলে "Business"
 *    লেখা একটা মান চুপচাপ Starter হয়ে যেত।
 */
export function planRank(plan: string): number {
  return PLAN_KEYS.indexOf(String(plan ?? "").trim().toLowerCase() as PlanKey);
}

/**
 * Pro মোড এই plan-টা পায় কি না।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * এটাই মডেল-অনুমতির **একমাত্র** নিয়ম: Starter শুধু Simple (Guided), আর
 * Starter-এর উপরের সব plan Simple + Pro দুটোই — যত মডেল admin Merchant Active
 * রেখেছেন, সবগুলো।
 *
 * ⚠️ কেন plan-প্রতি মডেলের আলাদা তালিকা নয় (যেটা আগে ছিল): merchant মডেল
 *    বাছেন **tier** দিয়ে (Fast/Smart/Genius), model id দিয়ে নয়। তাই একটা
 *    মডেল কোনো একটা plan-এ বন্ধ করলে তার প্রভাব পড়ত প্রিসেটের মধ্য দিয়ে,
 *    অর্থাৎ পরোক্ষে — আর admin পর্দায় যা দেখতেন তার সাথে merchant যা পেতেন,
 *    তার মিল খুঁজতে দুটো আলাদা হিসাব মেলাতে হত। এখন সীমানাটা এক জায়গায়,
 *    একটা প্রশ্নে: "এই plan-টা কি paid?"
 */
export function canUseProMode(plan: string): boolean {
  return planRank(plan) > 0;
}

/**
 * এই region-এ সবচেয়ে সস্তা paid plan — upgrade CTA-তে যার নাম বসবে।
 *
 * ⚠️ হার্ডকড `"growth"` নয় — কারণ `growth` কেবল Global-এ আছে। BD-র
 *    merchant-কে "Growth-এ আপগ্রেড করুন" দেখানো মানে এমন একটা plan-এর নাম
 *    বলা যা তিনি কিনতেই পারেন না (`§getPlansForRegion`)। তাই নামটা সবসময়
 *    সেই region-এর সত্যিকারের তালিকা থেকেই আসে: Global → Growth, BD → Business।
 */
export function cheapestPaidPlan(region: Region): PlanConfig {
  const plans = getPlansForRegion(region);
  return plans.find((plan) => plan.key !== "starter") ?? plans[plans.length - 1];
}

type LocalizedString = string | { en: string; bn: string };

export interface PlanConfig {
  key: PlanKey;
  name: LocalizedString;
  price: number;
  priceLabel: LocalizedString;
  maxChatbots: number;
  maxIntegrationsPerChatbot: number;
  allowedPlatforms: string[];
  includedCredits: number;
  perCreditRate: number;
  perCreditLabel: LocalizedString;
  features: LocalizedString[];
  trialDays?: number;
  featured?: boolean;
  contact?: boolean;
}

/* ───────── Bangladesh Plans (BDT) ───────── */

export const BD_PLANS: PlanConfig[] = [
  {
    key: "starter",
    name: { en: "Starter", bn: "স্টার্টার" },
    price: 999,
    priceLabel: { en: "৳999", bn: "৳৯৯৯" },
    maxChatbots: 1,
    maxIntegrationsPerChatbot: 1,
    allowedPlatforms: ["facebook"],
    includedCredits: 15000,
    perCreditRate: 0.01,
    perCreditLabel: { en: "৳0.01", bn: "৳০.০১" },
    features: [
      { en: "1 Chatbot", bn: "১টি চ্যাটবট" },
      { en: "15,000 Free AI Credits/mo", bn: "১৫,০০০টি ফ্রি AI ক্রেডিট/মাস" },
      { en: "Facebook Channel Only", bn: "শুধু Facebook চ্যানেল" },
      { en: "No E-Commerce Integration", bn: "ই-কমার্স ইন্টিগ্রেশন নেই" },
      { en: "3-day free trial", bn: "৩-দিনের ফ্রি ট্রায়াল" },
    ],
    trialDays: 3,
  },
  {
    key: "business",
    name: { en: "Business", bn: "বিজনেস" },
    price: 2499,
    priceLabel: { en: "৳2,499", bn: "৳২,৪৯৯" },
    maxChatbots: 10,
    maxIntegrationsPerChatbot: 7,
    allowedPlatforms: ["*"],
    includedCredits: 50000,
    perCreditRate: 0.008,
    perCreditLabel: { en: "৳0.008", bn: "৳০.০০৮" },
    features: [
      { en: "10 Chatbots", bn: "১০টি চ্যাটবট" },
      { en: "50,000 Free AI Credits/mo", bn: "৫০,০০০ ফ্রি AI ক্রেডিট/মাস" },
      { en: "All Channels", bn: "সব চ্যানেল" },
      { en: "E-Commerce (All Couriers)", bn: "ই-কমার্স (সব কুরিয়ার)" },
      { en: "Credit Top-up Enabled", bn: "ক্রেডিট টপ-আপ সুবিধা" },
    ],
    featured: true,
  },
  {
    key: "enterprise",
    name: { en: "Enterprise", bn: "এন্টারপ্রাইজ" },
    price: 4999,
    priceLabel: { en: "৳4,999", bn: "৳৪,৯৯৯" },
    maxChatbots: Infinity,
    maxIntegrationsPerChatbot: Infinity,
    allowedPlatforms: ["*"],
    includedCredits: 150000,
    perCreditRate: 0.005,
    perCreditLabel: { en: "৳0.005", bn: "৳০.০০৫" },
    features: [
      { en: "Unlimited Chatbots", bn: "আনলিমিটেড চ্যাটবট" },
      { en: "150,000 Free AI Credits/mo", bn: "১,৫০,০০০ ফ্রি AI ক্রেডিট/মাস" },
      { en: "All Channels + Web Widget", bn: "সব চ্যানেল + ওয়েব উইজেট" },
      { en: "E-Commerce + Custom Integration", bn: "ই-কমার্স + কাস্টম কুরিয়ার" },
      { en: "Advanced Model Customization", bn: "উন্নত মডেল কাস্টমাইজেশন টগল" },
    ],
  },
];

/* ───────── Global Plans (USD) ───────── */

export const GLOBAL_PLANS: PlanConfig[] = [
  {
    key: "starter",
    name: "Starter",
    price: 0,
    priceLabel: "$0",
    maxChatbots: 1,
    maxIntegrationsPerChatbot: 1,
    allowedPlatforms: ["facebook"],
    includedCredits: 500,
    perCreditRate: 0.0002,
    perCreditLabel: "$0.0002",
    features: [
      "1 Chatbot",
      "1 Integration (Facebook)",
      "500 Free AI Credits",
      "Web Widget",
      "14-day trial",
    ],
    trialDays: 14,
  },
  {
    key: "growth",
    name: "Growth",
    price: 29,
    priceLabel: "$29",
    maxChatbots: 5,
    maxIntegrationsPerChatbot: 5,
    allowedPlatforms: ["*"],
    includedCredits: 15000,
    perCreditRate: 0.0002,
    perCreditLabel: "$0.0002",
    features: [
      "5 Chatbots",
      "5 Integrations",
      "15,000 Free AI Credits/mo",
      "Priority Support",
    ],
    featured: true,
  },
  {
    key: "business",
    name: "Business",
    price: 79,
    priceLabel: "$79",
    maxChatbots: 20,
    maxIntegrationsPerChatbot: 15,
    allowedPlatforms: ["*"],
    includedCredits: 50000,
    perCreditRate: 0.0001,
    perCreditLabel: "$0.0001",
    features: [
      "20 Chatbots",
      "15 Integrations",
      "50,000 Free AI Credits/mo",
      "Live Chat",
      "Team Access",
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: 0,
    priceLabel: "Custom",
    maxChatbots: Infinity,
    maxIntegrationsPerChatbot: Infinity,
    allowedPlatforms: ["*"],
    includedCredits: Infinity,
    perCreditRate: 0,
    perCreditLabel: "Custom",
    features: [
      "Unlimited Chatbots",
      "Unlimited Credits",
      "SLA & Dedicated Support",
      "Custom Integrations",
    ],
    contact: true,
  },
];

/* ───────── Helpers ───────── */

/** Get plans for a given region. */
export function getPlansForRegion(region: Region): PlanConfig[] {
  return region === "bd" ? BD_PLANS : GLOBAL_PLANS;
}

/** Resolve localized string based on i18n language */
export function resolveLocalStr(str: LocalizedString, lang: string): string {
  if (typeof str === "string") return str;
  return lang === "bn" ? str.bn : str.en;
}

/** Get a specific plan by key and region. */
export function getPlan(region: Region, planKey: PlanKey): PlanConfig {
  const plans = getPlansForRegion(region);
  return plans.find((p) => p.key === planKey) ?? plans[0];
}

/** Get the total integration limit across all allowed chatbots for a plan. */
export function getTotalIntegrationLimit(plan: PlanConfig): number {
  if (!Number.isFinite(plan.maxChatbots) || !Number.isFinite(plan.maxIntegrationsPerChatbot)) {
    return Infinity;
  }

  return plan.maxChatbots * plan.maxIntegrationsPerChatbot;
}

/** Get default included credits for a plan key and region. */
export function getIncludedCredits(region: Region, planKey: PlanKey): number {
  return getPlan(region, planKey).includedCredits;
}
