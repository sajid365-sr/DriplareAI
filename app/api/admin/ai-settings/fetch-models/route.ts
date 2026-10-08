import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";
import { sanitizeUsdToBdtRate } from "@/lib/domain/credit-config";
import {
  isActiveModel,
  validateModelCatalog,
  type CatalogModelShape,
} from "@/lib/domain/model-catalog";

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

/** OpenRouter থেকে একবারে কতগুলো মডেল আনা হয় (flagship আগে, বাকিগুলো বর্ণানুক্রমে)। */
const FETCH_LIMIT = 35;

/**
 * DB-র `ai_credit_rules.models`-এ সংরক্ষিত একটা মডেল।
 *
 * ⚠️ এটা ইচ্ছে করেই আংশিক: এই route কেবল admin-এর হাতে বসানো ঘরগুলোর
 *    (`credits`, `tier`, toggle) উপর হাত দেয়, বাকি সব ফিল্ড হুবহু আগের মতোই
 *    এগিয়ে যায়। তাই বাকিগুলো index signature-এ ছেড়ে দেওয়া।
 */
interface StoredModel extends CatalogModelShape {
  credits?: number;
  tier?: "Economy" | "Standard" | "Premium";
  isManualOverride?: boolean;
  [key: string]: unknown;
}

/**
 * DB থেকে পড়া মান সত্যিই একটা মডেল কি না — `any` ছাড়াই যাচাই।
 *
 * করাপ্ট বা হাতে বানানো row-তে `id` ছাড়া এন্ট্রি থাকলে সেটা বাদ পড়ে, নাহলে
 * `Map`-এ `undefined` key ঢুকে পুরো sync-টা অর্থহীন হয়ে যেত।
 */
function isStoredModel(value: unknown): value is StoredModel {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string"
  );
}

export async function GET() {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    // Fetch live model catalog from OpenRouter
    //
    // ⚠️ এখানে আগে `revalidate: 3600` ছিল — অর্থাৎ এক ঘণ্টার মধ্যে "Fetch
    //    OpenRouter Models" বারবার চাপলে হুবহু একই ক্যাশড তালিকা ফিরত, আর
    //    বাটনটা কিছুই করছে না বলে মনে হত। এটা তো হাতে চালানো sync, তাই
    //    পাঁচ মিনিটই যথেষ্ট — তার মধ্যেই OpenRouter-কে বারবার আঘাত করা বন্ধ
    //    করে, আবার admin-এর চাপার সাথে সাথে সত্যিকারের উত্তরও আসে।
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "User-Agent": "DriplareAI-Admin/1.0" },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`OpenRouter API responded with status ${res.status}`);
    }

    const data = await res.json();
    const rawModels: any[] = Array.isArray(data?.data) ? data.data : [];

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

    const topModels = filteredRaw.slice(0, FETCH_LIMIT);

    // ── আগের সেটিংস আগেই পড়ে নিই ─────────────────────────────────────────
    // দুই কারণে দরকার:
    //   ১. admin হাতে বসানো credit / tier / Merchant Active যেন এই sync মুছে না ফেলে
    //   ২. quickSetup / minCreditThreshold / testChatMultiplier / usdToBdtRate অটুট রাখা
    let existingValue: any = {};
    if ((db as any).platformSetting) {
      const current = await (db as any).platformSetting.findUnique({
        where: { key: "ai_credit_rules" },
      });
      if (current && current.value) existingValue = current.value;
    }

    // modelId → আগের এন্ট্রি। credit, tier, Merchant Active — তিনটাই এখান থেকেই
    // ফিরিয়ে আনা হয়, তাই একটার জন্য একটা করে Map রাখার দরকার নেই।
    const storedModels: unknown[] = Array.isArray(existingValue.models)
      ? existingValue.models
      : [];
    const previousById = new Map<string, StoredModel>(
      storedModels.filter(isStoredModel).map((m) => [m.id, m])
    );

    // Transform and calculate auto-credits
    const freshModels = topModels.map((item: any) => {
      const promptCostPerM = parseFloat(item.pricing?.prompt || "0") * 1000000;
      const completionCostPerM = parseFloat(item.pricing?.completion || "0") * 1000000;
      const avgCostPerM = (promptCostPerM + completionCostPerM) / 2;

      let autoCredits = 1;
      let autoTier: "Economy" | "Standard" | "Premium" = "Economy";

      if (avgCostPerM > 3.0) {
        autoCredits = 5;
        autoTier = "Premium";
      } else if (avgCostPerM >= 0.5) {
        autoCredits = 3;
        autoTier = "Standard";
      }

      const providerRaw = item.id.split("/")[0] || "OpenRouter";
      let providerFormatted =
        providerRaw.charAt(0).toUpperCase() + providerRaw.slice(1);
      if (providerRaw === "openai") providerFormatted = "OpenAI";
      if (providerRaw === "meta-llama") providerFormatted = "Meta Llama";

      const previous = previousById.get(item.id);
      const previousCredits = previous?.credits;
      const previousTier = previous?.tier;
      const previousActive = previous?.isMerchantActive;
      const previousManual = previous?.isManualOverride;

      // ⚠️ admin হাতে যে credit বসিয়েছেন সেটাই থাকবে — "Fetch Models" চাপলেই
      //    তার পরিশ্রম মুছে যাওয়া চলবে না। autoCredits কেবল তখনই খাটে, যখন
      //    ওই মডেলের মান admin কখনো সেট করেননি।
      const credits =
        typeof previousCredits === "number" &&
        Number.isFinite(previousCredits) &&
        previousCredits > 0
          ? previousCredits
          : autoCredits;

      // একই নিয়ম tier-এর ক্ষেত্রেও — ক্যাটালগে থাকা মডেলের tier অটুট থাকে,
      // দাম দেখে নতুন করে অনুমান করা হয় কেবল নতুন মডেলের জন্য।
      const tier =
        previousTier === "Economy" ||
        previousTier === "Standard" ||
        previousTier === "Premium"
          ? previousTier
          : autoTier;

      return {
        id: item.id,
        name: item.name || item.id,
        provider: providerFormatted,
        tier,
        promptPrice: promptCostPerM,
        completionPrice: completionCostPerM,
        credits,
        // ⚠️ আগে হার্ডকড `true` ছিল — admin-এর বন্ধ করা সব মডেল sync-এ ফিরে আসত।
        //    `??` (|| নয়) — কারণ `false`-ও একটা বৈধ, সংরক্ষণযোগ্য সিদ্ধান্ত।
        isMerchantActive: typeof previousActive === "boolean" ? previousActive : true,
        // মডেলটা এখন OpenRouter-এর লাইভ তালিকায় আছে — তাই deprecated নয়।
        // (আগে এই মুছে দেওয়ার কোনো উপায় ছিল না; কেবল "Validate Status" করত।)
        isDeprecated: false,
        isManualOverride: previousManual === true,
        contextWindow: item.context_length || 128000,
        maxTokens: 4096,
        temperature: 0.7,
      };
    });

    // ── আগের ক্যাটালগের বাকি মডেলগুলো ধরে রাখা ───────────────────────────────
    //
    // ⚠️ এখানে আগে কেবল `topModels`-ই ক্যাটালগ হয়ে যেত। মানে — top-35 থেকে
    //    পড়ে যাওয়া যেকোনো মডেল তার credit, tier, Merchant Active সব নিয়ে
    //    ক্যাটালগ থেকে **উবে যেত**। আর সাজানোটা বর্ণানুক্রমে হওয়ায় এটা নিয়মিতই
    //    ঘটে: নতুন কয়েকটা `anthropic/…` ঢুকলেই পিছন থেকে সমসংখ্যক
    //    `openai/…` বা `meta-llama/…` বাদ পড়ে। পরে সেটা আবার তালিকায় ফিরলে
    //    আগের বন্ধ-অবস্থা মনে থাকত না, ফলে admin-এর বন্ধ করা মডেল নিজে থেকেই
    //    চালু হয়ে যেত।
    //
    //    এখন এই route-এর কাজ কেবল **দাম হালনাগাদ করা আর নতুন মডেল যোগ করা** —
    //    মুছে ফেলা নয়। সত্যিই OpenRouter থেকে উঠে যাওয়া মডেল চিহ্নিত করার
    //    একমাত্র জায়গা "Validate Status", আর সেটাই সঠিক বিভাজন।
    const freshIds = new Set(freshModels.map((m) => m.id));
    const carriedOver = storedModels
      .filter((m): m is StoredModel => isStoredModel(m) && !freshIds.has(m.id))
      // ⚠️ `allowedPlans` এখন কোনো নিয়ম নয়, আর এই route-টা পুরো ক্যাটালগ
      //    নতুন করে লেখে — তাই ধরে রাখা মডেলের গায়ে লেগে থাকা ডেড ফিল্ডটা
      //    এখানেই ঝরে যায়। (একই কাজ `POST`-ও করে; আলাদা migration লাগে না।)
      .map((m) => {
        const row = { ...m };
        delete row.allowedPlans;
        return row;
      });

    const models = [...freshModels, ...carriedOver];

    // ── প্রিসেট ──────────────────────────────────────────────────────────────
    // আগের প্রিসেট অটুট থাকে। নতুন ইনস্টলে ভরসা করা হয় **active** মডেলের উপর —
    // নাহলে এমন মডেল প্রিসেট হয়ে যেত যেটা merchant-রা বাছতেই পারতেন না।
    const seedPool = models.filter(isActiveModel);
    const seedAt = (index: number, fallback: string) =>
      seedPool[index]?.id ?? models[index]?.id ?? fallback;

    const quickSetup = existingValue.quickSetup || {
      fastModel: seedAt(0, "google/gemini-2.5-flash-lite"),
      smartModel: seedAt(2, "openai/gpt-4o-mini"),
      geniusModel: seedAt(3, "openai/gpt-4o"),
    };

    const updatedValue = {
      quickSetup,
      models,
      minCreditThreshold: existingValue.minCreditThreshold ?? 50,
      defaultProvider: existingValue.defaultProvider ?? "gemini",
      // ⚠️ এখানে আগে হার্ডকড `?? 2` ছিল। ওই একটা সংখ্যাই নীরবে সব credit
      //    দ্বিগুণ করত ("কার্ডে ৫, কাটে ১০")। গুণকের একমাত্র default এখন
      //    `credit-config.ts`-এর `test_chat_multiplier` = ১।
      testChatMultiplier: existingValue.testChatMultiplier ?? 1,
      // ⚠️ এই route পুরো value নতুন করে লিখে দেয়। তাই রেটটা এখানে না রাখলে
      //    "Fetch Models" চাপার সঙ্গে সঙ্গে admin-এর বসানো ডলার রেট মুছে
      //    গিয়ে আবার ১২০ হয়ে যেত।
      usdToBdtRate: sanitizeUsdToBdtRate(existingValue.usdToBdtRate),
      updatedAt: new Date().toISOString(),
    };

    // ── ক্যাটালগের নিয়ম যাচাই ────────────────────────────────────────────────
    //
    // ⚠️ এখানে ইচ্ছে করেই আটকানো হয় না (কারণটা "Validate Status"-এর মতোই:
    //    admin-এর ভুল নয়, বাইরের দুনিয়ার পরিবর্তন)। কিন্তু চুপ করে থাকাও যায়
    //    না — আগে এই route নিয়মের কোনো যাচাই ছাড়াই DB-তে লিখত, ফলে ক্যাটালগ
    //    নিয়ম-ভাঙা অবস্থায় পড়ে থাকতে পারত অথচ কেউ জানত না। এখন কারণটা
    //    ফেরত পাঠানো হয়, আর ক্লায়েন্ট সেটা toast-এ দেখায়।
    const violation = validateModelCatalog({
      models,
      quickSetup: quickSetup as Partial<Record<string, string>>,
    });

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
      /** এই sync-এ OpenRouter থেকে সত্যিই আনা হয়েছে কতগুলো। */
      fetchedCount: freshModels.length,
      /** আগের ক্যাটালগ থেকে ধরে রাখা হয়েছে কতগুলো (top-35-এর বাইরে পড়ে গিয়েছিল)। */
      carriedOverCount: carriedOver.length,
      models,
      quickSetup,
      violation,
    });
  } catch (error) {
    console.error("[FETCH_OPENROUTER_MODELS_ERROR]", error);
    return NextResponse.json(
      { error: "Could not fetch models from OpenRouter." },
      { status: 500 }
    );
  }
}
