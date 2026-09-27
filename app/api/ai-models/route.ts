import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";

const DEFAULT_ACTIVE_MODELS = [
  {
    id: "google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    tier: "Standard",
    credits: 1,
    contextWindow: 1000000,
    maxTokens: 8192,
    promptPrice: 0.1,
    completionPrice: 0.4,
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    tier: "Standard",
    credits: 3,
    contextWindow: 128000,
    maxTokens: 4096,
    promptPrice: 0.15,
    completionPrice: 0.6,
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    tier: "Premium",
    credits: 5,
    contextWindow: 128000,
    maxTokens: 4096,
    promptPrice: 2.5,
    completionPrice: 10.0,
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    tier: "Premium",
    credits: 5,
    contextWindow: 200000,
    maxTokens: 4096,
    promptPrice: 3.0,
    completionPrice: 15.0,
  },
  {
    id: "deepseek/deepseek-chat",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    tier: "Economy",
    credits: 1,
    contextWindow: 64000,
    maxTokens: 4096,
    promptPrice: 0.14,
    completionPrice: 0.28,
  },
];

const DEFAULT_QUICK_SETUP = {
  fastModel: "google/gemini-2.0-flash-001",
  smartModel: "openai/gpt-4o-mini",
  geniusModel: "openai/gpt-4o",
};

export async function GET() {
  try {
    const setting = (db as any).platformSetting
      ? await (db as any).platformSetting.findUnique({
          where: { key: "ai_credit_rules" },
        })
      : null;

    let rawModels = DEFAULT_ACTIVE_MODELS;
    let quickSetup = DEFAULT_QUICK_SETUP;

    if (setting?.value) {
      const val = setting.value as Record<string, unknown>;
      if (Array.isArray(val.models) && val.models.length > 0) {
        rawModels = val.models as typeof DEFAULT_ACTIVE_MODELS;
      }
      if (val.quickSetup) {
        quickSetup = { ...quickSetup, ...(val.quickSetup as typeof DEFAULT_QUICK_SETUP) };
      }
    }

    // Strict Filter: Only models satisfying (isMerchantActive === true && isDeprecated !== true)
    const activeModels = rawModels
      .filter((m: any) => m.isMerchantActive === true && m.isDeprecated !== true)
      .map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        provider: m.provider || "OpenAI",
        tier: m.tier || "Standard",
        credits: m.credits || 1,
        contextWindow: m.contextWindow || 128000,
        maxTokens: m.maxTokens || 4096,
        promptPrice: m.promptPrice || 0,
        completionPrice: m.completionPrice || 0,
      }));

    // If all models were filtered out, fallback to default active list
    const finalModels = activeModels.length > 0 ? activeModels : DEFAULT_ACTIVE_MODELS;

    return NextResponse.json({
      success: true,
      models: finalModels,
      quickSetup,
    });
  } catch (error) {
    console.error("[API_ACTIVE_AI_MODELS_GET]", error);
    return NextResponse.json({
      success: true,
      models: DEFAULT_ACTIVE_MODELS,
      quickSetup: DEFAULT_QUICK_SETUP,
    });
  }
}
