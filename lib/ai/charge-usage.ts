import "server-only";

import { db } from "@/lib/core/db";
import { calculateUsageCost } from "@/lib/ai/cost-calculator";
import { resolveReplyCredits, getActionCredits } from "@/lib/ai/credit-resolver";
import { checkUsageThresholds } from "@/lib/services/usage-alerts";

// ══════════════════════════════════════════════════════════════════════════════
// Charge Usage — credit কাটা ও খরচ লেখার **একমাত্র** ফাংশন
// ══════════════════════════════════════════════════════════════════════════════
//
// একটি AI reply-এর জন্য যা যা হওয়া দরকার, সব এখানে এবং **একটি database
// transaction-এর ভেতরে**:
//
//     ব্যালেন্স −   ·   CreditTransaction   ·   AIUsageLog
//
// তিনটাই একসাথে হয়, নাহয় একটাও না। আগে n8n নিজে SQL দিয়ে লিখত, তাই
// credit-এর মান হার্ডকড (১৫) ছিল আর ব্যালেন্স কখনোই কমত না — অথচ লগে
// "কাটা হয়েছে" লেখা থাকত।
//
// ── কেন আলাদা ফাইল ───────────────────────────────────────────────────────────
// এই ফাংশনের **দুইজন caller**, আর দুজনকে অবশ্যই হুবহু একই নিয়ম মানতে হবে:
//
//   ১. `POST /api/internal/ai-usage` — n8n থেকে ডাকা হয়।
//      Facebook / WhatsApp / Instagram-এর reply প্ল্যাটফর্মের ভেতর দিয়ে যায়
//      না, তাই সেখানে n8n-ই ফেরত এসে জানায় "এই reply-এর এত খরচ"।
//
//   ২. `POST /api/chatbots/[chatbotId]/chat` — Playground / ড্যাশবোর্ড টেস্ট।
//      এখানে প্ল্যাটফর্মই তো কলটা করেছিল, আর n8n উত্তরে token ফেরতও দেয় —
//      তাই আলাদা করে n8n-এর callback-এর অপেক্ষা করার দরকার নেই।
//      (বাস্তবে এটাই দরকারি: n8n আছে itnut VPS-এ, সে ডেভেলপারের localhost-এ
//      পৌঁছাতে পারে না — তাই লোকাল টেস্টে callback দিয়ে credit কাটা অসম্ভব।)
//
// দুটো পথ একসাথে চললেও **দ্বিগুণ কাটার ভয় নেই**: n8n যখন নিজেই সফলভাবে কাটে,
// সে উত্তরে `billingOk: true` পাঠায়, আর তখন caller আর কাটে না।
//
// ⚠️ credit-এর সংখ্যা কোথাও হার্ডকড করবেন না। মান আসে `credit-resolver.ts`
//    থেকে, যেটা `/admin/ai-settings` থেকে admin নিয়ন্ত্রণ করেন।
// ══════════════════════════════════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────────────────────────────────

/** দাম কোথা থেকে এল — n8n-এর অনুমান টোকেন হলে `estimated`, tracing-এর আসল হলে `exact`। */
export type CostSource = "exact" | "estimated";

export interface ChargeUsageInput {
  /** Idempotency-র চাবি — n8n execution id। একই id দুবার এলে দ্বিতীয়বার কাটা হয় না। */
  runId?: string;
  /** প্ল্যাটফর্মে Clerk-যাচাই করা userId। না দিলে `chatbotId` থেকে বের করা হবে। */
  userId?: string;
  chatbotId?: string;
  sessionId?: string;
  /** `"playground"` | `"facebook"` | `"whatsapp"` | `"instagram"` | `"web"` */
  channel?: string;
  /** OpenRouter model id (যেমন `"anthropic/claude-sonnet-4"`) */
  modelId: string;
  promptTokens?: number;
  completionTokens?: number;
  /** এক reply-তে কতগুলো LLM call হয়েছে (compare/agent-এ একাধিক) */
  llmCallCount?: number;
  /** ড্যাশবোর্ডের টেস্ট চ্যাট হলে credit-এ গুণক বসবে */
  isTestChat?: boolean;
  /** true হলে credit কাটা হবে না, শুধু খরচের লগ হবে */
  isFreeMessage?: boolean;
  tokensAreExact?: boolean;
  /** multimedia add-on — reply-এর খরচের উপরে যোগ হয় */
  extra?: { image?: boolean; audioMinutes?: number };
}

export type ChargeUsageResult =
  /** লেনদেন সম্পন্ন — credit কাটা হয়েছে (বা isFreeMessage-এ শুধু লগ হয়েছে) */
  | {
      kind: "created";
      creditsSpent: number;
      creditsRemaining: number | null;
      costUsd: number;
      costBdt: number;
      costSource: CostSource;
    }
  /** একই `runId` আগেই প্রক্রিয়া হয়েছে — এবার কিছুই কাটা হয়নি */
  | { kind: "duplicate"; creditsSpent: number; costUsd: number; costSource: CostSource }
  /** ব্যালেন্স যথেষ্ট নয় — কিছুই কাটা হয়নি */
  | { kind: "insufficient"; creditsRequired: number; creditsBalance: number }
  /** `userId`-ও নেই, `chatbotId` দিয়েও বের করা গেল না */
  | { kind: "unknown_user" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Prisma-র unique-constraint violation (P2002) কি না। */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * reply-এর মোট ক্রেডিট — tier-ভিত্তিক মূল্য + multimedia add-on।
 *
 * সব সংখ্যা `credit-resolver.ts` থেকে আসে, তাই `/admin/ai-settings`-এ
 * admin বদলালে সঙ্গে সঙ্গে সবখানে প্রযোজ্য হবে।
 */
async function resolveTotalCredits(
  input: ChargeUsageInput,
): Promise<{ credits: number; tier: string; source: "admin" | "config" }> {
  const reply = await resolveReplyCredits(input.modelId, { isTestChat: input.isTestChat === true });

  let credits = reply.credits;

  // Multimedia add-on — reply-এর খরচের উপরে যোগ হয়
  if (input.extra?.image) {
    credits += getActionCredits("image_message");
  }
  if (input.extra?.audioMinutes && input.extra.audioMinutes > 0) {
    credits += Math.ceil(input.extra.audioMinutes) * getActionCredits("audio_per_minute");
  }

  return { credits, tier: reply.tier, source: reply.source };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * একটি AI reply-এর খরচ লেখে এবং credit কাটে — ব্যালেন্স, লেজার ও লগ একসাথে।
 *
 * এই ফাংশন কখনো throw করে না এমন কিছু করতে চায় না; ব্যর্থ হলে `console.error`
 * করে `unknown_user` বা exception ছুঁড়ে দেয়, আর caller সেটা গিলে reply ঠিকই
 * ফেরত দেয়। কারণ গ্রাহকের উত্তর পাওয়া বিলিংয়ের চেয়ে জরুরি — বিলিং বাদ পড়লে
 * Step 7-এর reconciler সেটা পরে ধরে ফেলবে।
 *
 * @example
 * ```ts
 * const result = await chargeUsage({
 *   runId: "4821",
 *   userId: "user_37u0…",
 *   chatbotId: "cm_…",
 *   channel: "playground",
 *   modelId: "anthropic/claude-sonnet-4",
 *   promptTokens: 1854,
 *   completionTokens: 86,
 *   isTestChat: true,
 * });
 * // { kind: "created", creditsSpent: 10, creditsRemaining: 990, costUsd: 0.006852, … }
 * ```
 */
export async function chargeUsage(input: ChargeUsageInput): Promise<ChargeUsageResult> {
  const channel = input.channel?.trim() || "web";
  const promptTokens = input.promptTokens ?? 0;
  const completionTokens = input.completionTokens ?? 0;
  const llmCallCount = input.llmCallCount ?? 0;
  const isTestChat = input.isTestChat === true;

  // ১. userId ও workspaceId ঠিক করা।
  //    workspaceId কখনো কখনো ক্লায়েন্ট পাঠায় না, তাই bot থেকেই বের করা safest —
  //    এটাই Cost Analytics-এ workspace-ভিত্তিক হিসাবের ভিত্তি।
  let userId = input.userId;
  let workspaceId: string | null = null;

  if (input.chatbotId) {
    const bot = await db.chatbot.findFirst({
      where: { chatbotId: input.chatbotId },
      select: { userId: true, workspaceId: true },
    });
    if (bot) {
      userId = userId ?? bot.userId;
      workspaceId = bot.workspaceId ?? null;
    }
  }

  if (!userId) {
    console.error("[CHARGE_USAGE] userId নির্ধারণ করা যায়নি", {
      chatbotId: input.chatbotId ?? null,
      runId: input.runId ?? null,
    });
    return { kind: "unknown_user" };
  }

  // ২. খরচ ও ক্রেডিট হিসাব — দাম OpenRouter-এর লাইভ, ক্রেডিট admin-নিয়ন্ত্রিত
  const cost = await calculateUsageCost(input.modelId, promptTokens, completionTokens);

  const isFree = input.isFreeMessage === true;
  const resolved = isFree
    ? { credits: 0, tier: "free", source: "config" as const }
    : await resolveTotalCredits(input);

  // n8n-এর অনুমান টোকেন → "estimated"; tracing-এর আসল টোকেন → "exact"
  const costSource: CostSource = input.tokensAreExact ? "exact" : "estimated";

  // ৩. সব লেখা এক transaction-এ — তিনটাই হয়, নাহয় একটাও না
  const outcome = await db.$transaction(async (tx) => {
    // ৩.ক Idempotency — একই n8n run আবার এলে কিছুই কাটব না
    if (input.runId) {
      const existing = await tx.aIUsageLog.findUnique({
        where: { runId: input.runId },
        select: { creditsDeducted: true, costUsd: true, costSource: true },
      });
      if (existing) {
        return { kind: "duplicate" as const, existing };
      }
    }

    // ৩.খ ব্যালেন্স কাটা — conditional update, তাই race-নিরাপদ।
    // `creditsBalance: { gte }` শর্তটাই আসল রক্ষাকবচ: দুইটা request একসাথে
    // এলে একটা সফল হবে, অন্যটা count=0 পাবে।
    let creditsRemaining: number | null = null;

    if (resolved.credits > 0) {
      const updated = await tx.user.updateMany({
        where: { userId, creditsBalance: { gte: resolved.credits } },
        data: {
          creditsBalance: { decrement: resolved.credits },
          creditsUsedThisCycle: { increment: resolved.credits },
        },
      });

      if (updated.count === 0) {
        return { kind: "insufficient" as const };
      }

      const after = await tx.user.findUnique({
        where: { userId },
        select: { creditsBalance: true },
      });
      creditsRemaining = after?.creditsBalance ?? null;
    } else {
      const after = await tx.user.findUnique({
        where: { userId },
        select: { creditsBalance: true },
      });
      creditsRemaining = after?.creditsBalance ?? null;
    }

    // ৩.গ CreditTransaction — merchant-এর লেজার
    if (resolved.credits > 0) {
      await tx.creditTransaction.create({
        data: {
          userId,
          chatbotId: input.chatbotId ?? null,
          action_type: `reply_${resolved.tier}`,
          model_tier: resolved.tier,
          credits_spent: resolved.credits,
          metadata: {
            model: input.modelId,
            channel,
            sessionId: input.sessionId ?? null,
            runId: input.runId ?? null,
            is_test_chat: isTestChat,
            credit_source: resolved.source,
            extra: input.extra ?? null,
          },
        },
      });
    }

    // ৩.ঘ AIUsageLog — খরচের হিসাব
    const log = await tx.aIUsageLog.create({
      data: {
        userId,
        workspaceId,
        chatbotId: input.chatbotId ?? null,
        sessionId: input.sessionId ?? null,
        channel,
        model: input.modelId,
        modelId: input.modelId,
        promptTokens,
        completionTokens,
        totalTokens: cost.totalTokens,
        llmCallCount,
        costUsd: cost.costUsd,
        costBdt: cost.costBdt,
        creditsDeducted: resolved.credits,
        isFreeMessage: isFree,
        costSource,
        reconciledAt: input.tokensAreExact ? new Date() : null,
        runId: input.runId ?? null,
      },
      select: { id: true },
    });

    return { kind: "created" as const, logId: log.id, creditsRemaining };
  });

  if (outcome.kind === "duplicate") {
    return {
      kind: "duplicate",
      creditsSpent: outcome.existing.creditsDeducted,
      costUsd: outcome.existing.costUsd,
      costSource: outcome.existing.costSource as CostSource,
    };
  }

  if (outcome.kind === "insufficient") {
    const user = await db.user.findUnique({
      where: { userId },
      select: { creditsBalance: true },
    });
    return {
      kind: "insufficient",
      creditsRequired: resolved.credits,
      creditsBalance: user?.creditsBalance ?? 0,
    };
  }

  // ৪. ৮০% / ১০০% সতর্কতা — await করা হয় না, তাই reply ধীর হয় না।
  // Idempotency DB-র unique constraint-এ নিশ্চিত, তাই প্রতি reply-তে নিরাপদ।
  void checkUsageThresholds(userId).catch((err) =>
    console.error("[CHARGE_USAGE_ALERT_ERROR]", err),
  );

  return {
    kind: "created",
    creditsSpent: resolved.credits,
    creditsRemaining: outcome.creditsRemaining,
    costUsd: cost.costUsd,
    costBdt: cost.costBdt,
    costSource,
  };
}

/**
 * P2002 (unique violation) থেকে উদ্ধার — দুটো request একসাথে এলে প্রথমটা জেতে,
 * দ্বিতীয়টা এখানে এসে প্রথমটার ফলাফলটাই পড়ে নেয়।
 *
 * `chargeUsage`-কে ঘিরে থাকা caller-রা ব্যবহার করে, যাতে race-টা ব্যর্থতা
 * হিসেবে না দেখায় (আসলে billing সফলই হয়েছে)।
 */
export async function recoverDuplicateCharge(
  runId: string | undefined,
): Promise<ChargeUsageResult | null> {
  if (!runId) return null;

  const existing = await db.aIUsageLog.findUnique({
    where: { runId },
    select: { creditsDeducted: true, costUsd: true, costSource: true },
  });

  return existing
    ? {
        kind: "duplicate",
        creditsSpent: existing.creditsDeducted,
        costUsd: existing.costUsd,
        costSource: existing.costSource as CostSource,
      }
    : null;
}

export { isUniqueViolation };
