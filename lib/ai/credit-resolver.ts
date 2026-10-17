import "server-only";

import { cache } from "react";

import { db } from "@/lib/core/db";
import {
  CREDIT_COSTS,
  DEFAULT_USD_TO_BDT_RATE,
  DEFAULT_WHATSAPP_FEE_BDT_PER_MESSAGE,
  DEFAULT_WHATSAPP_FREE_MESSAGES,
  getCreditCostByModel,
  getModelTier,
  sanitizeUsdToBdtRate,
  sanitizeWhatsappFeeBdt,
  sanitizeWhatsappFreeMessages,
  type CreditActionType,
  type ModelTier,
} from "@/lib/domain/credit-config";

// ══════════════════════════════════════════════════════════════════════════════
// Credit Resolver — credit গণনার একমাত্র সূত্র
//
// আগে তিন জায়গায় তিন রকম credit মান ছিল:
//   • n8n workflow-এ হার্ডকড `15`
//   • `credit-config.ts`-এর tier মান (economy 1 / standard 3 / premium 5)
//   • DB-র `ai_credit_rules.models[].credits` (admin panel যা সেট করে)
// ফলে একই reply-তে বিল ও ব্যালেন্স দুটো ভিন্ন সংখ্যা কাটত — লাভ/লসের হিসাব মিলত না।
//
// এখন ক্রম একটাই:
//   ১. **Admin override** — `ai_credit_rules.models[]`-এ ওই মডেলের `credits`
//   ২. **কোড default**    — `credit-config.ts`-এর tier-ভিত্তিক মান
//   ৩. নিরাপদ fallback     — standard (৩)
//
// ⚠️ কোথাও credit-এর সংখ্যা সরাসরি লিখবেন না (হার্ডকড করবেন না)।
//    সব জায়গায় এই ফাইলের ফাংশন কল করুন। কারণ `/admin/ai-settings` থেকে
//    admin এই মান বদলাতে পারেন, আর তা সঙ্গে সঙ্গে সবখানে প্রযোজ্য হতে হবে।
// ══════════════════════════════════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────────────────────────────────

/** `ai_credit_rules` PlatformSetting থেকে আমরা যা যা ব্যবহার করি। */
export interface CreditRules {
  /** modelId → admin-নির্ধারিত credit (শুধু যেগুলো সেট করা আছে) */
  modelCredits: Record<string, number>;
  testChatMultiplier: number;
  /** USD → BDT রেট — admin panel থেকে এডিটেবল, কারণ আসল রেট প্রতিনিয়ত বদলায় */
  usdToBdtRate: number;
  /**
   * Meta-র ফ্রি tier (প্রতি নাম্বারে, প্রতি মাসে) — ১৫.৮।
   * হিসাবের নিয়ম `lib/domain/whatsapp-cost.ts`-এ, এখানে কেবল admin-এর বসানো মান।
   */
  whatsappFreeMessages: number;
  /**
   * Meta-র service-message ফি প্রতি বার্তায় (৳) — ১৫.৮।
   * ⚠️ `0` = surcharge বন্ধ, এবং এটিই ডিফল্ট (`credit-config.ts`-এ কারণ লেখা)।
   */
  whatsappFeeBdtPerMessage: number;
}

export interface CreditResolution {
  /** সবশেষে যা কাটা হবে */
  credits: number;
  /** গুণক প্রয়োগের আগের মান */
  baseCredits: number;
  tier: ModelTier;
  multiplier: number;
  /** মানটা কোথা থেকে এল — admin panel-এ দেখানোর জন্য */
  source: "admin" | "config";
  isTestChat: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SETTING_KEY = "ai_credit_rules";

// ─── Reading admin rules ──────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** `ai_credit_rules` JSON থেকে দরকারি অংশটুকু নিরাপদে বের করে। */
function parseCreditRules(value: unknown): CreditRules {
  const rules: CreditRules = {
    modelCredits: {},
    testChatMultiplier: CREDIT_COSTS.test_chat_multiplier,
    usdToBdtRate: DEFAULT_USD_TO_BDT_RATE,
    whatsappFreeMessages: DEFAULT_WHATSAPP_FREE_MESSAGES,
    whatsappFeeBdtPerMessage: DEFAULT_WHATSAPP_FEE_BDT_PER_MESSAGE,
  };

  if (!isRecord(value)) return rules;

  if (Array.isArray(value.models)) {
    for (const model of value.models) {
      if (!isRecord(model)) continue;

      const id = model.id;
      const credits = model.credits;
      // মডেল বন্ধ (`isMerchantActive: false`) হলেও credit মান রাখা হয় —
      // পুরনো লগের হিসাব মেলাতে লাগে।
      if (typeof id !== "string" || typeof credits !== "number") continue;
      if (!Number.isFinite(credits) || credits <= 0) continue;

      rules.modelCredits[id] = credits;
    }
  }

  const multiplier = value.testChatMultiplier;
  if (typeof multiplier === "number" && Number.isFinite(multiplier) && multiplier > 0) {
    rules.testChatMultiplier = multiplier;
  }

  // পুরনো row-তে `usdToBdtRate` নেই — তখন default-ই থাকে, তাই migration লাগে না।
  rules.usdToBdtRate = sanitizeUsdToBdtRate(value.usdToBdtRate);

  // ১৫.৮ — একই নীতি: পুরনো row-তে এই দুটি ফিল্ডই নেই, তাই sanitizer-এর ডিফল্টই
  // চলে আসে (১০০০ ফ্রি, আর ফি `0` = surcharge বন্ধ)। অর্থাৎ migration ছাড়াই
  // সব বিদ্যমান ইনস্টল "বন্ধ" অবস্থায় শুরু করে — যেটিই কাঙ্ক্ষিত।
  rules.whatsappFreeMessages = sanitizeWhatsappFreeMessages(value.whatsappFreeMessages);
  rules.whatsappFeeBdtPerMessage = sanitizeWhatsappFeeBdt(value.whatsappFeeBdtPerMessage);

  return rules;
}

/**
 * Admin-নির্ধারিত credit নিয়ম।
 *
 * ⚠️ এখানে **সময়ভিত্তিক** কোনো cache নেই — এবং সেটাই ইচ্ছাকৃত। আগে ৫ মিনিটের
 *    in-memory cache ছিল, তাতে দুটো সমস্যা দেখা দিয়েছিল:
 *
 *    ১. Next.js App Router-এ প্রতিটি route handler-এর আলাদা module instance
 *       থাকে। তাই admin panel save করার পরে ডাকা `resetCreditRulesCache()`
 *       কেবল নিজের bundle-এর cache মুছত — `/api/ai-models` ও
 *       `/api/models/openrouter` আগের `testChatMultiplier` নিয়ে বসে থাকত।
 *       ফল: admin panel-এ Fast ১ / Smart ৩ / Genius ৫ সেট করা থাকলেও
 *       ড্যাশবোর্ডে **২ / ৬ / ১০** দেখাত (পুরনো গুণক ২ × নতুন credit)।
 *    ২. Billing-এর পথেও ৫ মিনিট পুরনো মানে কাটা চলত — admin দাম বদলালেও।
 *
 * ── তাহলে `cache()` কেন (TASK-11) ────────────────────────────────────────────
 * এটি সময় নয়, **একটি request** ধরে রাখে — `React.cache` Next.js-এ request-scoped।
 * উপরের দুই সমস্যার কোনোটাই তৈরি হয় না, কারণ এক request-এর ভেতরে admin কিছু
 * বদলাতে পারেন না: রিড আর ব্যবহারের মাঝে মান বদলানোর কোনো সুযোগ নেই, তাই
 * "কার্ডে ৫, কাটে ১০" ফিরে আসতে পারে না।
 *
 * কারণটা একটি পরিমাপযোগ্য অপচয়: `chargeUsage()`-এর এক কলেই `cost-calculator.ts`
 * `getUsdToBdtRate()` দিয়ে আর `resolveTotalCredits()` `resolveReplyCredits()` দিয়ে —
 * **একই row দুবার** পড়ে। Database সিঙ্গাপুরে আর অ্যাপ চলে অন্য অঞ্চলে, তাই ওই
 * বাড়তি read-টির দাম সত্যিকারের। `lib/ai/quota-guard.ts`-এ ঠিক এই প্যাটার্নটাই
 * আগে থেকে আছে।
 *
 * `ai_credit_rules` মাত্র একটি ছোট row; credit-এর একমাত্র সূত্র হওয়ায় সঠিকতাই
 * বড় কথা — তাই সময়ভিত্তিক cache কখনোই ফিরবে না, কেবল request-ভিত্তিক।
 *
 * ⚠️ এই dedup-টির **কোনো unit test নেই** — এবং সেটা লুকিয়ে না রেখে এখানে লেখা হলো।
 *    কারণ `React.cache` শুধু `react-server` condition-এ সত্যিকারের memoisation;
 *    vitest সেটি সেট করে না, তাই `react`-এর client build লোড হয় যেখানে
 *    `cache` নিছক passthrough:
 *
 *        exports.cache = function (fn) { return function () { return fn.apply(null, arguments); }; };
 *        // node_modules/react/cjs/react.development.js:917
 *
 *    অর্থাৎ ওই টেস্টটি প্রোডাকশন কোড ঠিক থাকা সত্ত্বেও **fail করত** — কারণটা
 *    পরীক্ষার পরিবেশ, কোড নয়। সেটি নকল করে পাস করানো মানে মিথ্যা নিশ্চয়তা।
 *    তাই এখানে নির্ভরতা দুইটি যাচাই করা তথ্যের উপর: (১) `react-server` condition-এ
 *    `cache` সত্যিই per-request memoise করে, আর (২) `getCreditRules` module-scope-এ
 *    একবারই মোড়া হয়েছে — তাই দুই caller একই wrapped ফাংশন পায়।
 */
export const getCreditRules = cache(async (): Promise<CreditRules> => {
  try {
    const setting = await db.platformSetting.findUnique({ where: { key: SETTING_KEY } });
    return parseCreditRules(setting?.value ?? null);
  } catch (error) {
    console.error("[CREDIT_RESOLVER] Failed to read credit rules:", error);
    return parseCreditRules(null);
  }
});

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * USD → BDT রেট — credit rules-এর মতোই প্রতিবার DB থেকে পড়া হয়।
 *
 * ⚠️ সারা প্রোডাক্টে ৳-এর **একমাত্র** সূত্র এটাই। কোথাও `120` লিখবেন না।
 *
 * ⚠️ রিপোর্টগুলো জমা-করা `AIUsageLog.costBdt` যোগ করে না — বরং প্রতিবার
 *    `costUsd`-কে এই রেটে গুণ করে। কারণ `costBdt` লেখা হয়ে যায় reply হওয়ার
 *    মুহূর্তে: admin রেট ১২০ → ১৩০ করলে পুরনো row-গুলো ১২০-তেই থেকে যেত আর
 *    নতুনগুলো ১৩০-এ হত, ফলে একই রিপোর্টে দুই রেট মিশে ভুল দেখাত। read-time
 *    রূপান্তরে ইতিহাসও সবসময় বর্তমান রেটে সঠিক দেখায়।
 */
export async function getUsdToBdtRate(): Promise<number> {
  const rules = await getCreditRules();
  return rules.usdToBdtRate;
}

/**
 * একটি AI reply-এর credit খরচ।
 *
 * @param modelId    OpenRouter model id (যেমন `"google/gemini-2.5-flash-lite"`)
 * @param options.isTestChat ড্যাশবোর্ডের টেস্ট চ্যাট হলে গুণক প্রয়োগ হবে
 *
 * @example
 * ```ts
 * // গুণক ১ হলে (আজকের সেটিং) টেস্ট চ্যাট আর আসল reply — দুটোরই খরচ সমান
 * await resolveReplyCredits("anthropic/claude-sonnet-4", { isTestChat: true });
 * // { credits: 5, baseCredits: 5, tier: "premium", multiplier: 1, source: "config" }
 *
 * // admin গুণক ২ করলে ড্যাশবোর্ডের কার্ডে ও কাটায় — দুটোতেই ১০ দেখাবে
 * ```
 */
export async function resolveReplyCredits(
  modelId: string,
  options: { isTestChat?: boolean } = {},
): Promise<CreditResolution> {
  const isTestChat = options.isTestChat === true;
  const rules = await getCreditRules();

  const tier = getModelTier(modelId);
  const adminCredits = rules.modelCredits[modelId];
  const source: CreditResolution["source"] =
    typeof adminCredits === "number" ? "admin" : "config";

  // admin override না থাকলে কোডের default — tier map → tier cost।
  const baseCredits =
    typeof adminCredits === "number" ? adminCredits : getCreditCostByModel(modelId);

  const multiplier = isTestChat ? rules.testChatMultiplier : 1;

  return {
    credits: Math.round(baseCredits * multiplier),
    baseCredits,
    tier,
    multiplier,
    source,
    isTestChat,
  };
}

/**
 * Compare mode — একসাথে ২–৪টা মডেল চালানোর খরচ।
 * (সব মডেলের base যোগফল) × টেস্ট-চ্যাট গুণক, কারণ compare কেবল ড্যাশবোর্ডেই হয়।
 *
 * ⚠️ গুণক একবারই লাগে — **যোগফলের উপর**, প্রতিটি মডেলের উপর আলাদা করে নয়।
 *    `resolveReplyCredits`-এর `credits` আগেই গুণক-যুক্ত, তাই ওগুলো যোগ করলে
 *    গুণক দুইবার পড়ত (২ মডেল × গুণক ২ = চারগুণ বিল)। তাই এখানে প্রতিটার
 *    `baseCredits` নিয়ে যোগ করা হয়, তারপর সবশেষে একবার গুণ।
 *
 * @param modelIds OpenRouter মডেল id-র তালিকা (২ থেকে ৪টা)
 *
 * @example
 * ```ts
 * const { credits } = await resolveCompareCredits([
 *   "openai/gpt-4o",
 *   "google/gemini-2.5-flash-lite",
 * ]);
 * // (base A + base B) × টেস্ট-চ্যাট গুণক — গুণকের আসল মান admin panel-এ সেট করা।
 * ```
 */
export async function resolveCompareCredits(
  modelIds: string[],
): Promise<{ credits: number; baseCredits: number; multiplier: number }> {
  const resolved = await Promise.all(
    modelIds.map((modelId) => resolveReplyCredits(modelId, { isTestChat: true })),
  );

  // প্রতিটির গুণক একই source থেকে আসে, তাই যেকোনো একটা নিলেই হয়
  const multiplier = resolved[0]?.multiplier ?? 1;
  const baseCredits = resolved.reduce((sum, r) => sum + r.baseCredits, 0);

  return { credits: Math.round(baseCredits * multiplier), baseCredits, multiplier };
}

/**
 * Flat-fee action-গুলোর credit (reply ছাড়া বাকি সব)।
 *
 * ⚠️ এই মানগুলো এখনো `/admin/ai-settings` থেকে সম্পাদনাযোগ্য নয় — `credit-config.ts`
 *    থেকেই আসে। ভবিষ্যতে admin-নিয়ন্ত্রিত করতে চাইলে শুধু এখানে বদলালেই হবে,
 *    কারণ সব caller এই ফাংশনই ব্যবহার করে।
 */
export function getActionCredits(action: CreditActionType): number {
  return CREDIT_COSTS[action];
}
