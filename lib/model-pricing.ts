/**
 * Per-model token pricing for cost calculation.
 *
 * Prices are in USD per token (from OpenRouter — no markup at provider level).
 * We track actual cost internally and charge customers a simple per-message rate.
 */

export interface ModelPricing {
  model: string;
  inputPricePerToken: number;   // USD per token (input/prompt)
  outputPricePerToken: number;  // USD per token (output/completion)
}

/**
 * Pricing data from OpenRouter for supported models.
 * Source: https://openrouter.ai/models
 */
const MODEL_PRICING: Record<string, ModelPricing> = {
  "gemini-2.5-flash-lite": {
    model: "gemini-2.5-flash-lite",
    inputPricePerToken: 0.000000075,   // $0.075 / 1M tokens
    outputPricePerToken: 0.0000003,    // $0.30 / 1M tokens
  },
  "gemini-2.0-flash-lite-001": {
    model: "gemini-2.0-flash-lite-001",
    inputPricePerToken: 0.000000075,   // $0.075 / 1M tokens
    outputPricePerToken: 0.0000003,    // $0.30 / 1M tokens
  },
};

// Fallback pricing if model not found (use cheapest rates)
const FALLBACK_PRICING: ModelPricing = {
  model: "unknown",
  inputPricePerToken: 0.000000075,
  outputPricePerToken: 0.0000003,
};

/** Get pricing for a model. Returns fallback if model not found. */
export function getModelPricing(model: string): ModelPricing {
  return MODEL_PRICING[model] ?? FALLBACK_PRICING;
}

/**
 * Calculate actual API cost in USD for a single interaction.
 * This is the raw cost — what OpenRouter charges us.
 */
export function calculateActualCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = getModelPricing(model);
  return (
    promptTokens * pricing.inputPricePerToken +
    completionTokens * pricing.outputPricePerToken
  );
}
