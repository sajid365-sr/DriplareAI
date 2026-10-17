import "server-only";

import { db } from "@/lib/core/db";
import { calculateUsageCost, getModelCredits } from "@/lib/ai/cost-calculator";
import type { AITask } from "@/lib/domain/ai-task";

// ══════════════════════════════════════════════════════════════════════════════
// AI Usage Logger Utility
//
// OpenRouter এবং অন্যান্য AI ইন্টিগ্রেশন থেকে টোকেন ইউসেজ ক্যাপচার করে
// AIUsageLog টেবিলে অ্যাসিঙ্ক্রোনাসলি (non-blocking fire-and-forget) রেকর্ড করে।
// ══════════════════════════════════════════════════════════════════════════════

export interface LogAiUsagePayload {
  workspaceId?: string;
  chatbotId?: string;
  sessionId?: string;
  channel: string; // 'facebook', 'whatsapp', 'instagram', 'playground', 'compare', 'web', 'enhance_prompt', etc.
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  userId?: string;
  isFreeMessage?: boolean;
  /**
   * credit কত কাটবে। না দিলে `credit-resolver.ts` থেকে নিজে বের করবে —
   * **এটাই স্বাভাবিক**, কারণ credit-এর একটাই source of truth থাকা উচিত।
   */
  creditsDeducted?: number;
  /** ড্যাশবোর্ড টেস্ট চ্যাট হলে credit-এ গুণক বসবে */
  isTestChat?: boolean;
  /** n8n execution id — একই execution দুইবার log হলে ডুপ্লিকেট হবে না */
  runId?: string;
  /** এক reply-তে agent কতবার LLM কল করেছে */
  llmCallCount?: number;

  /**
   * What kind of AI work this was (TASK-10). Optional so the callers that have
   * not moved to the gateway keep working; `null` in the column means exactly
   * that — the row was written by a path that does not know its task.
   *
   * ⚠️ This is not the same question as `channel`. `channel` says where the
   *    customer came from (facebook/whatsapp/web); `task` says what the model was
   *    asked to do. Historically a few callers wrote their task into `channel`,
   *    which is why the two are now separate columns instead of one overloaded one.
   */
  task?: AITask;
  /** Total wall clock the gateway call took, across retries and fallbacks. */
  latencyMs?: number;
  /** The model tried first, when a fallback meant it was not the one that answered. */
  fallbackFrom?: string | null;
}

/**
 * AI usage log ডাটাবেজে অ্যাসিঙ্ক্রোনাসলি সংরক্ষণ করে।
 * সম্পূর্ণ অপারেশানটি try/catch এর মাধ্যমে সুরক্ষিত যেন কোনো ডাটাবেজ এরর লাইভ চ্যাট স্ট্রিম বা রেসপন্সে বাধা না দেয়।
 *
 * @param payload - LogAiUsagePayload
 */
export async function logAiUsage(payload: LogAiUsagePayload): Promise<void> {
  try {
    const promptTokens = Math.max(0, payload.promptTokens || 0);
    const completionTokens = Math.max(0, payload.completionTokens || 0);
    const modelId = payload.modelId || "google/gemini-2.5-flash-lite";

    // 1. Calculate actual USD/BDT cost
    const costDetails = await calculateUsageCost(modelId, promptTokens, completionTokens);

    // 2. Determine workspaceId & userId if not provided
    let resolvedUserId = payload.userId;
    let resolvedWorkspaceId = payload.workspaceId;

    if ((!resolvedUserId || !resolvedWorkspaceId) && payload.chatbotId) {
      const bot = await db.chatbot.findFirst({
        where: { chatbotId: payload.chatbotId },
        select: { userId: true, workspaceId: true },
      });
      if (bot) {
        resolvedUserId = resolvedUserId || bot.userId;
        resolvedWorkspaceId = resolvedWorkspaceId || bot.workspaceId || undefined;
      }
    }

    if (!resolvedUserId) {
      console.warn("[AI_USAGE_LOGGER] Cannot log usage: missing userId and chatbotId");
      return;
    }

    // 3. Determine credits deducted — single source of truth (`credit-resolver.ts`)
    let creditsToRecord = payload.creditsDeducted;
    if (creditsToRecord === undefined) {
      if (payload.isFreeMessage) {
        creditsToRecord = 0;
      } else {
        creditsToRecord = await getModelCredits(modelId, { isTestChat: payload.isTestChat });
      }
    }

    // 4. Asynchronously create record in AIUsageLog
    //
    // ℹ️ `costSource` এখন `"estimated"`-ই থাকে, কারণ টোকেনগুলো এখনো n8n-এর
    //    অনুমান। দাম অবশ্য আসল (OpenRouter-এর লাইভ)। ধাপ ৭-এর reconciler
    //    n8n execution থেকে আসল টোকেন এনে এটিকে `"exact"` করে দেবে।
    await db.aIUsageLog.create({
      data: {
        workspaceId: resolvedWorkspaceId ?? null,
        chatbotId: payload.chatbotId ?? null,
        sessionId: payload.sessionId ?? null,
        channel: payload.channel || "web",
        model: modelId,
        modelId: modelId,
        promptTokens: promptTokens,
        completionTokens: completionTokens,
        totalTokens: costDetails.totalTokens,
        costUsd: costDetails.costUsd,
        costBdt: costDetails.costBdt,
        creditsDeducted: creditsToRecord,
        isFreeMessage: payload.isFreeMessage ?? false,
        userId: resolvedUserId,
        costSource: "estimated",
        llmCallCount: payload.llmCallCount ?? 0,
        runId: payload.runId ?? null,
        // ⚠️ Only included when the caller actually has a value. Prisma omits an
        //    `undefined` field from the INSERT, so a database that has not had
        //    the TASK-10 column migration applied yet keeps logging cost rows
        //    instead of failing every insert — and losing the whole ledger — the
        //    moment the new code is deployed ahead of the SQL.
        ...(payload.task ? { task: payload.task } : {}),
        ...(payload.latencyMs !== undefined ? { latencyMs: payload.latencyMs } : {}),
        ...(payload.fallbackFrom ? { fallbackFrom: payload.fallbackFrom } : {}),
      },
    });
  } catch (error) {
    // Non-blocking log failure
    console.error("[AI_USAGE_LOGGER_ERROR] Failed to save AIUsageLog:", error);
  }
}
