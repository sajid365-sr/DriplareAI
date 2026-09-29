import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";
import {
  DEFAULT_USD_TO_BDT_RATE,
  sanitizeUsdToBdtRate,
} from "@/lib/domain/credit-config";
import {
  DEFAULT_MODELS_CATALOG,
  DEFAULT_QUICK_SETUP,
  validateModelCatalog,
} from "@/lib/domain/model-catalog";

const DEFAULT_AI_SETTINGS = {
  // ক্যাটালগ ও প্রিসেটের একমাত্র কপি এখন `lib/domain/model-catalog.ts`-এ,
  // কারণ merchant route-ও নতুন ইনস্টলে ঠিক এই তালিকাটাই ব্যবহার করে।
  quickSetup: DEFAULT_QUICK_SETUP,
  models: DEFAULT_MODELS_CATALOG,
  minCreditThreshold: 50,
  defaultProvider: "gemini",
  // টেস্ট চ্যাটের গুণক। ১ = ড্যাশবোর্ডে যা দেখানো হয়, ঠিক তাই কাটা হয়।
  testChatMultiplier: 1,
  // USD → BDT রেট। হার্ডকড নয় — admin panel থেকে বদলানো যায়, কারণ আসল
  // রেট প্রতিনিয়ত ওঠানামা করে। এটাই সারা প্রোডাক্টের একমাত্র সূত্র।
  usdToBdtRate: DEFAULT_USD_TO_BDT_RATE,
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
    // ⚠️ `length > 0` শর্তটা ইচ্ছে করেই নেই। row-তে খালি অ্যারে থাকলে সেটাই
    //    সত্যি — নাহলে admin একটা খালি ক্যাটালগ সেভ করলে GET আবার ডিফল্ট
    //    তালিকা দেখাত, আর তিনি নিজের অবস্থাটা দেখতেই পেতেন না।
    //
    // ⚠️ এখানে আগে deprecated মডেলের `isMerchantActive` জোর করে `false` করা হত।
    //    সেটা তুলে দেওয়া হয়েছে — merchant-দের থেকে লুকানোর কাজটা `isDeprecated`
    //    একাই করে (`isActiveModel` দুটোই দেখে), অথচ `isMerchantActive` ছিল
    //    admin-এর নিজের সিদ্ধান্ত। কপি করে `false` বানালে admin পর্দায় নিজের
    //    সিদ্ধান্তটাই আর দেখতেন না, আর পরের সেভে সেটা সত্যি সত্যিই মুছে যেত।
    const models = Array.isArray(saved.models)
      ? saved.models
      : DEFAULT_MODELS_CATALOG;

    const merged = {
      quickSetup: {
        ...DEFAULT_AI_SETTINGS.quickSetup,
        ...((saved.quickSetup as Record<string, string>) || {}),
      },
      models,
      minCreditThreshold: typeof saved.minCreditThreshold === "number"
        ? saved.minCreditThreshold
        : DEFAULT_AI_SETTINGS.minCreditThreshold,
      defaultProvider: typeof saved.defaultProvider === "string"
        ? saved.defaultProvider
        : DEFAULT_AI_SETTINGS.defaultProvider,
      testChatMultiplier: typeof saved.testChatMultiplier === "number"
        ? saved.testChatMultiplier
        : DEFAULT_AI_SETTINGS.testChatMultiplier,
      // পুরনো row-তে ফিল্ডটা নেই — sanitize নিজেই default বসিয়ে দেয়,
      // তাই আলাদা migration লাগে না।
      usdToBdtRate: sanitizeUsdToBdtRate(saved.usdToBdtRate),
    };

    return NextResponse.json(merged);
  } catch (error) {
    console.error("[ADMIN_AI_SETTINGS_GET]", error);
    // ⚠️ এখানে আগে `NextResponse.json(DEFAULT_AI_SETTINGS)` ফেরত যেত — অর্থাৎ
    //    ২০০ স্ট্যাটাসে একটা বানানো ক্যাটালগ। ক্লায়েন্ট "DB-র নিয়ম" আর "পড়তে
    //    ব্যর্থ হয়ে ডিফল্ট" — এই দুটোর পার্থক্য বুঝতেই পারত না: পেজটা স্বাভাবিক
    //    দেখাত, আর admin তখন Save চেপে আসল নিয়মগুলো ডিফল্ট দিয়ে চাপা দিতেন।
    //    এখন ৫০০ যায়, আর ক্লায়েন্ট নিজের এরর-স্ক্রিন দেখায়।
    return NextResponse.json(
      { error: "Could not read AI credit rules from the database." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();

    const models = Array.isArray(body.models) ? body.models : DEFAULT_MODELS_CATALOG;

    const settingValue = {
      quickSetup: body.quickSetup ?? DEFAULT_AI_SETTINGS.quickSetup,
      models,
      minCreditThreshold: typeof body.minCreditThreshold === "number"
        ? body.minCreditThreshold
        : DEFAULT_AI_SETTINGS.minCreditThreshold,
      defaultProvider: body.defaultProvider ?? DEFAULT_AI_SETTINGS.defaultProvider,
      testChatMultiplier: typeof body.testChatMultiplier === "number"
        ? body.testChatMultiplier
        : DEFAULT_AI_SETTINGS.testChatMultiplier,
      // client থেকে যা-ই আসুক, bounds-এর বাইরে গেলে টেনে ভিতরে আনা হয়।
      usdToBdtRate: sanitizeUsdToBdtRate(body.usdToBdtRate),
      updatedAt: new Date().toISOString(),
    };

    // ── ক্যাটালগের নিয়ম যাচাই ────────────────────────────────────────────────
    // ⚠️ ক্লায়েন্টেও টগল গার্ড করা আছে, কিন্তু সেটা কেবল সুবিধার জন্য — নিরাপত্তা
    //    নয়। কেউ সরাসরি API কল করলে, বা ক্লায়েন্টে গার্ডটা কোনোভাবে বাদ পড়লে,
    //    এখানেই শেষ প্রতিরক্ষা।
    //
    //    আগে এখানে একটা sanitize হত যেটা deprecated মডেলকে `isMerchantActive:
    //    false` বানিয়ে দিত। সেটা তুলে দেওয়া হয়েছে — `isActiveModel` নিজেই
    //    `isDeprecated` দেখে মডেলটা বাদ দেয়, তাই সংখ্যাটা একই থাকে, অথচ
    //    admin-এর বসানো টগলটা মুছে যায় না।
    const violation = validateModelCatalog({
      models,
      quickSetup: settingValue.quickSetup as Partial<Record<string, string>>,
    });

    if (violation) {
      return NextResponse.json(
        {
          error:
            violation.code === "too-few-active"
              ? `At least ${violation.required} models must stay merchant-active (got ${violation.activeCount}).`
              : `The ${violation.presetLabel} preset points at a model that is not merchant-active (${violation.modelId}).`,
          violation,
        },
        { status: 400 }
      );
    }

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

    // ⚠️ এখানে আর cache মুছতে হয় না।
    // আগে `credit-resolver.ts` ও `openrouter-service.ts` — দুটোই ৫ মিনিটের
    // in-memory cache রাখত, আর এই দুই লাইনে সেটা মুছত। কিন্তু Next.js App
    // Router-এ প্রতিটি route handler-এর আলাদা module instance থাকে, তাই
    // এখানকার reset **কেবল নিজের bundle-এ** কাজ করত। `/api/ai-models` আর
    // `/api/models/openrouter`-এর bundle পুরনো `testChatMultiplier` নিয়েই বসে
    // থাকত — ফলে admin panel-এ Fast ১ / Smart ৩ / Genius ৫ সেভ করার পরেও
    // ড্যাশবোর্ডে **২ / ৬ / ১০** দেখাত (পুরনো গুণক ২ × নতুন credit)।
    // এখন ওই cache দুটোই তুলে দেওয়া হয়েছে — দুই ফাইলই প্রতিবার DB পড়ে।

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
