"use client";

import { useEffect, useMemo, useState } from "react";

export type UiModelTier = "economy" | "standard" | "premium";
export type UiProviderName = "OpenAI" | "Anthropic" | "Google" | "Meta" | "DeepSeek";
export type UiTierKey = "fast" | "smart" | "genius";

export type UiChatModelConfig = {
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

export type UiResolvedModelConfig = {
  modelId: string;
  credits: number;
  tier: UiModelTier;
};

type OpenRouterModelsResponse = {
  models?: UiChatModelConfig[];
  grouped?: Record<UiProviderName, UiChatModelConfig[]>;
  tiers?: Record<UiTierKey, UiResolvedModelConfig>;
};

const PROVIDERS: UiProviderName[] = ["OpenAI", "Anthropic", "Google", "Meta", "DeepSeek"];

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

const FALLBACK_TIERS: Record<UiTierKey, UiResolvedModelConfig> = {
  fast: { modelId: "google/gemini-2.0-flash-001", credits: 1, tier: "economy" },
  smart: { modelId: "anthropic/claude-3.5-sonnet", credits: 5, tier: "premium" },
  genius: { modelId: "anthropic/claude-3.5-sonnet", credits: 5, tier: "premium" },
};

function groupModels(models: UiChatModelConfig[]) {
  return PROVIDERS.reduce((acc, provider) => {
    acc[provider] = models.filter((model) => model.providerName === provider);
    return acc;
  }, {} as Record<UiProviderName, UiChatModelConfig[]>);
}

export function getModelKey(model: UiChatModelConfig) {
  return `${model.provider}|${model.model}`;
}

export function getModelKeyFromId(modelId: string) {
  return `openrouter|${modelId}`;
}

export function useOpenRouterModels() {
  const [models, setModels] = useState<UiChatModelConfig[]>(FALLBACK_CHAT_MODELS);
  const [tiers, setTiers] = useState<Record<UiTierKey, UiResolvedModelConfig>>(FALLBACK_TIERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      try {
        const response = await fetch("/api/models/openrouter");
        if (!response.ok) throw new Error("Failed to load OpenRouter models");

        const data = (await response.json()) as OpenRouterModelsResponse;
        if (cancelled) return;

        if (Array.isArray(data.models) && data.models.length > 0) {
          setModels(data.models);
        }
        if (data.tiers) {
          setTiers(data.tiers);
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
