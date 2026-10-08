import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";
import { validateModelCatalog } from "@/lib/domain/model-catalog";

/**
 * live তালিকা সন্দেহজনক মনে হলে কেন থেমে যাওয়া হল — ক্লায়েন্ট এই কোড দেখে
 * নিজের ভাষায় বার্তা দেখায়। (সার্ভারে কখনো UI টেক্সট তৈরি হয় না।)
 */
type ValidateAbortCode =
  | "empty-live-catalog"
  | "incomplete-live-catalog"
  | "would-deprecate-all";

interface CatalogModel {
  id: string;
  isMerchantActive?: boolean;
  isDeprecated?: boolean;
  [key: string]: unknown;
}

export async function POST() {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    // ── ১. OpenRouter-এর লাইভ ক্যাটালগ ──────────────────────────────────────
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "User-Agent": "DriplareAI-Admin/1.0" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`OpenRouter API responded with status ${res.status}`);
    }

    const data = await res.json();
    const rawModels: any[] = Array.isArray(data?.data) ? data.data : [];
    const liveModelIds = new Set(rawModels.map((m) => m?.id).filter(Boolean));

    // ── ২. সংরক্ষিত ক্যাটালগ ─────────────────────────────────────────────────
    let existingSetting: any = null;
    if ((db as any).platformSetting) {
      existingSetting = await (db as any).platformSetting.findUnique({
        where: { key: "ai_credit_rules" },
      });
    }

    if (!existingSetting || !existingSetting.value) {
      return NextResponse.json(
        { error: "No AI credit rules found in database to validate." },
        { status: 404 }
      );
    }

    const savedValue = existingSetting.value as Record<string, any>;
    const currentModels: CatalogModel[] = Array.isArray(savedValue.models)
      ? savedValue.models
      : [];

    // ── ৩. নিরাপত্তা-প্রবেশদ্বার ─────────────────────────────────────────────
    //
    // ⚠️ এখানে আগে কোনো যাচাই ছিল না, আর সেটাই ছিল এই route-এর সবচেয়ে বিপজ্জনক
    //    দিক। OpenRouter ২০০ ফেরত দিয়ে খালি বা অসম্পূর্ণ `data` দিলে
    //    `liveModelIds` খালি হয়ে যেত, আর নিচের লুপ **প্রতিটি** মডেলকে
    //    deprecated করে DB-তে লিখে দিত — এক ক্লিকে merchant ড্যাশবোর্ড শূন্য।
    //
    //    এখন সন্দেহজনক উত্তর পেলে কিছুই লেখা হয় না, বরং সরাসরি থেমে যাওয়া হয়।
    //    admin আবার চাপলে ঠিক হয়ে যেতে পারে; ভুল ডেটা সেভ হয়ে থাকলে সেটা
    //    আর ফেরানোর উপায় নেই।
    const abort = (code: ValidateAbortCode, message: string, status = 502) =>
      NextResponse.json({ error: message, code }, { status });

    if (rawModels.length === 0) {
      return abort(
        "empty-live-catalog",
        "OpenRouter returned an empty model list. Nothing was changed."
      );
    }

    // আমাদের ক্যাটালগ OpenRouter-এর পুরো তালিকার একটা ছোট উপসেট (৫টা provider,
    // ৩৫টা মডেল)। তাই লাইভ তালিকা কখনোই ক্যাটালগের চেয়ে ছোট হতে পারে না —
    // হলে উত্তরটা নিশ্চিতভাবে অসম্পূর্ণ।
    if (liveModelIds.size < currentModels.length) {
      return abort(
        "incomplete-live-catalog",
        `OpenRouter returned only ${liveModelIds.size} models for a catalog of ${currentModels.length}. Nothing was changed.`
      );
    }

    // ── ৪. যাচাই ─────────────────────────────────────────────────────────────
    let deprecatedCount = 0;

    const validatedModels = currentModels.map((m) => {
      const isStillLive = liveModelIds.has(m.id);
      if (isStillLive) {
        // ⚠️ মডেল ফিরে এলে আগের `isDeprecated` মুছে যায় — admin-এর বসানো
        //    `isMerchantActive` কখনো ছোঁয়া হয় না, তাই ওই সিদ্ধান্তটাও
        //    আপনাআপনি ফিরে আসে।
        return m.isDeprecated ? { ...m, isDeprecated: false } : m;
      }

      deprecatedCount++;
      // ⚠️ এখানে আগে জোর করে `isMerchantActive: false` লেখা হত — আর সেটাই ছিল
      //    অপূরণীয় ক্ষতি। merchant-দের থেকে মডেল লুকানোর জন্য `isDeprecated`
      //    একাই যথেষ্ট (`isActiveModel` দুটোই দেখে), কিন্তু `isMerchantActive`
      //    ছিল admin-এর নিজের সিদ্ধান্ত। ওটা মুছে দিলে মডেলটা একদিন ফিরে এলেও
      //    admin-এর বন্ধ-অন অবস্থা আর কখনো ফিরত না — তাঁকে হাতে আবার চালু করতে হত।
      return { ...m, isDeprecated: true };
    });

    if (currentModels.length > 0 && deprecatedCount === currentModels.length) {
      return abort(
        "would-deprecate-all",
        "Every model in the catalog is missing from OpenRouter's live list. Nothing was changed."
      );
    }

    // ── ৫. নিয়ম ভাঙার সতর্কবার্তা ───────────────────────────────────────────
    //
    // ⚠️ এখানে ইচ্ছে করেই **আটকানো হয় না**। ওপরে যাচাই শুধু admin-এর নিজের
    //    কাজ পাহারা দেয়; এটা নয় — এখানে OpenRouter নিজে একটা মডেল তুলে
    //    নিয়েছে, আর সেই মডেলটা আবার চালু রাখার কোনো উপায় নেই। তাই
    //    admin-কে জানানো হয় যাতে তিনি হাতে মডেল যোগ করে ঘরটা ভরাতে পারেন।
    //
    //    একই কারণে এটা POST রুটের ৪০০ ভ্যালিডেশনের ভেতর দিয়ে যায় না।
    const violation = validateModelCatalog({
      models: validatedModels,
      quickSetup: savedValue.quickSetup as Partial<Record<string, string>>,
    });

    // ── ৬. সেভ (কেবল সত্যিই কিছু বদলালে) ────────────────────────────────────
    //
    // ⚠️ আগে প্রতিবারই লেখা হত, এমনকি কিছু না বদলালেও — তাতে `updatedAt`
    //    অর্থহীনভাবে নড়ত, আর admin "কিছু হল কি?" বুঝতেই পারতেন না।
    //
    // ওপরের `map` অপরিবর্তিত মডেলের ক্ষেত্রে **একই অবজেক্ট** ফেরত দেয়, তাই
    // রেফারেন্স মিলিয়ে গেলেই বোঝা যায় কিছু বদলায়নি — আলাদা করে তুলনা করতে হয় না।
    const hasChanges = validatedModels.some((m, i) => m !== currentModels[i]);

    const updatedValue = hasChanges
      ? {
          ...savedValue,
          models: validatedModels,
          updatedAt: new Date().toISOString(),
        }
      : savedValue;

    if (hasChanges && (db as any).platformSetting) {
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
      deprecatedCount,
      totalValidated: validatedModels.length,
      changed: hasChanges,
      settings: updatedValue,
      models: validatedModels,
      // null হলে সব নিয়ম ঠিক আছে; নাহলে ক্লায়েন্ট সতর্কবার্তা দেখায়।
      violation,
    });
  } catch (error) {
    console.error("[VALIDATE_MODELS_ERROR]", error);
    return NextResponse.json(
      { error: "Could not validate models against OpenRouter catalog." },
      { status: 500 }
    );
  }
}

// ⚠️ এখানে আগে `export async function GET() { return POST(); }` ছিল — একটা
//    GET যেটা DB-তে লেখে। ব্রাউজারে URL-টা খুললে, বা কোনো crawler/link-prefetch
//    হিট করলে পুরো deprecate প্রক্রিয়াটা চুপচাপ চলে যেত। কিছুই ওটা কল করত না,
//    তাই তুলে দেওয়া হয়েছে।
