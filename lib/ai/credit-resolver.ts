import "server-only";

import { db } from "@/lib/core/db";
import {
  CREDIT_COSTS,
  getCreditCostByModel,
  getCreditCostByTier,
  getModelTier,
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

  return rules;
}

/**
 * Admin-নির্ধারিত credit নিয়ম — **প্রতিবার DB থেকেই** পড়া হয়।
 *
 * ⚠️ এখানে ইচ্ছে করেই কোনো cache নেই। আগে ৫ মিনিটের in-memory cache ছিল,
 *    তাতে দুটো সমস্যা দেখা দিয়েছিল:
 *
 *    ১. Next.js App Router-এ প্রতিটি route handler-এর আলাদা module instance
 *       থাকে। তাই admin panel save করার পরে ডাকা `resetCreditRulesCache()`
 *       কেবল নিজের bundle-এর cache মুছত — `/api/ai-models` ও
 *       `/api/models/openrouter` আগের `testChatMultiplier` নিয়ে বসে থাকত।
 *       ফল: admin panel-এ Fast ১ / Smart ৩ / Genius ৫ সেট করা থাকলেও
 *       ড্যাশবোর্ডে **২ / ৬ / ১০** দেখাত (পুরনো গুণক ২ × নতুন credit)।
 *    ২. Billing-এর পথেও ৫ মিনিট পুরনো মানে কাটা চলত — admin দাম বদলালেও।
 *
 *    `ai_credit_rules` মাত্র একটি ছোট row; indexed `findUnique` খরচ বলতে
 *    গেলে শূন্য। credit-এর একমাত্র সূত্র হওয়ায় সঠিকতাই বড় কথা।
 */
export async function getCreditRules(): Promise<CreditRules> {
  try {
    const setting = await db.platformSetting.findUnique({ where: { key: SETTING_KEY } });
    return parseCreditRules(setting?.value ?? null);
  } catch (error) {
    console.error("[CREDIT_RESOLVER] Failed to read credit rules:", error);
    return parseCreditRules(null);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

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
 * tier-ভিত্তিক credit (admin override ছাড়া) — শুধু দেখানোর জন্য।
 */
export function getTierCreditCost(tier: ModelTier): number {
  return getCreditCostByTier(tier);
}

/**
 * Compare mode — দুটো মডেল একসাথে চালানোর খরচ।
 * (মডেল A + মডেল B) × টেস্ট-চ্যাট গুণক, কারণ compare কেবল ড্যাশবোর্ডেই হয়।
 *
 * @example
 * ```ts
 * const { credits } = await resolveCompareCredits("openai/gpt-4o", "google/gemini-2.5-flash-lite");
 * // (base A + base B) × টেস্ট-চ্যাট গুণক — গুণকের আসল মান admin panel-এ সেট করা।
 * ```
 */
export async function resolveCompareCredits(
  modelA: string,
  modelB: string,
): Promise<{ credits: number; baseCredits: number; multiplier: number }> {
  const [a, b] = await Promise.all([
    resolveReplyCredits(modelA, { isTestChat: true }),
    resolveReplyCredits(modelB, { isTestChat: true }),
  ]);

  // দুটোর গুণক একই source থেকে আসে, তাই যেকোনো একটা নিলেই হয়
  const multiplier = a.multiplier;
  const baseCredits = a.baseCredits + b.baseCredits;

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
