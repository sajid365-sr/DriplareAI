/**
 * Credit System Configuration — Driplare AI
 * 
 * Model Tier-ভিত্তিক credit cost এবং সব action-এর credit cost এখানে define করা।
 * এটি একটি single source of truth — সব API এখান থেকে import করবে।
 */

// ─── Model Tier Definitions ───────────────────────────────────────────────────

export type ModelTier = "economy" | "standard" | "premium";

/**
 * প্রতিটি model কোন tier-এ পড়ে তার mapping।
 * key = openRouterModel string
 */
export const MODEL_TIER_MAP: Record<string, ModelTier> = {
  // Economy — 5 credits/reply
  "google/gemini-flash-1.5-8b":        "economy",
  "google/gemini-2.5-flash-lite":      "economy",
  "google/gemini-2.0-flash-lite-001":  "economy",
  "meta-llama/llama-3.1-8b-instruct":  "economy",
  "google/gemma-2-9b-it":              "economy",
  "deepseek/deepseek-chat":            "economy",

  // Standard — 15 credits/reply
  "google/gemini-2.0-flash-001":           "standard",
  "google/gemini-flash-1.5":               "standard",
  "google/gemini-2.5-flash":               "standard",
  "openai/gpt-4o-mini":                    "standard",
  "meta-llama/llama-3.3-70b-instruct":     "standard",
  "qwen/qwen-2.5-72b-instruct":            "standard",
  "anthropic/claude-3-haiku":              "standard",
  "anthropic/claude-3.5-haiku":            "standard",

  // Premium — 50 credits/reply
  "openai/gpt-4o":                     "premium",
  "anthropic/claude-3.5-sonnet":       "premium",
  "anthropic/claude-3.5-sonnet:beta":  "premium",
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

  // Dashboard playground — model cost × 2 multiplier
  test_chat_multiplier: 2,

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
 * প্রতি plan-এ মাসে কতটা credits পাওয়া যাবে।
 * Free = 500, Growth = 15000, Business = 50000, Enterprise = Unlimited
 */
export const PLAN_CREDITS: Record<string, number> = {
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

/**
 * Test chat-এ (dashboard playground) credit cost calculate করা।
 * Normal reply cost × test_chat_multiplier (= 2)
 */
export function getTestChatCreditCost(openRouterModel: string): number {
  return getCreditCostByModel(openRouterModel) * CREDIT_COSTS.test_chat_multiplier;
}

/**
 * Plan-এর জন্য default included credits।
 */
export function getPlanCredits(plan: string): number {
  return PLAN_CREDITS[plan.toLowerCase()] ?? PLAN_CREDITS.starter;
}

/**
 * Compare mode-এ দুটো model-এর total credit cost।
 * (model A cost + model B cost) × test_chat_multiplier
 */
export function getCompareCreditCost(modelA: string, modelB: string): number {
  const costA = getCreditCostByModel(modelA);
  const costB = getCreditCostByModel(modelB);
  return (costA + costB) * CREDIT_COSTS.test_chat_multiplier;
}
