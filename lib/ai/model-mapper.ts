import {
  getCreditCostByModel,
  getModelTier,
  MODEL_TIER_MAP,
  type ModelTier,
} from "@/lib/domain/credit-config";

/**
 * Model Tier Mapping — Driplare AI
 *
 * Single source of truth that resolves a chatbot's selected model into the
 * exact OpenRouter model identifier + credit cost used at execution time.
 *
 * Two prompt modes are supported:
 *  - "simple": the UI stores a quality tier key (`fast` / `smart` / `genius`)
 *    OR a model string. The mapper normalizes both into a concrete model.
 *  - "pro":    the UI stores the exact OpenRouter model ID (e.g.
 *    `google/gemini-2.0-flash-001`). The mapper resolves its credit cost from
 *    the central credit-config tier map.
 *
 * All model IDs below are active, valid OpenRouter endpoint slugs.
 */

export type ResolvedModelConfig = {
  /** Exact OpenRouter model identifier sent to n8n / OpenRouter. */
  modelId: string;
  /** Base credit cost per reply (economy=1, standard=3, premium=5). */
  credits: number;
  /** Credit tier derived from the central MODEL_TIER_MAP. */
  tier: ModelTier;
};

/**
 * Simple-mode quality tiers → concrete OpenRouter models.
 * These are the exact mappings required by the product spec.
 */
export const SIMPLE_TIER_MAP: Record<string, ResolvedModelConfig> = {
  fast: {
    modelId: "google/gemini-flash-1.5-8b",
    credits: 1,
    tier: "economy",
  },
  smart: {
    modelId: "google/gemini-2.0-flash-001",
    credits: 3,
    tier: "standard",
  },
  genius: {
    modelId: "anthropic/claude-3.5-sonnet:beta",
    credits: 5,
    tier: "premium",
  },
};

/** Ordered list of simple-mode tier keys (used for lookups / UI iteration). */
export const SIMPLE_TIER_KEYS = Object.keys(SIMPLE_TIER_MAP);

/** Default fallback when nothing is selected — the "smart" tier. */
export const DEFAULT_RESOLVED_MODEL = SIMPLE_TIER_MAP.smart;

/**
 * Resolve a model string (e.g. `google/gemini-2.0-flash-001`) into its credit
 * config using the central credit-config tier map.
 *
 * Fallback guard: unknown / invalid model strings are safely defaulted to
 * `google/gemini-2.0-flash-001` (the "smart" tier) instead of being forwarded
 * to n8n / OpenRouter with a broken slug.
 */
function resolveModelString(modelId: string): ResolvedModelConfig {
  const trimmed = modelId.trim();

  // Fallback guard — only accept slugs registered in the central tier map.
  if (!MODEL_TIER_MAP[trimmed]) {
    return DEFAULT_RESOLVED_MODEL;
  }

  return {
    modelId: trimmed,
    credits: getCreditCostByModel(trimmed),
    tier: getModelTier(trimmed),
  };
}

/**
 * Resolve the effective model + credit cost for a chatbot at execution time.
 *
 * @param promptMode          - `"simple"` (guided tiers) or `"pro"` (exact model).
 * @param selectedTierOrModel - Simple mode: tier key (`fast`/`smart`/`genius`)
 *                              or a model string. Pro mode: exact OpenRouter ID.
 * @returns The resolved `{ modelId, credits, tier }` config.
 */
export function resolveModelConfig(
  promptMode: string,
  selectedTierOrModel: string
): ResolvedModelConfig {
  const value = (selectedTierOrModel ?? "").trim();

  if (promptMode === "simple") {
    // Direct tier key mapping (fast / smart / genius).
    if (SIMPLE_TIER_MAP[value]) {
      return SIMPLE_TIER_MAP[value];
    }
    // Legacy / direct model string (e.g. google/gemini-flash-1.5-8b).
    if (value) {
      return resolveModelString(value);
    }
    // Nothing selected → safe default.
    return DEFAULT_RESOLVED_MODEL;
  }

  // Pro mode — the exact OpenRouter model ID is stored on the chatbot.
  if (value) {
    return resolveModelString(value);
  }
  return DEFAULT_RESOLVED_MODEL;
}

/**
 * Map a concrete model ID back to its simple-mode tier key.
 * Returns `"smart"` when the model is not one of the three guided tiers.
 */
export function resolveSimpleTierKey(modelId: string): string {
  const id = (modelId ?? "").trim();
  for (const [key, config] of Object.entries(SIMPLE_TIER_MAP)) {
    if (config.modelId === id) return key;
  }
  return "smart";
}