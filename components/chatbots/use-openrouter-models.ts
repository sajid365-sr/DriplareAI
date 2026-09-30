"use client";

import { useEffect, useMemo, useState } from "react";

import { sanitizeAllowedPlans } from "@/lib/domain/model-catalog";
import type { PlanKey } from "@/lib/domain/plan-config";

export type UiModelTier = "economy" | "standard" | "premium";
export type UiProviderName = "OpenAI" | "Anthropic" | "Google" | "Meta" | "DeepSeek" | "Other";
export type UiTierKey = "fast" | "smart" | "genius";

/**
 * কোন কোন plan এই মডেলটা পায় — admin-এর বেঁধে দেওয়া সীমা।
 *
 * ⚠️ না থাকলে **সব plan** (`CatalogModelShape.allowedPlans`-এর সংজ্ঞা)।
 *    অর্থাৎ `undefined` মানে "তালা নেই", "কেউ পারবে না" নয়। ক্লায়েন্টের
 *    সব যাচাই `isModelAllowedForPlan` দিয়ে হয়, তাই নিয়মটা ড্যাশবোর্ড আর
 *    সার্ভারে হুবহু এক থাকে — admin panel-ও ওই একই ফাংশন চালায়।
 */
type PlanAccess = { allowedPlans?: readonly PlanKey[] };

export type UiChatModelConfig = PlanAccess & {
  provider: string;
  providerName: UiProviderName;
  model: string;
  label: string;
  openRouterModel: string;
  tier: UiModelTier;
  credits: number;
  note?: string;
  contextLength?: number;
  created?: number;
};

export type UiResolvedModelConfig = PlanAccess & {
  modelId: string;
  credits: number;
  tier: UiModelTier;
  /**
   * admin-এর গুণক প্রয়োগের **পর** যা সত্যিই কাটা হবে।
   * কার্ডে এই সংখ্যাটাই দেখাতে হবে — `credits` নয়, নাহলে আবার
   * "কার্ডে ৫, কাটে ১০" ফিরে আসবে।
   */
  effectiveCredits: number;
};

export function normalizeProviderName(rawProvider: string, modelId: string = ""): UiProviderName {
  const p = (rawProvider || "").toLowerCase();
  const m = (modelId || "").toLowerCase();

  if (p.includes("openai") || m.startsWith("openai/")) return "OpenAI";
  if (p.includes("anthropic") || m.startsWith("anthropic/")) return "Anthropic";
  if (p.includes("google") || p.includes("gemini") || m.startsWith("google/")) return "Google";
  if (p.includes("meta") || p.includes("llama") || m.startsWith("meta-llama/")) return "Meta";
  if (p.includes("deepseek") || m.startsWith("deepseek/")) return "DeepSeek";

  return "Other";
}

export const FALLBACK_CHAT_MODELS: UiChatModelConfig[] = [
  {
    provider: "openrouter",
    providerName: "Google",
    model: "google/gemini-2.0-flash-001",
    label: "Gemini 2.0 Flash",
    openRouterModel: "google/gemini-2.0-flash-001",
    tier: "economy",
    credits: 1,
    note: "Fast trusted fallback model",
  },
  {
    provider: "openrouter",
    providerName: "OpenAI",
    model: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    openRouterModel: "openai/gpt-4o-mini",
    tier: "economy",
    credits: 1,
    note: "Fast OpenAI fallback model",
  },
  {
    provider: "openrouter",
    providerName: "Anthropic",
    model: "anthropic/claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet",
    openRouterModel: "anthropic/claude-3.5-sonnet",
    tier: "premium",
    credits: 5,
    note: "Balanced Anthropic fallback model",
  },
  {
    provider: "openrouter",
    providerName: "Meta",
    model: "meta-llama/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B Instruct",
    openRouterModel: "meta-llama/llama-3.3-70b-instruct",
    tier: "standard",
    credits: 3,
    note: "Trusted Meta fallback model",
  },
  {
    provider: "openrouter",
    providerName: "DeepSeek",
    model: "deepseek/deepseek-chat",
    label: "DeepSeek V3",
    openRouterModel: "deepseek/deepseek-chat",
    tier: "standard",
    credits: 3,
    note: "Efficient DeepSeek fallback model",
  },
];

export const DEFAULT_MODEL_KEY = `${FALLBACK_CHAT_MODELS[0].provider}|${FALLBACK_CHAT_MODELS[0].model}`;

/**
 * শুধু প্রথম আঁচড়ের জন্য — fetch শেষ হলেই সার্ভারের আসল মান এসে বসে।
 *
 * এখানে 1/3/5 লেখা আছে কারণ build-time-এ সার্ভার তো ডাকা যায় না, আর
 * `credit-config.ts`-এর কোড default-ও এই তিনটাই। কিন্তু এগুলো **কখনো**
 * billing-এর উৎস নয় — billing সবসময় `resolveReplyCredits` দেখে।
 *
 * ⚠️ `allowedPlans` ইচ্ছে করেই এখানে **নেই** — অর্থাৎ লোড হওয়ার আগে কোনো
 *    কার্ডেই তালা বসে না। উল্টোটা করলে প্রতিবার পেজ খোলার সময় এক পলকের জন্য
 *    একটা খোলা মডেলের গায়ে "Locked" ঝুলে থাকত, তারপর হয়েই যেত। মিথ্যা তালার
 *    চেয়ে দেরিতে আসা তালা অনেক ভালো।
 */
export const PLACEHOLDER_TIERS: Record<UiTierKey, UiResolvedModelConfig> = {
  fast: { modelId: "google/gemini-2.5-flash", credits: 1, tier: "economy", effectiveCredits: 1 },
  smart: { modelId: "openai/gpt-4o", credits: 3, tier: "standard", effectiveCredits: 3 },
  genius: { modelId: "anthropic/claude-sonnet-4", credits: 5, tier: "premium", effectiveCredits: 5 },
};

const TIER_DEFAULT_TIER: Record<UiTierKey, UiModelTier> = {
  fast: "economy",
  smart: "standard",
  genius: "premium",
};

const TIER_KEYS: UiTierKey[] = ["fast", "smart", "genius"];

/**
 * সার্ভারের পাঠানো `tiers`-কে UI-র আকারে আনে। অসম্পূর্ণ হলে `null` —
 * তখন অন্য উপায়ে হিসাব করা হয়, বানানো সংখ্যা বসানো হয় না।
 */
function parseTiers(data: unknown): Record<UiTierKey, UiResolvedModelConfig> | null {
  const raw = (data as { tiers?: Record<string, unknown> } | null)?.tiers;
  if (!raw) return null;

  const result = {} as Record<UiTierKey, UiResolvedModelConfig>;

  for (const key of TIER_KEYS) {
    const tier = raw[key] as
      | {
          modelId?: unknown;
          credits?: unknown;
          tier?: unknown;
          effectiveCredits?: unknown;
          allowedPlans?: unknown;
        }
      | undefined;
    if (!tier || typeof tier.modelId !== "string") return null;

    const credits = Number(tier.credits) || 0;
    result[key] = {
      modelId: tier.modelId,
      credits,
      tier: String(tier.tier || TIER_DEFAULT_TIER[key]).toLowerCase() as UiModelTier,
      // সার্ভার effectiveCredits না দিলে base-ই ধরি (গুণক ১) — কিন্তু
      // এমনটা হয় না, কারণ দুটো endpoint-ই এখন এটা পাঠায়।
      effectiveCredits: Number(tier.effectiveCredits) || credits,
      // সার্ভারের JSON-ও হাতে লেখা হতে পারে, তাই এখানেও একই যাচাই —
      // ভুল key ("premium") থাকলে বাদ পড়ে, আর খালি তালিকা "তালা নেই"-এ
      // পরিণত হয়, ঠিক যেমন admin panel-এ সেভ হয়েছিল।
      allowedPlans: sanitizeAllowedPlans(tier.allowedPlans),
    };
  }

  return result;
}

/**
 * শেষ ভরসা: `tiers` না এলে preset মডেলগুলো DB-তালিকা থেকেই খুঁজি আর
 * **তাদের নিজের credit** ব্যবহার করি। গুণকটা সার্ভারই পাঠায়
 * (`testChatMultiplier`), তাই এখানে কোনো সংখ্যা অনুমান করতে হয় না।
 */
function deriveTiers(
  models: UiChatModelConfig[],
  quickSetup: unknown,
  multiplier: number
): Record<UiTierKey, UiResolvedModelConfig> | null {
  const setup = quickSetup as Record<string, unknown> | undefined;
  if (!setup) return null;

  const result = {} as Record<UiTierKey, UiResolvedModelConfig>;

  for (const key of TIER_KEYS) {
    const wanted = setup[`${key}Model`];
    if (typeof wanted !== "string") return null;

    const found = models.find((model) => model.openRouterModel === wanted);
    if (!found) return null;

    result[key] = {
      modelId: found.openRouterModel,
      credits: found.credits,
      tier: found.tier,
      effectiveCredits: Math.round(found.credits * multiplier),
      // প্রিসেটের মডেলটাই তালাও বয়ে আনে — `tiers` না এলে এটাই একমাত্র পথ,
      // আর এই পথটাই ৩c-তে জানতে চাওয়া হয়েছিল (প্রিসেটের মডেল আটকানো থাকলে
      // tier key দিয়ে বেড়া টপকানো যেত)।
      allowedPlans: found.allowedPlans,
    };
  }

  return result;
}

function groupModels(models: UiChatModelConfig[]) {
  const order: UiProviderName[] = ["OpenAI", "Anthropic", "Google", "Meta", "DeepSeek", "Other"];
  const map: Record<string, UiChatModelConfig[]> = {};

  for (const m of models) {
    const provider = normalizeProviderName(m.providerName || m.provider, m.openRouterModel || m.model);
    if (!map[provider]) map[provider] = [];
    map[provider].push(m);
  }

  const result: Record<string, UiChatModelConfig[]> = {};
  for (const provider of order) {
    if (map[provider] && map[provider].length > 0) {
      result[provider] = map[provider] as UiChatModelConfig[];
    }
  }
  return result as Record<UiProviderName, UiChatModelConfig[]>;
}

export function getModelKey(model: UiChatModelConfig) {
  return `${model.provider}|${model.model}`;
}

export function useOpenRouterModels() {
  const [models, setModels] = useState<UiChatModelConfig[]>(FALLBACK_CHAT_MODELS);
  const [tiers, setTiers] = useState<Record<UiTierKey, UiResolvedModelConfig>>(PLACEHOLDER_TIERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      try {
        // ⚠️ `no-store` অপরিহার্য — credit-এর মান admin panel থেকে বদলায়, আর
        //    ব্রাউজারের HTTP cache পুরনো উত্তর ধরে রাখলে "admin-এ ১/৩/৫, ড্যাশবোর্ডে
        //    ২/৬/১০" জাতীয় অমিল ফিরে আসে।
        let response = await fetch("/api/ai-models", { cache: "no-store" });
        if (!response.ok) {
          response = await fetch("/api/models/openrouter", { cache: "no-store" });
        }
        if (!response.ok) throw new Error("Failed to load OpenRouter models");

        const data = await response.json();
        if (cancelled) return;

        let mappedModels: UiChatModelConfig[] = [];

        if (Array.isArray(data.models) && data.models.length > 0) {
          mappedModels = data.models.map((m: any) => {
            const rawModelId = m.id || m.openRouterModel || m.model;
            const normProvider = normalizeProviderName(m.provider || m.providerName, rawModelId);
            return {
              provider: "openrouter",
              providerName: normProvider,
              model: rawModelId,
              label: m.name || m.label || rawModelId,
              openRouterModel: rawModelId,
              tier: (m.tier || "standard").toLowerCase() as UiModelTier,
              credits: m.credits || 1,
              note: m.note || `${m.tier || "Standard"} • ${m.credits || 1} credit${(m.credits || 1) > 1 ? "s" : ""}`,
              contextLength: m.contextWindow || m.contextLength,
              // ⚠️ এই map প্রতিটা ফিল্ড হাতে গুনে লেখে, তাই এটা এখানে না
              //    থাকলে সার্ভার ৩c-তে যে মডেল আটকায়, ড্যাশবোর্ড সেটাকে
              //    খোলা দেখাত — ব্যবহারকারীর কাছে ওই অমিলটাই সবচেয়ে বিভ্রান্তিকর।
              allowedPlans: sanitizeAllowedPlans(m.allowedPlans),
            };
          });

          setModels(mappedModels);
        }

        // Fast / Smart / Genius — সার্ভারের হিসাবই আসল।
        //
        // আগে এখানে হার্ডকড `credits: 1 / 3 / 5` বসানো ছিল, আর সার্ভার
        // `tiers` পাঠাত না — তাই admin panel-এ ৫ credit দেখালেও বিলে
        // ৫ × গুণক কাটত ("কার্ডে ৫, কাটে ১০")। এখন মান সার্ভার থেকেই আসে,
        // আর কোনোটাই হার্ডকড নয়।
        const resolvedTiers =
          parseTiers(data) ??
          deriveTiers(mappedModels, data.quickSetup, Number(data.testChatMultiplier) || 1);

        if (resolvedTiers) {
          setTiers(resolvedTiers);
        } else {
          console.error(
            "[OPENROUTER_MODELS_CLIENT] tiers পাওয়া যায়নি — কার্ডে প্লেসহোল্ডার মান দেখানো হচ্ছে"
          );
        }
      } catch (error) {
        console.error("[OPENROUTER_MODELS_CLIENT]", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadModels();

    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => groupModels(models), [models]);

  return { models, grouped, tiers, loading };
}
