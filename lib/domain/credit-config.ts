/**
 * Credit System Configuration — Driplare AI
 *
 * Model Tier-ভিত্তিক credit cost এবং সব action-এর credit cost এখানে define করা।
 * এটি একটি single source of truth — সব API এখান থেকে import করবে।
 *
 * Note: Plan-ভিত্তিক credit limit-এর source of truth হলো `plan-config.ts`;
 * এই ফাইলের `getPlanCredits()` সেখানে delegate করে (region-aware)।
 */

import { getIncludedCredits, type PlanKey } from "@/lib/domain/plan-config";
import type { Region } from "@/lib/core/region";

// ─── Model Tier Definitions ───────────────────────────────────────────────────

export type ModelTier = "economy" | "standard" | "premium";

/**
 * প্রতিটি model কোন tier-এ পড়ে তার mapping।
 * key = openRouterModel string
 *
 * ⚠️ এই map-এ কোনো মডেল না থাকলেও সমস্যা নেই — `getModelTier()` নাম দেখে
 *    tier অনুমান করে (lite/flash/mini/haiku/8b → economy, pro/opus/sonnet/… → premium)।
 *    তাই OpenRouter-এ নতুন মডেল এলে এখানে যোগ করা বাধ্যতামূলক নয়।
 */
export const MODEL_TIER_MAP: Record<string, ModelTier> = {
  // Economy — ১ credit/reply (CREDIT_COSTS.reply_economy)
  "google/gemini-flash-1.5-8b":        "economy",
  "google/gemini-2.5-flash-lite":      "economy",
  "google/gemini-2.0-flash-lite-001":  "economy",
  "meta-llama/llama-3.1-8b-instruct":  "economy",
  "google/gemma-2-9b-it":              "economy",
  "deepseek/deepseek-chat":            "economy",

  // Standard — ৩ credit/reply (CREDIT_COSTS.reply_standard)
  "google/gemini-2.0-flash-001":           "standard",
  "google/gemini-flash-1.5":               "standard",
  "google/gemini-2.5-flash":               "standard",
  "openai/gpt-4o-mini":                    "standard",
  "meta-llama/llama-3.3-70b-instruct":     "standard",
  "qwen/qwen-2.5-72b-instruct":            "standard",
  "anthropic/claude-3-haiku":              "standard",
  "anthropic/claude-3.5-haiku":            "standard",

  // Premium — ৫ credit/reply (CREDIT_COSTS.reply_premium)
  "openai/gpt-4o":                     "premium",
  "anthropic/claude-sonnet-4":         "premium",
  "deepseek/deepseek-r1":              "premium",
  "openai/o1-preview":                 "premium",
  "openai/o1-mini":                    "premium",
  "google/gemini-pro-1.5":             "premium",
  "mistralai/mistral-large":           "premium",
};

// ─── Credit Costs Per Action ──────────────────────────────────────────────────

export const CREDIT_COSTS = {
  // AI Reply costs (per model tier)
  reply_economy:    1,
  reply_standard:   3,
  reply_premium:    5,

  // Dashboard playground / টেস্ট চ্যাটের গুণক।
  //
  // ১ = টেস্ট চ্যাট আর আসল গ্রাহকের খরচ সমান। আগে ২ ছিল, ফলে ড্যাশবোর্ডে
  // "৫ credit" দেখিয়ে ১০ কাটা হত — গ্রাহক যা দেখত তা নয়, তার দ্বিগুণ।
  // চাইলে admin panel (`/admin/ai-settings`) থেকে বদলানো যায়।
  test_chat_multiplier: 1,

  // Compare mode — sum of both model tiers (calculated at runtime)
  // compare_mode: sum of both selected models (no fixed value)

  // Prompt Enhancement (via OpenRouter)
  enhance_prompt:   20,

  // Knowledge Base embedding
  file_embedding_per_100kb: 5,

  // Auto-Train Engine — flat fee per run (any number of profiles)
  auto_train: 50,

  // Product Auto-Sync — flat fee per sync run (FB posts → AI product extraction)
  product_sync: 30,

  // Multimedia add-ons (added on top of reply cost)
  image_message:    5,  // ছবি পাঠালে reply cost-এর উপরে এই cost যোগ হবে
  audio_per_minute: 5,  // voice message-এর প্রতি মিনিটে এই cost যোগ হবে
} as const;

export type CreditActionType = keyof typeof CREDIT_COSTS;

/** Flat credit fee for one Auto-Train Engine run. */
export const AUTO_TRAIN_FEE = CREDIT_COSTS.auto_train;

/** Flat credit fee for one Product Auto-Sync run. */
export const PRODUCT_SYNC_FEE = CREDIT_COSTS.product_sync;

// ─── Plan Credit Limits ───────────────────────────────────────────────────────

/**
 * @deprecated Region-blind, তাই Global plan-এর জন্য ভুল মান দেয়
 * (Global starter = 500, কিন্তু এখানে 15000)।
 *
 * Credit-এর একমাত্র source of truth হলো `lib/domain/plan-config.ts`
 * (BD_PLANS / GLOBAL_PLANS)। নতুন কোডে `getPlanCredits(plan, region)` ব্যবহার করুন।
 * এই map শুধু backward compatibility-র জন্য রাখা হয়েছে।
 */
const LEGACY_PLAN_CREDITS: Record<string, number> = {
  starter:    15000,
  growth:     15000, // legacy compatibility
  business:   50000,
  enterprise: 150000,
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * OpenRouter model string থেকে model tier বের করা।
 * Static map-এ না থাকলে trusted live model naming pattern থেকে tier infer করা হয়।
 */
export function getModelTier(openRouterModel: string): ModelTier {
  const mapped = MODEL_TIER_MAP[openRouterModel];
  if (mapped) return mapped;

  const id = openRouterModel.toLowerCase();
  if (
    id.includes("lite") ||
    id.includes("flash") ||
    id.includes("mini") ||
    id.includes("haiku") ||
    id.includes("8b")
  ) {
    return "economy";
  }

  if (
    id.includes("pro") ||
    id.includes("opus") ||
    id.includes("sonnet") ||
    id.includes("reasoning") ||
    id.includes("70b") ||
    id.includes("120b") ||
    id.includes("405b")
  ) {
    return "premium";
  }

  return "standard";
}

/**
 * Model tier থেকে credit cost বের করা।
 */
export function getCreditCostByTier(tier: ModelTier): number {
  switch (tier) {
    case "economy":  return CREDIT_COSTS.reply_economy;
    case "standard": return CREDIT_COSTS.reply_standard;
    case "premium":  return CREDIT_COSTS.reply_premium;
    default:         return CREDIT_COSTS.reply_standard;
  }
}

/**
 * Model string থেকে সরাসরি credit cost বের করা।
 */
export function getCreditCostByModel(openRouterModel: string): number {
  const tier = getModelTier(openRouterModel);
  return getCreditCostByTier(tier);
}

// ⚠️ এখানে `getTestChatCreditCost()` ও `getCompareCreditCost()` ফাংশন দুটো ছিল।
// সরিয়ে দেওয়া হয়েছে — কারণ ওগুলো admin-এর override ও admin-নির্ধারিত
// `testChatMultiplier` এড়িয়ে যেত, ফলে চেক করা মান আর আসল deduction মিলত না।
// এখন ওই দুটোর জায়গায় `lib/ai/credit-resolver.ts`:
//   টেস্ট চ্যাট → resolveReplyCredits(model, { isTestChat: true })
//   compare    → resolveCompareCredits(modelA, modelB)

/**
 * Plan-এর জন্য default included credits — region-aware।
 *
 * `plan-config.ts`-ই একমাত্র source of truth; এখানে শুধু delegate করা হয়।
 * অজানা plan key হলে `getPlan()` নিজেই প্রথম plan-এ fallback করে।
 *
 * @param plan   Plan key (case-insensitive)
 * @param region "bd" | "global" — না দিলে "bd" ধরা হয় (legacy আচরণ)
 */
export function getPlanCredits(plan: string, region: Region = "bd"): number {
  const key = plan.toLowerCase() as PlanKey;
  const credits = getIncludedCredits(region, key);
  // `Infinity` (Global enterprise) JSON-safe করতে legacy মান-এ fallback করা হয়
  return Number.isFinite(credits) ? credits : LEGACY_PLAN_CREDITS[key] ?? LEGACY_PLAN_CREDITS.starter;
}
