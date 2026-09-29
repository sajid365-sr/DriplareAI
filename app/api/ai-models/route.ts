import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getDynamicTierMap } from "@/lib/ai/chat-models";
import { getCreditRules } from "@/lib/ai/credit-resolver";
import {
  DEFAULT_MODELS_CATALOG,
  DEFAULT_QUICK_SETUP,
  isActiveModel,
} from "@/lib/domain/model-catalog";

// ⚠️ এই রুট billing-সংক্রান্ত মান দেয় — `tiers[].effectiveCredits` আর
//    `testChatMultiplier`। তাই এটা **কখনো** static/ISR হতে চলবে না।
//    `dynamic` না দিলে production build-এ একবার render হয়ে মানগুলো জমাট বেঁধে
//    যেত — admin panel থেকে credit বদলালেও ড্যাশবোর্ড চিরকাল পুরনো মান দেখাত।
export const dynamic = "force-dynamic";

/**
 * DB-তে জমা থাকা একটা মডেল row।
 *
 * ⚠️ ইচ্ছে করেই `SeedModel` নয় — পুরনো row-তে কিছু ফিল্ড নাও থাকতে পারে,
 *    আর তখন টাইপ জোর করে মেলানো মানে ভাঙা ডেটাকে বিশ্বাস করা। এখানে শুধু
 *    `id` বাধ্যতামূলক (বাকি সব ফিল্ডের জন্য নিচে `||` fallback আছে)।
 */
interface StoredModelRow {
  id: string;
  name?: string;
  provider?: string;
  tier?: string;
  credits?: number;
  contextWindow?: number;
  maxTokens?: number;
  promptPrice?: number;
  completionPrice?: number;
  isMerchantActive?: boolean;
  isDeprecated?: boolean;
}

export async function GET() {
  try {
    const setting = (db as any).platformSetting
      ? await (db as any).platformSetting.findUnique({
          where: { key: "ai_credit_rules" },
        })
      : null;

    const value = (setting?.value ?? {}) as Record<string, unknown>;

    // ⚠️ এখানে আর কোনো "active লিস্ট খালি হলে ডিফল্টে ফিরে যাওয়া" নেই।
    //    আগে ঠিক এই জায়গায় একটা হার্ডকড ৫-মডেলের তালিকা বসানো ছিল, ফলে admin
    //    সব মডেল বন্ধ করলেও merchant সবগুলোই দেখতেন — অর্থাৎ "সব বন্ধ" মানে
    //    আসলে "কিছুই বন্ধ হয় না"। এখন:
    //
    //      row নেই              → seed (একদম নতুন ইনস্টল)
    //      row আছে কিন্তু খালি  → খালিই সত্যি, কোনো মডেল যাবে না
    const rawModels: StoredModelRow[] = Array.isArray(value.models)
      ? (value.models as StoredModelRow[])
      : DEFAULT_MODELS_CATALOG;

    const quickSetup = {
      ...DEFAULT_QUICK_SETUP,
      ...((value.quickSetup as Record<string, string>) || {}),
    };

    // Strict Filter: Only models satisfying (isMerchantActive === true && isDeprecated !== true)
    const finalModels = rawModels.filter(isActiveModel).map((m) => ({
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

    // ── Fast / Smart / Genius ─────────────────────────────────────────────────
    // কার্ডে যা দেখানো হয় আর বিলে যা কাটা হয় — দুটোই এখন একই ফাংশন থেকে আসে,
    // তাই admin panel-এর preset মডেল বা credit মান বদলালে সঙ্গে সঙ্গে মিলবে।
    // `effectiveCredits` = admin-এর গুণক প্রয়োগের পর যা সত্যিই কাটা হবে।
    const tiers = await getDynamicTierMap();
    const rules = await getCreditRules();

    return NextResponse.json(
      {
        success: true,
        models: finalModels,
        quickSetup,
        tiers,
        testChatMultiplier: rules.testChatMultiplier,
      },
      // ব্রাউজারও যেন পুরনো উত্তর ধরে না বসে — নাহলে admin panel-এ credit
      // বদলানোর পরেও ড্যাশবোর্ড ক্যাশ করা পুরনো credit দেখাতে পারে।
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } }
    );
  } catch (error) {
    console.error("[API_ACTIVE_AI_MODELS_GET]", error);
    // ⚠️ এখানে আর ডিফল্ট তালিকা ফেরত দেওয়া হয় না।
    //
    //    ডেটাবেস পড়তে না পারলে admin কোন মডেলগুলো বন্ধ করেছেন সেটাই অজানা।
    //    অজানার জায়গায় একটা হার্ডকড তালিকা বসিয়ে দিলে merchant এমন মডেল
    //    দেখতেন ও ব্যবহার করতেন যেগুলো admin ইচ্ছে করেই বন্ধ রেখেছেন — আর
    //    সেটাই ছিল আসল বাগ। তাই সৎ উত্তরটা হলো "জানি না", অর্থাৎ এরর।
    //    ক্লায়েন্ট এরর পেলে নিজের আগের অবস্থাটাই ধরে রাখে।
    return NextResponse.json(
      { success: false, error: "Model catalogue unavailable", models: [] },
      { status: 500 }
    );
  }
}
