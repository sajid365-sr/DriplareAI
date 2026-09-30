import "server-only";

import {
  getCreditCostByTier,
  MODEL_TIER_MAP,
} from "@/lib/domain/credit-config";
import type { PlanKey } from "@/lib/domain/plan-config";
import type { Region } from "@/lib/core/region";
import { checkModelAccess } from "@/lib/ai/plan-model-access";
import {
  buildDynamicTierMap,
  getDynamicModelTier,
  getTrustedOpenRouterModels,
  type ChatModelConfig,
  type DynamicTierKey,
  type ResolvedModelConfig,
  type TierOption,
} from "@/lib/ai/openrouter-service";

export type { ChatModelConfig, ResolvedModelConfig, TierOption };

export const LEGACY_CHAT_MODELS: ChatModelConfig[] = [
  {
    provider: "openrouter",
    providerName: "Google",
    model: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    openRouterModel: "google/gemini-2.5-flash",
    tier: "economy",
    credits: getCreditCostByTier("economy"),
    note: "Fast and affordable Gemini model",
  },
  {
    provider: "openrouter",
    providerName: "OpenAI",
    model: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    openRouterModel: "openai/gpt-4o-mini",
    tier: "economy",
    credits: getCreditCostByTier("economy"),
    note: "Fast, affordable ChatGPT model",
  },
  {
    provider: "openrouter",
    providerName: "Meta",
    model: "meta-llama/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B Instruct",
    openRouterModel: "meta-llama/llama-3.3-70b-instruct",
    tier: "standard",
    credits: getCreditCostByTier("standard"),
    note: "High performance open-source model",
  },
  {
    provider: "openrouter",
    providerName: "OpenAI",
    model: "openai/gpt-4o",
    label: "GPT-4o",
    openRouterModel: "openai/gpt-4o",
    tier: "premium",
    credits: getCreditCostByTier("premium"),
    note: "High intelligence flagship ChatGPT model",
  },
  {
    provider: "openrouter",
    providerName: "Anthropic",
    model: "anthropic/claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet",
    openRouterModel: "anthropic/claude-3.5-sonnet",
    tier: "premium",
    credits: getCreditCostByTier("premium"),
    note: "Top-tier reasoning and coding performance",
  },
];

/**
 * Backward-compatible export for old server imports. Client components should
 * fetch `/api/models/openrouter` instead of importing this server-only module.
 */
export const CHAT_MODELS = LEGACY_CHAT_MODELS;
export const DEFAULT_CHAT_MODEL = LEGACY_CHAT_MODELS[0];

const DEPRECATED_MODEL_ALIASES: Record<string, string> = {
  "google/gemini-3.6-flash": "google/gemini-2.5-flash",
  "google/gemini-flash-1.5-8b": "google/gemini-2.5-flash",
  "google/gemini-flash-1.5": "google/gemini-2.5-flash",
  "google/gemini-2.0-flash-001": "google/gemini-2.5-flash",
  "google/gemini-2.0-flash-lite-001": "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite": "google/gemini-2.5-flash",
  "anthropic/claude-3.5-sonnet:beta": "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3.5-sonnet:free": "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3-haiku": "anthropic/claude-3.5-haiku",
  "openai/o1-preview": "openai/gpt-4o",
  "openai/o1-mini": "openai/gpt-4o-mini",
};

function trimModelId(modelId?: string | null) {
  return String(modelId || "").trim();
}

function toResolvedModelConfig(modelId: string): ResolvedModelConfig {
  const tier = MODEL_TIER_MAP[modelId] ?? getDynamicModelTier(modelId);

  return {
    modelId,
    credits: getCreditCostByTier(tier),
    tier,
  };
}

export async function getLiveChatModels(): Promise<ChatModelConfig[]> {
  return getTrustedOpenRouterModels();
}

export async function getDynamicTierMap(): Promise<Record<DynamicTierKey, TierOption>> {
  const models = await getLiveChatModels();
  return buildDynamicTierMap(models);
}

export async function getDefaultResolvedModel(): Promise<ResolvedModelConfig> {
  const tiers = await getDynamicTierMap();
  return tiers.smart || tiers.fast;
}

/**
 * Checks whether a stored OpenRouter model ID is still active. Deprecated or
 * invalid IDs fall back to the current Fast tier model to keep n8n executions
 * from failing at runtime.
 */
export async function getValidatedModelId(storedModelId: string): Promise<string> {
  const models = await getLiveChatModels();
  const activeIds = new Set(models.map((model) => model.openRouterModel));
  const requested = trimModelId(storedModelId);
  const aliased = DEPRECATED_MODEL_ALIASES[requested] || requested;

  if (activeIds.has(aliased)) {
    return aliased;
  }

  const tiers = await buildDynamicTierMap(models);
  return tiers.fast.modelId;
}

export async function normalizeChatModel(provider?: string, model?: string): Promise<ChatModelConfig> {
  const models = await getLiveChatModels();
  const requestedModel = trimModelId(model);
  const aliasedModel = DEPRECATED_MODEL_ALIASES[requestedModel] || requestedModel;

  const found = models.find(
    (candidate) =>
      candidate.model === aliasedModel ||
      candidate.openRouterModel === aliasedModel ||
      `${candidate.provider}|${candidate.model}` === `${provider}|${requestedModel}`
  );

  if (found) return found;

  const fallbackId = await getValidatedModelId(aliasedModel);
  return models.find((candidate) => candidate.openRouterModel === fallbackId) || DEFAULT_CHAT_MODEL;
}

export async function getOpenRouterModel(provider: string, model: string) {
  return (await normalizeChatModel(provider, model)).openRouterModel;
}

export async function resolveModelConfig(
  promptMode: string,
  selectedTierOrModel: string
): Promise<ResolvedModelConfig> {
  const value = trimModelId(selectedTierOrModel);
  const tiers = await getDynamicTierMap();

  if (promptMode === "simple") {
    if (value === "fast" || value === "smart" || value === "genius") {
      return tiers[value];
    }
    if (!value) {
      return tiers.smart;
    }
  }

  const validatedId = await getValidatedModelId(value || tiers.smart.modelId);
  return toResolvedModelConfig(validatedId);
}

/**
 * model টা ঠিক করার **পর** তার plan-অনুমতি যাচাই — ফলাফলসহ।
 *
 * `ModelAccessResult`-এর সাথে কেবল `config` যোগ হয়েছে, তাই রুটে এক লাইনেই
 * দুই কাজ সার যায়:
 * ```ts
 * const resolved = await resolveModelForPlan(bot.promptMode, bot.model, user.plan);
 * const denied = toDeniedResponse(resolved);
 * if (denied) return denied;
 * const model = resolved.config.modelId;
 * ```
 *
 * ⚠️ কেন `resolveModelConfig` আলাদা রেখেই এটা বানানো হলো, আর কেন এটাই আসল
 *    ত্রুটি-প্রতিরোধক:
 *
 *    ১. **যাচাইটা অনুরোধের মানের নয়, ঠিক হওয়া মানের।** ক্লায়েন্ট
 *       `"google/gemini-2.0-flash-001"`-এর মতো পুরনো alias পাঠাতে পারে, যা
 *       `DEPRECATED_MODEL_ALIASES` হয়ে অন্য একটা id-তে গিয়ে ঠেকে। কাঁচা
 *       মানটা যাচাই করলে সেই id-টা কোনোদিনই দেখা হত না — অর্থাৎ alias দিয়ে
 *       বেড়া টপকানো যেত। এখানে `config.modelId` মানে যা **সত্যিই কল হবে**
 *       এবং যা **সত্যিই বিল হবে**, তাই ফাঁক থাকে না।
 *
 *    ২. **tier key-ও এর ভেতর দিয়েই যায়।** Merchant সাধারণত মডেল বাছেন
 *       Fast/Smart/Genius দিয়ে (`promptMode: "simple"`), আর তখন DB-তে
 *       রাখা হয় `"fast"` — আসল id আসে Quick Setup-এর প্রিসেট থেকে। তাই
 *       প্রিসেটের মডেলটা কোনো plan-এ আটকানো থাকলে সেই তালা এখানেই ধরা পড়ে,
 *       আলাদা করে tier বন্ধ করার দরকার নেই।
 *
 *    ৩. আর সবচেয়ে জরুরিটা: `resolveModelConfig` এমন মডেল পেলে যেটা আর নেই,
 *       চুপচাপ Fast-এ নেমে যায়। কিন্তু "এই plan-এ মডেলটা নেই" একেবারে অন্য
 *       কথা — সেখানে নেমে যাওয়া নয়, থেমে জানানো দরকার। নাহলে merchant ভাবতেন
 *       তাঁর পছন্দ কাজ করছে, অথচ ভেতরে অন্য একটা মডেল চলছিল — এই নীরব
 *       প্রতিস্থাপনটাই আসল বাগ, তাই এর জন্য আলাদা `blocked` ফল, আরেকটা
 *       fallback নয়।
 *
 * এখানে আটকানো মডেলের বদলে অন্য মডেল **খুঁজে দেওয়া হয় না** — ইচ্ছে করেই।
 * "তাহলে কোনটা চলবে" সেটা admin-এর সিদ্ধান্ত (তিনিই তো আটকেছেন), আর চুপচাপ
 * বিকল্প বেছে দেওয়াই এই বাগটার জন্ম দিয়েছিল।
 */
export async function resolveModelForPlan(
  promptMode: string,
  selectedTierOrModel: string,
  plan: string,
  region?: Region
): Promise<PlanModelResolution> {
  const config = await resolveModelConfig(promptMode, selectedTierOrModel);
  const access = await checkModelAccess(config.modelId, plan, region);

  if (access.status === "blocked") {
    return { status: "blocked", config, requiredPlan: access.requiredPlan };
  }
  if (access.status === "unknown") {
    return { status: "unknown", config };
  }
  return { status: "allowed", config };
}

export type PlanModelResolution =
  | { status: "allowed"; config: ResolvedModelConfig }
  | { status: "blocked"; config: ResolvedModelConfig; requiredPlan?: PlanKey }
  | { status: "unknown"; config: ResolvedModelConfig };

export async function resolveSimpleTierKey(modelId: string): Promise<DynamicTierKey> {
  const id = await getValidatedModelId(modelId);
  const tiers = await getDynamicTierMap();

  for (const [key, config] of Object.entries(tiers) as Array<[DynamicTierKey, ResolvedModelConfig]>) {
    if (config.modelId === id) return key;
  }

  return "smart";
}

export function getDisplayModelLabel(models: ChatModelConfig[], modelId: string) {
  return models.find((model) => model.openRouterModel === modelId)?.label || modelId;
}
