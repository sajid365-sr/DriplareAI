import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";

const WHITELIST_PREFIXES = [
  "openai/",
  "anthropic/",
  "google/",
  "deepseek/",
  "meta-llama/",
];

const EXCLUDED_SUBSTRINGS = [
  ":batch",
  ":free",
  ":extended",
  ":floor",
  ":nitro",
  "stealth/",
  "-exp",
  "exp-",
  "experimental",
];

const FLAGSHIP_MODELS = [
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.0-flash-001",
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "anthropic/claude-3.5-sonnet",
  "deepseek/deepseek-chat",
  "meta-llama/llama-3.3-70b-instruct",
];

export async function GET() {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    // Fetch live model catalog from OpenRouter
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "User-Agent": "DriplareAI-Admin/1.0" },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      throw new Error(`OpenRouter API responded with status ${res.status}`);
    }

    const data = await res.json();
    const rawModels: any[] = data.data || [];

    // Filter by Whitelist & Exclusions
    const filteredRaw = rawModels.filter((item) => {
      if (!item.id || typeof item.id !== "string") return false;

      const isWhitelisted = WHITELIST_PREFIXES.some((prefix) =>
        item.id.toLowerCase().startsWith(prefix)
      );
      if (!isWhitelisted) return false;

      const isExcluded = EXCLUDED_SUBSTRINGS.some((sub) =>
        item.id.toLowerCase().includes(sub)
      );
      if (isExcluded) return false;

      return true;
    });

    // Sort: Flagships first, then by ID
    filteredRaw.sort((a, b) => {
      const aFlagIndex = FLAGSHIP_MODELS.indexOf(a.id);
      const bFlagIndex = FLAGSHIP_MODELS.indexOf(b.id);

      if (aFlagIndex !== -1 && bFlagIndex !== -1) return aFlagIndex - bFlagIndex;
      if (aFlagIndex !== -1) return -1;
      if (bFlagIndex !== -1) return 1;

      return a.id.localeCompare(b.id);
    });

    // Limit total returned models strictly to top 35 popular models
    const topModels = filteredRaw.slice(0, 35);

    // ── আগের সেটিংস আগেই পড়ে নিই ─────────────────────────────────────────
    // দুই কারণে দরকার:
    //   ১. admin হাতে বসানো credit যেন এই sync মুছে না ফেলে
    //   ২. quickSetup / minCreditThreshold / testChatMultiplier অটুট রাখা
    let existingValue: any = {};
    if ((db as any).platformSetting) {
      const current = await (db as any).platformSetting.findUnique({
        where: { key: "ai_credit_rules" },
      });
      if (current && current.value) existingValue = current.value;
    }

    // modelId → আগের credit। admin হাতে যা বসিয়েছেন সেটাই জেতে।
    const previousCredits = new Map<string, number>();
    if (Array.isArray(existingValue.models)) {
      for (const prev of existingValue.models) {
        if (
          prev &&
          typeof prev.id === "string" &&
          typeof prev.credits === "number" &&
          Number.isFinite(prev.credits) &&
          prev.credits > 0
        ) {
          previousCredits.set(prev.id, prev.credits);
        }
      }
    }

    // Transform and calculate auto-credits
    const models = topModels.map((item: any) => {
      const promptCostPerM = parseFloat(item.pricing?.prompt || "0") * 1000000;
      const completionCostPerM = parseFloat(item.pricing?.completion || "0") * 1000000;
      const avgCostPerM = (promptCostPerM + completionCostPerM) / 2;

      let autoCredits = 1;
      let tier: "Economy" | "Standard" | "Premium" = "Economy";

      if (avgCostPerM > 3.0) {
        autoCredits = 5;
        tier = "Premium";
      } else if (avgCostPerM >= 0.5) {
        autoCredits = 3;
        tier = "Standard";
      }

      const providerRaw = item.id.split("/")[0] || "OpenRouter";
      let providerFormatted =
        providerRaw.charAt(0).toUpperCase() + providerRaw.slice(1);
      if (providerRaw === "openai") providerFormatted = "OpenAI";
      if (providerRaw === "meta-llama") providerFormatted = "Meta Llama";

      // ⚠️ admin হাতে যে credit বসিয়েছেন সেটাই থাকবে — "Fetch Models" চাপলেই
      //    তার পরিশ্রম মুছে যাওয়া চলবে না। autoCredits কেবল তখনই খাটে, যখন
      //    ওই মডেলের মান admin কখনো সেট করেননি।
      const credits = previousCredits.get(item.id) ?? autoCredits;

      return {
        id: item.id,
        name: item.name || item.id,
        provider: providerFormatted,
        tier,
        promptPrice: promptCostPerM,
        completionPrice: completionCostPerM,
        credits,
        isMerchantActive: true,
        contextWindow: item.context_length || 128000,
        maxTokens: 4096,
        temperature: 0.7,
      };
    });

    const updatedValue = {
      quickSetup: existingValue.quickSetup || {
        fastModel: models[0]?.id || "google/gemini-2.5-flash-lite",
        smartModel: models[2]?.id || "openai/gpt-4o-mini",
        geniusModel: models[3]?.id || "openai/gpt-4o",
      },
      models,
      minCreditThreshold: existingValue.minCreditThreshold ?? 50,
      defaultProvider: existingValue.defaultProvider ?? "gemini",
      // ⚠️ এখানে আগে হার্ডকড `?? 2` ছিল। ওই একটা সংখ্যাই নীরবে সব credit
      //    দ্বিগুণ করত ("কার্ডে ৫, কাটে ১০")। গুণকের একমাত্র default এখন
      //    `credit-config.ts`-এর `test_chat_multiplier` = ১।
      testChatMultiplier: existingValue.testChatMultiplier ?? 1,
      updatedAt: new Date().toISOString(),
    };

    // Save to Database
    if ((db as any).platformSetting) {
      await (db as any).platformSetting.upsert({
        where: { key: "ai_credit_rules" },
        update: { value: updatedValue },
        create: {
          key: "ai_credit_rules",
          value: updatedValue,
        },
      });
    }

    return NextResponse.json({
      success: true,
      total: models.length,
      models,
      quickSetup: updatedValue.quickSetup,
    });
  } catch (error) {
    console.error("[FETCH_OPENROUTER_MODELS_ERROR]", error);
    return NextResponse.json(
      { error: "Could not fetch models from OpenRouter." },
      { status: 500 }
    );
  }
}
