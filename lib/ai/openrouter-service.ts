import { unstable_cache } from "next/cache";
import "server-only";

import { getCreditCostByTier, type ModelTier } from "@/lib/domain/credit-config";

export type TrustedOpenRouterProvider = "OpenAI" | "Anthropic" | "Google" | "Meta" | "DeepSeek";

export type OpenRouterModel = {
  id: string;
  name?: string;
  canonical_slug?: string;
  created?: number;
  description?: string;
  context_length?: number;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
    modality?: string;
    tokenizer?: string;
    instruct_type?: string | null;
  };
  pricing?: {
    prompt?: string;
    completion?: string;
    request?: string;
    image?: string;
    web_search?: string;
    internal_reasoning?: string;
    input_cache_read?: string;
    input_cache_write?: string;
  };
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number | null;
    is_moderated?: boolean;
  };
  supported_parameters?: string[];
  expiration_date?: string | null;
};

export type ChatModelConfig = {
  provider: string;
  providerName: TrustedOpenRouterProvider;
  model: string;
  label: string;
  openRouterModel: string;
  tier: ModelTier;
  credits: number;
  note?: string;
  contextLength?: number;
  created?: number;
};

export type ResolvedModelConfig = {
  /** Exact active OpenRouter model identifier sent to n8n / OpenRouter. */
  modelId: string;
  /** Base credit cost per reply (economy=1, standard=3, premium=5). */
  credits: number;
  /** Credit tier used for billing. */
  tier: ModelTier;
};

export type DynamicTierKey = "fast" | "smart" | "genius";

export type OpenRouterModelPayload = {
  models: ChatModelConfig[];
  grouped: Record<TrustedOpenRouterProvider, ChatModelConfig[]>;
  tiers: Record<DynamicTierKey, ResolvedModelConfig>;
};

const REVALIDATE_12_HOURS = 60 * 60 * 12;

const PROVIDER_ORDER: TrustedOpenRouterProvider[] = ["OpenAI", "Anthropic", "Google", "Meta", "DeepSeek"];

const DATED_SNAPSHOT_PATTERN = /-(?:\d{4}-\d{2}-\d{2}|\d{8})(?=$|:)/;
const UNWANTED_MODEL_PATTERN = /\b(batch|experimental|experiment|preview|beta|alpha|test|free|trial)\b|:free/i;

const CURATED_MODEL_LABELS: Record<string, string> = {
  "openai/gpt-4o": "GPT-4o",
  "openai/gpt-4o-mini": "GPT-4o Mini",
  "openai/o1": "OpenAI o1",
  "openai/o1-mini": "OpenAI o1 Mini",
  "openai/o3-mini": "OpenAI o3 Mini",
  "anthropic/claude-3.5-sonnet": "Claude 3.5 Sonnet",
  "anthropic/claude-3.5-haiku": "Claude 3.5 Haiku",
  "anthropic/claude-3-opus": "Claude 3 Opus",
  "google/gemini-2.0-flash-001": "Gemini 2.0 Flash",
  "google/gemini-1.5-pro": "Gemini 1.5 Pro",
  "google/gemini-1.5-flash": "Gemini 1.5 Flash",
  "meta-llama/llama-3.3-70b-instruct": "Llama 3.3 70B Instruct",
  "deepseek/deepseek-r1": "DeepSeek R1",
  "deepseek/deepseek-chat": "DeepSeek V3",
};

const CURATED_MODEL_ORDER = Object.keys(CURATED_MODEL_LABELS);

const FALLBACK_MODELS: ChatModelConfig[] = [
  {
    provider: "openrouter",
    providerName: "Google",
    model: "google/gemini-2.0-flash-001",
    label: "Gemini 2.0 Flash",
    openRouterModel: "google/gemini-2.0-flash-001",
    tier: "economy",
    credits: getCreditCostByTier("economy"),
    note: "Fast trusted fallback model",
  },
  {
    provider: "openrouter",
    providerName: "OpenAI",
    model: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    openRouterModel: "openai/gpt-4o-mini",
    tier: "economy",
    credits: getCreditCostByTier("economy"),
    note: "Fast OpenAI fallback model",
  },
  {
    provider: "openrouter",
    providerName: "OpenAI",
    model: "openai/o3-mini",
    label: "OpenAI o3 Mini",
    openRouterModel: "openai/o3-mini",
    tier: "premium",
    credits: getCreditCostByTier("premium"),
    note: "Compact reasoning fallback model",
  },
  {
    provider: "openrouter",
    providerName: "Anthropic",
    model: "anthropic/claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet",
    openRouterModel: "anthropic/claude-3.5-sonnet",
    tier: "premium",
    credits: getCreditCostByTier("premium"),
    note: "Balanced Anthropic fallback model",
  },
  {
    provider: "openrouter",
    providerName: "OpenAI",
    model: "openai/gpt-4o",
    label: "GPT-4o",
    openRouterModel: "openai/gpt-4o",
    tier: "premium",
    credits: getCreditCostByTier("premium"),
    note: "High-intelligence fallback model",
  },
  {
    provider: "openrouter",
    providerName: "Meta",
    model: "meta-llama/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B Instruct",
    openRouterModel: "meta-llama/llama-3.3-70b-instruct",
    tier: "standard",
    credits: getCreditCostByTier("standard"),
    note: "Trusted Meta fallback model",
  },
  {
    provider: "openrouter",
    providerName: "DeepSeek",
    model: "deepseek/deepseek-chat",
    label: "DeepSeek V3",
    openRouterModel: "deepseek/deepseek-chat",
    tier: "standard",
    credits: getCreditCostByTier("standard"),
    note: "Efficient DeepSeek fallback model",
  },
  {
    provider: "openrouter",
    providerName: "DeepSeek",
    model: "deepseek/deepseek-r1",
    label: "DeepSeek R1",
    openRouterModel: "deepseek/deepseek-r1",
    tier: "premium",
    credits: getCreditCostByTier("premium"),
    note: "Reasoning DeepSeek fallback model",
  },
];

function getProviderName(modelId: string): TrustedOpenRouterProvider | null {
  if (/^google\/gemini-/i.test(modelId)) return "Google";
  if (/^openai\/(?:gpt-|o1|o3)/i.test(modelId)) return "OpenAI";
  if (/^anthropic\/claude-/i.test(modelId)) return "Anthropic";
  if (/^meta-llama\/llama-3\.3-/i.test(modelId)) return "Meta";
  if (/^deepseek\/deepseek-/i.test(modelId)) return "DeepSeek";
  return null;
}

function normalizeSnapshotId(modelId: string) {
  return modelId.replace(DATED_SNAPSHOT_PATTERN, "");
}

function canonicalizeCuratedModelId(modelId: string): string | null {
  const id = normalizeSnapshotId(modelId.toLowerCase());

  if (id === "openai/gpt-4o" || id === "openai/gpt-4o-mini") return id;
  if (id === "openai/o1" || id === "openai/o1-mini" || id === "openai/o3-mini") return id;

  if (/^anthropic\/claude-3(?:\.|-)?5-sonnet$/.test(id)) return "anthropic/claude-3.5-sonnet";
  if (/^anthropic\/claude-3(?:\.|-)?5-haiku$/.test(id)) return "anthropic/claude-3.5-haiku";
  if (id === "anthropic/claude-3-opus") return id;

  if (id === "google/gemini-2.0-flash-001") return id;
  if (id === "google/gemini-pro-1.5") return "google/gemini-1.5-pro";
  if (id === "google/gemini-flash-1.5") return "google/gemini-1.5-flash";
  if (id === "google/gemini-1.5-pro" || id === "google/gemini-1.5-flash") return id;

  if (id === "meta-llama/llama-3.3-70b-instruct") return id;

  if (id === "deepseek/deepseek-r1") return id;
  if (id === "deepseek/deepseek-chat" || id === "deepseek/deepseek-chat-v3") return "deepseek/deepseek-chat";

  return null;
}

function isUnwantedModelVariant(model: OpenRouterModel): boolean {
  const searchable = `${model.id} ${model.name || ""}`;
  return UNWANTED_MODEL_PATTERN.test(searchable);
}

function sanitizeDisplayName(model: OpenRouterModel, canonicalId: string) {
  const fallback = CURATED_MODEL_LABELS[canonicalId] || canonicalId;
  const rawName = model.name || fallback;

  return rawName
    .replace(/\s*\([^)]*\d{4}[^)]*\)\s*/g, " ")
    .replace(/\s*\[[^\]]*(?:\d{4}|preview|beta|free|experimental)[^\]]*\]\s*/gi, " ")
    .replace(DATED_SNAPSHOT_PATTERN, "")
    .replace(/\s*[:|-]\s*(?:preview|beta|free|experimental|test)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim() || fallback;
}

function isActiveTextModel(model: OpenRouterModel): boolean {
  if (!model.id || model.expiration_date) return false;

  const outputModalities = model.architecture?.output_modalities;
  if (Array.isArray(outputModalities) && outputModalities.length > 0) {
    return outputModalities.includes("text");
  }

  return true;
}

export function getDynamicModelTier(modelId: string): ModelTier {
  const id = modelId.toLowerCase();

  if (id.includes("deepseek-r1") || /^openai\/o[13]/.test(id)) {
    return "premium";
  }

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

function formatNote(model: OpenRouterModel, tier: ModelTier): string {
  const context = model.context_length ? `${Math.round(model.context_length / 1000)}k context` : null;
  const tierLabel = tier === "economy" ? "Fast" : tier === "premium" ? "High intelligence" : "Balanced";
  return [tierLabel, context].filter(Boolean).join(" • ");
}

function toChatModelConfig(model: OpenRouterModel): ChatModelConfig | null {
  const providerName = getProviderName(model.id);
  const canonicalId = canonicalizeCuratedModelId(model.id);
  if (!providerName || !canonicalId || !isActiveTextModel(model) || isUnwantedModelVariant(model)) return null;

  const tier = getDynamicModelTier(canonicalId);
  return {
    provider: "openrouter",
    providerName,
    model: model.id,
    label: sanitizeDisplayName(model, canonicalId),
    openRouterModel: model.id,
    tier,
    credits: getCreditCostByTier(tier),
    note: formatNote(model, tier),
    contextLength: model.context_length,
    created: model.created,
  };
}

function compareModels(a: ChatModelConfig, b: ChatModelConfig): number {
  const aOrder = CURATED_MODEL_ORDER.indexOf(canonicalizeCuratedModelId(a.openRouterModel) || a.openRouterModel);
  const bOrder = CURATED_MODEL_ORDER.indexOf(canonicalizeCuratedModelId(b.openRouterModel) || b.openRouterModel);
  if (aOrder !== bOrder) return aOrder - bOrder;

  return a.label.localeCompare(b.label);
}

function isCleanAlias(model: ChatModelConfig) {
  return !DATED_SNAPSHOT_PATTERN.test(model.openRouterModel);
}

function dedupeCuratedModels(models: ChatModelConfig[]) {
  const byCanonicalId = new Map<string, ChatModelConfig>();

  for (const model of models) {
    const canonicalId = canonicalizeCuratedModelId(model.openRouterModel);
    if (!canonicalId) continue;

    const existing = byCanonicalId.get(canonicalId);
    if (!existing) {
      byCanonicalId.set(canonicalId, model);
      continue;
    }

    const preferCurrent =
      (isCleanAlias(model) && !isCleanAlias(existing)) ||
      ((model.created || 0) > (existing.created || 0) && isCleanAlias(model) === isCleanAlias(existing));

    if (preferCurrent) {
      byCanonicalId.set(canonicalId, model);
    }
  }

  return Array.from(byCanonicalId.values()).sort(compareModels);
}

async function fetchOpenRouterModels(): Promise<ChatModelConfig[]> {
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: {
      Accept: "application/json",
    },
    next: { revalidate: REVALIDATE_12_HOURS },
  });

  if (!response.ok) {
    throw new Error(`OpenRouter models request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { data?: OpenRouterModel[] };
  const models = Array.isArray(payload.data) ? payload.data : [];
  const seen = new Set<string>();

  return dedupeCuratedModels(models
    .map(toChatModelConfig)
    .filter((model): model is ChatModelConfig => {
      if (!model || seen.has(model.openRouterModel)) return false;
      seen.add(model.openRouterModel);
      return true;
    }));
}

const getCachedOpenRouterModels = unstable_cache(
  fetchOpenRouterModels,
  ["openrouter-live-curated-models-v2"],
  { revalidate: REVALIDATE_12_HOURS }
);

export async function getTrustedOpenRouterModels(): Promise<ChatModelConfig[]> {
  try {
    const models = await getCachedOpenRouterModels();
    return models.length > 0 ? models : FALLBACK_MODELS;
  } catch (error) {
    console.error("[OPENROUTER_MODELS_FETCH_ERROR]", error);
    return FALLBACK_MODELS;
  }
}

export function groupOpenRouterModels(models: ChatModelConfig[]) {
  return PROVIDER_ORDER.reduce((acc, provider) => {
    acc[provider] = models.filter((model) => model.providerName === provider);
    return acc;
  }, {} as Record<TrustedOpenRouterProvider, ChatModelConfig[]>);
}

function pickPreferredModel(models: ChatModelConfig[], preferredIds: string[], fallbackTier: ModelTier) {
  for (const id of preferredIds) {
    const exact = models.find((model) => model.openRouterModel === id);
    if (exact) return exact;
  }

  return (
    models.find((model) => model.tier === fallbackTier) ||
    models.find((model) => model.tier === "standard") ||
    models[0] ||
    FALLBACK_MODELS[0]
  );
}

export function buildDynamicTierMap(models: ChatModelConfig[]): Record<DynamicTierKey, ResolvedModelConfig> {
  const source = models.length > 0 ? models : FALLBACK_MODELS;
  const fast = pickPreferredModel(source, ["google/gemini-2.0-flash-001", "openai/gpt-4o-mini"], "economy");
  const smart = pickPreferredModel(
    source,
    ["anthropic/claude-3.5-sonnet", "openai/gpt-4o", "google/gemini-1.5-pro", "deepseek/deepseek-chat"],
    "standard"
  );
  const genius = pickPreferredModel(
    source,
    ["openai/o1", "openai/o3-mini", "deepseek/deepseek-r1", "anthropic/claude-3-opus"],
    "premium"
  );

  return {
    fast: { modelId: fast.openRouterModel, credits: fast.credits, tier: fast.tier },
    smart: { modelId: smart.openRouterModel, credits: smart.credits, tier: smart.tier },
    genius: { modelId: genius.openRouterModel, credits: genius.credits, tier: genius.tier },
  };
}

export async function getOpenRouterModelPayload(): Promise<OpenRouterModelPayload> {
  const models = await getTrustedOpenRouterModels();

  return {
    models,
    grouped: groupOpenRouterModels(models),
    tiers: buildDynamicTierMap(models),
  };
}
