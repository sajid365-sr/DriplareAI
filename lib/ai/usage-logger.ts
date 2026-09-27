import "server-only";

import { db } from "@/lib/core/db";
import { calculateUsageCost, getModelCredits } from "@/lib/ai/cost-calculator";

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
  creditsDeducted?: number;
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

    // 3. Determine credits deducted
    let creditsToRecord = payload.creditsDeducted;
    if (creditsToRecord === undefined) {
      if (payload.isFreeMessage) {
        creditsToRecord = 0;
      } else {
        creditsToRecord = await getModelCredits(modelId);
      }
    }

    // 4. Asynchronously create record in AIUsageLog
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
      },
    });
  } catch (error) {
    // Non-blocking log failure
    console.error("[AI_USAGE_LOGGER_ERROR] Failed to save AIUsageLog:", error);
  }
}
