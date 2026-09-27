import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";

const DEFAULT_MODELS_CATALOG = [
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "Google",
    tier: "Economy",
    promptPrice: 0.075,
    completionPrice: 0.3,
    credits: 1,
    isMerchantActive: true,
    contextWindow: 1000000,
    maxTokens: 4096,
    temperature: 0.7,
  },
  {
    id: "google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    tier: "Standard",
    promptPrice: 0.1,
    completionPrice: 0.4,
    credits: 1,
    isMerchantActive: true,
    contextWindow: 1000000,
    maxTokens: 8192,
    temperature: 0.7,
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    tier: "Standard",
    promptPrice: 0.15,
    completionPrice: 0.6,
    credits: 3,
    isMerchantActive: true,
    contextWindow: 128000,
    maxTokens: 4096,
    temperature: 0.7,
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    tier: "Premium",
    promptPrice: 2.5,
    completionPrice: 10.0,
    credits: 5,
    isMerchantActive: true,
    contextWindow: 128000,
    maxTokens: 4096,
    temperature: 0.7,
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    tier: "Premium",
    promptPrice: 3.0,
    completionPrice: 15.0,
    credits: 5,
    isMerchantActive: true,
    contextWindow: 200000,
    maxTokens: 4096,
    temperature: 0.7,
  },
  {
    id: "deepseek/deepseek-chat",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    tier: "Economy",
    promptPrice: 0.14,
    completionPrice: 0.28,
    credits: 1,
    isMerchantActive: true,
    contextWindow: 64000,
    maxTokens: 4096,
    temperature: 0.7,
  },
];

const DEFAULT_AI_SETTINGS = {
  quickSetup: {
    fastModel: "google/gemini-2.5-flash-lite",
    smartModel: "openai/gpt-4o-mini",
    geniusModel: "openai/gpt-4o",
  },
  models: DEFAULT_MODELS_CATALOG,
  minCreditThreshold: 50,
  defaultProvider: "gemini",
  testChatMultiplier: 2,
};

export async function GET() {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    // Fetch from PlatformSetting table safely if initialized
    const setting = (db as any).platformSetting
      ? await (db as any).platformSetting.findUnique({
          where: { key: "ai_credit_rules" },
        })
      : null;

    if (!setting || !setting.value) {
      return NextResponse.json(DEFAULT_AI_SETTINGS);
    }

    const saved = setting.value as Record<string, unknown>;
    const rawModels = Array.isArray(saved.models) && saved.models.length > 0
      ? saved.models
      : DEFAULT_MODELS_CATALOG;

    const sanitizedModels = rawModels.map((m: any) =>
      m.isDeprecated ? { ...m, isMerchantActive: false } : m
    );

    const merged = {
      quickSetup: {
        ...DEFAULT_AI_SETTINGS.quickSetup,
        ...((saved.quickSetup as Record<string, string>) || {}),
      },
      models: sanitizedModels,
      minCreditThreshold: typeof saved.minCreditThreshold === "number"
        ? saved.minCreditThreshold
        : DEFAULT_AI_SETTINGS.minCreditThreshold,
      defaultProvider: typeof saved.defaultProvider === "string"
        ? saved.defaultProvider
        : DEFAULT_AI_SETTINGS.defaultProvider,
      testChatMultiplier: typeof saved.testChatMultiplier === "number"
        ? saved.testChatMultiplier
        : DEFAULT_AI_SETTINGS.testChatMultiplier,
    };

    return NextResponse.json(merged);
  } catch (error) {
    console.error("[ADMIN_AI_SETTINGS_GET]", error);
    return NextResponse.json(DEFAULT_AI_SETTINGS);
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();

    const rawModels = Array.isArray(body.models) ? body.models : DEFAULT_MODELS_CATALOG;
    const sanitizedModels = rawModels.map((m: any) =>
      m.isDeprecated ? { ...m, isMerchantActive: false } : m
    );

    const settingValue = {
      quickSetup: body.quickSetup ?? DEFAULT_AI_SETTINGS.quickSetup,
      models: sanitizedModels,
      minCreditThreshold: typeof body.minCreditThreshold === "number"
        ? body.minCreditThreshold
        : DEFAULT_AI_SETTINGS.minCreditThreshold,
      defaultProvider: body.defaultProvider ?? DEFAULT_AI_SETTINGS.defaultProvider,
      testChatMultiplier: typeof body.testChatMultiplier === "number"
        ? body.testChatMultiplier
        : DEFAULT_AI_SETTINGS.testChatMultiplier,
      updatedAt: new Date().toISOString(),
    };

    if (!(db as any).platformSetting) {
      return NextResponse.json({
        success: true,
        settings: settingValue,
        warning: "DB client updating",
      });
    }

    const updatedSetting = await (db as any).platformSetting.upsert({
      where: { key: "ai_credit_rules" },
      update: { value: settingValue },
      create: {
        key: "ai_credit_rules",
        value: settingValue,
      },
    });

    return NextResponse.json({
      success: true,
      settings: updatedSetting.value,
    });
  } catch (error) {
    console.error("[ADMIN_AI_SETTINGS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export { POST as PUT };
