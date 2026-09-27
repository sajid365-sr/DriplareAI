import "server-only";

import { db } from "@/lib/core/db";

// ══════════════════════════════════════════════════════════════════════════════
// Cost Calculator — Token-based AI usage cost calculation
//
// DB-তে PlatformSetting (`ai_credit_rules`) থেকে per-model pricing fetch করে
// actual USD cost এবং BDT conversion calculate করে।
// In-memory cache (5-minute TTL) ব্যবহার করে DB load কমায়।
// ══════════════════════════════════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────────────────────────────────

/** Per-model pricing data stored in `ai_credit_rules` */
export interface ModelPricing {
  id: string;
  promptPrice: number;    // USD per 1M prompt tokens
  completionPrice: number; // USD per 1M completion tokens
  credits: number;         // Credits charged per reply
}

/** Result of cost calculation */
export interface UsageCostResult {
  costUsd: number;
  costBdt: number;
  totalTokens: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** 1 USD = 120 BDT (fixed conversion rate) */
const USD_TO_BDT_RATE = 120;

/** Cache TTL: 5 minutes */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Tokens per pricing unit (OpenRouter prices are per 1M tokens) */
const TOKENS_PER_UNIT = 1_000_000;

/**
 * Fallback pricing for models not found in DB.
 * Conservative mid-range pricing to avoid under-billing.
 */
const FALLBACK_PRICING: ModelPricing = {
  id: "fallback",
  promptPrice: 0.15,     // $0.15 / 1M tokens
  completionPrice: 0.60, // $0.60 / 1M tokens
  credits: 3,
};

// ─── In-Memory Pricing Cache ──────────────────────────────────────────────────

let cachedPricingMap: Map<string, ModelPricing> | null = null;
let cacheTimestamp = 0;

/**
 * DB থেকে `ai_credit_rules` key fetch করে model pricing map build করে।
 * 5-minute TTL cache ব্যবহার করে — `forceRefresh` দিলে cache skip হয়।
 */
async function getModelPricingMap(forceRefresh = false): Promise<Map<string, ModelPricing>> {
  const now = Date.now();

  // Return cached data if still fresh
  if (!forceRefresh && cachedPricingMap && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedPricingMap;
  }

  try {
    const setting = await (db as any).platformSetting.findUnique({
      where: { key: "ai_credit_rules" },
    });

    const pricingMap = new Map<string, ModelPricing>();

    if (setting?.value && Array.isArray((setting.value as any).models)) {
      const models = (setting.value as any).models as any[];

      for (const m of models) {
        if (!m.id) continue;

        pricingMap.set(m.id, {
          id: m.id,
          promptPrice: typeof m.promptPrice === "number" ? m.promptPrice : FALLBACK_PRICING.promptPrice,
          completionPrice: typeof m.completionPrice === "number" ? m.completionPrice : FALLBACK_PRICING.completionPrice,
          credits: typeof m.credits === "number" ? m.credits : FALLBACK_PRICING.credits,
        });
      }
    }

    // Update cache
    cachedPricingMap = pricingMap;
    cacheTimestamp = now;

    return pricingMap;
  } catch (error) {
    console.error("[COST_CALCULATOR] Failed to fetch pricing from DB:", error);

    // Return stale cache if available, otherwise empty map
    return cachedPricingMap ?? new Map<string, ModelPricing>();
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * নির্দিষ্ট model-এর token usage থেকে actual cost calculate করে।
 *
 * @param modelId - Full OpenRouter model ID (e.g. "openai/gpt-4o-mini")
 * @param promptTokens - Number of prompt tokens used
 * @param completionTokens - Number of completion tokens used
 * @returns `{ costUsd, costBdt, totalTokens }`
 *
 * @example
 * ```ts
 * const cost = await calculateUsageCost("openai/gpt-4o-mini", 1500, 300);
 * // { costUsd: 0.000405, costBdt: 0.0486, totalTokens: 1800 }
 * ```
 */
export async function calculateUsageCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): Promise<UsageCostResult> {
  const pricingMap = await getModelPricingMap();
  const pricing = pricingMap.get(modelId) ?? FALLBACK_PRICING;

  const costUsd =
    (promptTokens / TOKENS_PER_UNIT) * pricing.promptPrice +
    (completionTokens / TOKENS_PER_UNIT) * pricing.completionPrice;

  const costBdt = costUsd * USD_TO_BDT_RATE;
  const totalTokens = promptTokens + completionTokens;

  return {
    costUsd: parseFloat(costUsd.toFixed(8)),
    costBdt: parseFloat(costBdt.toFixed(6)),
    totalTokens,
  };
}

/**
 * নির্দিষ্ট model-এর credit cost বের করে (DB pricing অনুযায়ী)।
 * DB-তে না থাকলে fallback credits return করে।
 *
 * @param modelId - Full OpenRouter model ID
 * @returns Credits per reply for this model
 */
export async function getModelCredits(modelId: string): Promise<number> {
  const pricingMap = await getModelPricingMap();
  const pricing = pricingMap.get(modelId);
  return pricing?.credits ?? FALLBACK_PRICING.credits;
}

/**
 * Pricing cache manually refresh করা (admin settings update-এর পর call করা উচিত)।
 */
export async function refreshPricingCache(): Promise<void> {
  await getModelPricingMap(true);
}

/**
 * নির্দিষ্ট model-এর full pricing info বের করে।
 * DB-তে না থাকলে fallback pricing return করে।
 */
export async function getModelPricing(modelId: string): Promise<ModelPricing> {
  const pricingMap = await getModelPricingMap();
  return pricingMap.get(modelId) ?? { ...FALLBACK_PRICING, id: modelId };
}
