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
  /**
   * Whether the courier + orders module is part of this plan.
   *
   * Declared on every plan rather than left to a `?? true` default: the feature
   * lists already *say* which plans have it ("No E-Commerce Integration" on the
   * free tier, "E-Commerce (All Couriers)" on Business), and a gate that reads
   * the catalogue cannot drift from marketing copy that states the same thing.
   */
  ecommerceEnabled: boolean;
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
    // `website` is deliberately on the entry plan in both regions, and the
    // feature line below was corrected to say so in ১৫.৩.
    //
    // Before that, the machine rule and the copy disagreed in Global (the copy
    // promised the widget, the rule said Facebook only) and nothing enforced
    // either. Enforcing the old rule would have cut the Web Widget off the
    // tier a 3-day trial lands on — and the widget is the one channel a trial
    // merchant can wire up without a Meta app review, so it is the only channel
    // most trials will realistically reach. Facebook Messenger stays the more
    // valuable channel and the upgrade still buys 9 more chatbots, 35,000 more
    // credits, every other channel, e-commerce and top-up.
    allowedPlatforms: ["facebook", "website"],
    ecommerceEnabled: false,
    includedCredits: 15000,
    perCreditRate: 0.01,
    perCreditLabel: { en: "৳0.01", bn: "৳০.০১" },
    features: [
      { en: "1 Chatbot", bn: "১টি চ্যাটবট" },
      { en: "15,000 Free AI Credits/mo", bn: "১৫,০০০টি ফ্রি AI ক্রেডিট/মাস" },
      { en: "Facebook + Web Widget", bn: "Facebook + ওয়েব উইজেট" },
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
    ecommerceEnabled: true,
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
    // ⚠️ ৳৪,৯৯৯ ছিল এই tier-এর প্রকাশিত দাম ২০২৬-১০-১৫ পর্যন্ত। এখন এটি
    //    নেগোসিয়েটেড, তাই `price: 0` + `priceLabel: "Custom"` — ঠিক Global
    //    Enterprise-এর আয়নায়। সংখ্যাটি ইতিহাসের অংশ, তাই মন্তব্যে রইল।
    //
    //    কেন দাম সরানো হলো: ∞ chatbot + ∞ credit একটি **নির্দিষ্ট** দামে
    //    বিক্রি করলে প্ল্যাটফর্মের দিকটি নির্ধারিত হয়ে যায়, আর derivation-এর
    //    হিসাবে এই tier-এর লোকসান ছিল −৫২৪% (TASK-15 §১৯)। সিদ্ধান্ত (১৫.৫):
    //    যেখানে ব্যবহারই সীমাহীন, সেখানে দামও চুক্তিভিত্তিক।
    //
    //    `contact: true`-এর ফল তিনটি, আর প্রত্যেকটি আলাদা কোডে না লিখে
    //    ঘোষণা থেকেই আসে: `plan-revenue` এটিকে `basis: "custom"` পড়ে (ভুয়া
    //    ১০০% margin নয়), allowance-economics-এ margin `null` হয়
    //    ("unknown ≠ 0" নীতি), আর `isPackageAllowedForPlan` এই package বিক্রি
    //    করতে দেয় না — নেগোসিয়েটেড tier-এর প্রকাশিত দামই নেই।
    price: 0,
    priceLabel: { en: "Custom", bn: "কাস্টম" },
    // নেগোসিয়েটেড tier — self-serve checkout-এ নয় (বিস্তারিত উপরের মন্তব্যে)।
    contact: true,
    maxChatbots: Infinity,
    maxIntegrationsPerChatbot: Infinity,
    allowedPlatforms: ["*"],
    ecommerceEnabled: true,
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
    // `website` is in this list because the feature list below already promises
    // the Web Widget, and `maxIntegrationsPerChatbot: 1` means the merchant
    // picks one of the two. Before ১৫.৩ the machine rule and the marketing copy
    // disagreed here, and nothing enforced either — so a Global Starter could
    // wire up WhatsApp, which neither line ever offered.
    allowedPlatforms: ["facebook", "website"],
    ecommerceEnabled: false,
    includedCredits: 500,
    perCreditRate: 0.0002,
    perCreditLabel: "$0.0002",
    features: [
      "1 Chatbot",
      "1 Integration (Facebook or Web Widget)",
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
    ecommerceEnabled: true,
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
    ecommerceEnabled: true,
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
    ecommerceEnabled: true,
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

/**
 * `getPlan()`-এর মতো, কিন্তু যে key এই region-এর catalogue-এ **নেই** তার জন্য
 * `plans[0]`-এ পড়ে না — `null` দেয়।
 *
 * ⚠️ কেন দরকার: `getPlan("bd", "growth")` চুপচাপ **starter** ফেরত দেয়, কারণ
 *    BD-তে `growth` plan-ই নেই। সেটি এমন একটি উত্তর যা প্রশ্নকর্তাকে জানায় না
 *    যে সে ভুল প্রশ্ন করেছে। entitlement-এর প্রশ্নে ওই ভুলের ফল সরাসরি টাকা:
 *    একজন legacy `growth`/`pro` merchant (যিনি সত্যিই পরিশোধ করেছেন —
 *    `payment-packages.ts`-এ তাঁদের grant path এখনো আছে) Starter-এর
 *    সীমায় পড়ে যেতেন এবং নিজের channel হারাতেন। তাই এখানে "না-জানি" আর
 *    "না" আলাদা রাখা হলো — আর সিদ্ধান্ত নেয় caller, নিয়ম নেয় Catalogue।
 */
export function getPlanIfDefined(region: Region, planKey: string): PlanConfig | null {
  const key = String(planKey ?? "").trim().toLowerCase();
  if (!key) return null;
  return getPlansForRegion(region).find((p) => p.key === key) ?? null;
}

/**
 * অবসরপ্রাপ্ত (retired) plan-নাম → এই region-এর একটি **সত্যিকারের** plan key।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * কেন region-সচেতন: `growth` Global-এ আজও একটি **প্রকৃত** plan ($২৯), কিন্তু
 * BD-তে ওটি ২০২৬-এর তিন-ধাপের ল্যাডারের আগের একটি নাম (তখন `growth_bdt` প্যাকেজে
 * ৳৯৯৯-এ বিক্রি হত)। তাই একই শব্দ দুই region-এ দুই জিনিস বোঝায়, আর একটি
 * region-নিরপেক্ষ alias টেবিল ওই পার্থক্যটাই মুছে দিত।
 *
 * ⚠️ এখানেই `growth`-এর ভূতটির জন্ম হয়েছিল, তাই এখানেই তার প্রতিকার: grant path
 *    আগে key-কে "বৈধ কি না" জিজ্ঞেস করত একটি region-নিরপেক্ষ তালিকায়
 *    (`VALID_PLAN_KEYS`), যেখানে `growth` বৈধ — ফলে একজন BD user-এর `plan` হয়ে
 *    যেত `growth`, অথচ তার পরের প্রতিটি হিসাব `getPlan("bd","growth")` করে
 *    **চুপচাপ starter** পেত। পর্দায় "GROWTH", নিয়মে Starter।
 *
 * BD-তে `growth`/`pro` → `business`: তাঁরা ৳৯৯৯ / ৳২,৯০০ দিয়েছিলেন, এবং
 * ব্যবসায়িক সদিচ্ছার দিকটি এখানেই — যিনি টাকা দিয়েছেন তাঁর একটি channel-ও
 * যেন না ভাঙে। BD Starter-এ নামানো মানে তাঁর WhatsApp/Instagram বন্ধ হয়ে যাওয়া,
 * কারণ ওটি **সত্যিকারের** plan পরিবর্তন (fail-open তার জন্য নয়)।
 */
const LEGACY_PLAN_REPLACEMENTS: Record<string, Record<Region, PlanKey>> = {
  // BD-তে ৳৯৯৯-এর পুরনো plan; Global-এ আজও সত্যিকারের plan, তাই নিজেই।
  growth: { bd: "business", global: "growth" },
  // `pro` — Global-এ $২৯ (আজকের Growth-এর দাম), BD-তে ৳২,৯০০ (আজকের Business-এর কাছে)।
  pro: { bd: "business", global: "growth" },
  // `agency` ছিল Enterprise-এর আগের নাম।
  agency: { bd: "enterprise", global: "enterprise" },
};

export function resolveLegacyPlanKey(region: Region, legacyKey: string): PlanKey | null {
  const key = String(legacyKey ?? "").trim().toLowerCase();
  if (!key) return null;

  const replacement = LEGACY_PLAN_REPLACEMENTS[key];
  if (!replacement) return null;

  // প্রতিস্থাপনটি এই region-এ সত্যিই আছে কি না — না থাকলে `null`, কারণ
  // "না-জানি" আর "না" আলাদা রাখা এই ফাইলের নিয়ম (`getPlanIfDefined`)।
  return getPlanIfDefined(region, replacement[region]) ? replacement[region] : null;
}

/**
 * যেকোনো plan-নাম (বর্তমান বা অবসরপ্রাপ্ত) → এই region-এ বোধগম্য একটি `PlanKey`।
 *
 * এটি **একমাত্র** দরজা যেটি দিয়ে বাইরের কোড (যেমন `admin-credits.ts`-এর grant
 * path) "এই নামটি এই region-এ কোন plan" জিজ্ঞেস করবে। ভেতরে দুটি স্তর:
 * আজকের ক্যাটালগ → অবসরপ্রাপ্ত নামের প্রতিস্থাপন। না মিললে `null`, এবং
 * সিদ্ধান্তটি caller-এর (fail-open বনাম reject)।
 */
export function resolvePlanKeyForRegion(region: Region, planKey: string): PlanKey | null {
  const key = String(planKey ?? "").trim().toLowerCase();
  if (!key) return null;

  if (getPlanIfDefined(region, key)) return key as PlanKey;
  return resolveLegacyPlanKey(region, key);
}

/** Plan যেগুলো free tier — কেবল এগুলোতেই feature-এর সীমা আছে। */
const FREE_PLAN_KEYS = new Set<string>(["starter"]);

/**
 * এই plan-টি কি paid (অর্থাৎ free tier নয়)?
 *
 * ⚠️ অজানা key → **paid ধরা হয়**। কারণ দ্বিধাটি অসম: একজন অজানা-plan
 *    merchant হয় একজন পরিশোধকারী (legacy key, এখনো টাকা দিচ্ছেন), নয় এমন
 *    কেউ যাঁর plan-ই নেই — আর দ্বিতীয় দলটি `user.plan || "starter"`
 *    ডিফল্টে আগেই ধরা আছে। ভুল করে একজন পরিশোধকারীর channel বন্ধ করা
 *    ভুল করে একজন free user-কে একটু বেশি দেওয়ার চেয়ে অনেক খারাপ।
 */
export function isPaidPlan(plan: string): boolean {
  const key = String(plan ?? "").trim().toLowerCase();
  if (!key) return false;
  return !FREE_PLAN_KEYS.has(key);
}

/**
 * এই plan + region-এ `platform` খোলা আছে কি না।
 *
 * নিয়মটি catalogue থেকেই আসে (`allowedPlatforms`), এখানে নকল করা নয় — নইলে
 * `plan-config.ts` আর 실제 gate দুই জায়গায় দুই কথা বলত, আর ঠিক সেই রোগটিই
 * (একই সত্য দুই জায়গায় লেখা) এই রেপোতে বারবার দূর করা হয়েছে।
 *
 * অজানা plan → `true`। কারণ ওই region-এর catalogue ওই key-র নামেই কোনো
 * plan রাখে না, অর্থাৎ তার জন্য কোনো নিয়মও বলে না। এখানে Starter-এর সীমা চাপানো
 * মানে এমন একটি নিয়ম বানানো যা কেউ লেখেনি।
 */
export function planAllowsPlatform(
  plan: string,
  region: Region,
  platform: string
): boolean {
  const slug = String(platform ?? "").trim().toLowerCase();
  if (!slug) return false;

  const config = getPlanIfDefined(region, plan);
  if (!config) return true;

  const allowed = config.allowedPlatforms;
  if (allowed.length === 0 || allowed.includes("*")) return true;
  return allowed.includes(slug);
}

/**
 * Courier + orders module এই plan-এ আছে কি না।
 *
 * অজানা plan → `true`, `planAllowsPlatform`-এর মতো একই কারণে।
 */
export function planAllowsEcommerce(plan: string, region: Region): boolean {
  const config = getPlanIfDefined(region, plan);
  if (!config) return true;
  return config.ecommerceEnabled;
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
