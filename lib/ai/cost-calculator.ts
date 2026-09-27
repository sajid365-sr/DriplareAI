import "server-only";

import { resolveModelPrice, refreshPricingSnapshot } from "@/lib/ai/model-pricing";
import { resolveReplyCredits } from "@/lib/ai/credit-resolver";

// ══════════════════════════════════════════════════════════════════════════════
// Cost Calculator — token থেকে আসল খরচের হিসাব
//
// ⚠️ এই ফাইল আর নিজে কোনো হিসাব করে না — শুধু দুই source of truth-কে জোড়ে:
//    • **দাম**  → `lib/ai/model-pricing.ts`   (OpenRouter-এর লাইভ দাম)
//    • **credit** → `lib/ai/credit-resolver.ts` (admin-নিয়ন্ত্রিত, এক জায়গায়)
//
// আগে দাম আসত DB-র `ai_credit_rules` থেকে, আর সেটা বাসি হয়ে যেত — যেমন
// `gemini-2.5-flash-lite`-এর জন্য লেখা ছিল $0.075/$0.30, আসল $0.10/$0.40।
// এখন admin panel-এর দাম শুধু **fallback**, আসল দামই আগে।
//
// হিসাব: cost = (promptTokens × promptPrice + completionTokens × completionPrice) / 1M
// ══════════════════════════════════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────────────────────────────────

/** একটি মডেলের সম্পূর্ণ হিসাব-তথ্য (দাম + credit + কোন source থেকে এল)। */
export interface ModelPricing {
  id: string;
  /** USD per 1M prompt tokens */
  promptPrice: number;
  /** USD per 1M completion tokens */
  completionPrice: number;
  /** প্রতি reply-তে কত credit কাটবে */
  credits: number;
  /** দাম কোথা থেকে এল — `openrouter` = আসল, `fallback` = অনুমান */
  priceSource: "openrouter" | "fallback";
  /** credit কোথা থেকে এল — `admin` = admin panel, `config` = কোডের default */
  creditSource: "admin" | "config";
}

export interface UsageCostResult {
  costUsd: number;
  costBdt: number;
  totalTokens: number;
  /** দাম আসল না অনুমান — এই মান `AIUsageLog.costSource`-এ যাবে */
  priceSource: "openrouter" | "fallback";
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** 1 USD = 120 BDT (fixed conversion rate) */
const USD_TO_BDT_RATE = 120;

/** OpenRouter-এর দাম per 1M token হিসেবে রাখা হয় */
const TOKENS_PER_UNIT = 1_000_000;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * নির্দিষ্ট model-এর token usage থেকে actual cost calculate করে।
 *
 * @param modelId - Full OpenRouter model ID (e.g. "anthropic/claude-sonnet-4")
 * @param promptTokens - Number of prompt tokens used
 * @param completionTokens - Number of completion tokens used
 *
 * @example
 * ```ts
 * // claude-sonnet-4: $3/1M in, $15/1M out
 * const cost = await calculateUsageCost("anthropic/claude-sonnet-4", 1854, 86);
 * // { costUsd: 0.006852, costBdt: 0.82224, totalTokens: 1940, priceSource: "openrouter" }
 * ```
 */
export async function calculateUsageCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
): Promise<UsageCostResult> {
  const price = await resolveModelPrice(modelId);

  const costUsd =
    (promptTokens / TOKENS_PER_UNIT) * price.promptPrice +
    (completionTokens / TOKENS_PER_UNIT) * price.completionPrice;

  return {
    costUsd: Number(costUsd.toFixed(8)),
    costBdt: Number((costUsd * USD_TO_BDT_RATE).toFixed(6)),
    totalTokens: promptTokens + completionTokens,
    priceSource: price.source,
  };
}

/**
 * নির্দিষ্ট model-এর credit cost।
 *
 * @param modelId - Full OpenRouter model ID
 * @param options.isTestChat - ড্যাশবোর্ড টেস্ট চ্যাট হলে গুণক প্রয়োগ হবে
 */
export async function getModelCredits(
  modelId: string,
  options: { isTestChat?: boolean } = {},
): Promise<number> {
  const resolution = await resolveReplyCredits(modelId, options);
  return resolution.credits;
}

/**
 * নির্দিষ্ট model-এর full pricing info (দাম + credit)।
 * Admin panel-এ দেখানোর জন্য উপযোগী — `priceSource`/`creditSource` বলে দেয়
 * মানটা আসল না অনুমান।
 */
export async function getModelPricing(modelId: string): Promise<ModelPricing> {
  const [price, credit] = await Promise.all([
    resolveModelPrice(modelId),
    resolveReplyCredits(modelId),
  ]);

  return {
    id: modelId,
    promptPrice: price.promptPrice,
    completionPrice: price.completionPrice,
    credits: credit.credits,
    priceSource: price.source,
    creditSource: credit.source,
  };
}

/**
 * সব cache জোর করে নতুন করে আনে।
 *
 * Admin panel থেকে settings save করার পরে ডাকা উচিত — নাহলে পুরনো দাম চলতে পারে।
 *
 * ⚠️ credit-এর জন্য আলাদা করে কিছু ফেলতে হয় না — `getCreditRules()`
 *    প্রতিবার DB থেকেই পড়ে (আগের ৫ মিনিটের cache সরিয়ে দেওয়া হয়েছে,
 *    কারণ তাতেই "কার্ডে ৫, কাটে ১০" সমস্যাটা হয়েছিল)।
 */
export async function refreshPricingCache(): Promise<void> {
  await refreshPricingSnapshot();
}
