import "server-only";

import { cache } from "react";

import { AIError, isAIError } from "@/lib/ai/ai-error";
import { resolveReplyCredits } from "@/lib/ai/credit-resolver";
import { db } from "@/lib/core/db";
import { decideQuota, type QuotaDecision } from "@/lib/domain/ai-quota";
import { getTaskPolicy, type AITask } from "@/lib/domain/ai-task";

/**
 * Reads whatever is needed to answer "may this call happen?" and refuses when
 * the answer is no.
 *
 * ⚠️ The reads are wrapped in React's `cache`, and that is not a micro-
 *    optimisation. A single ingestion routinely embeds hundreds of chunks, and
 *    without per-request memoisation every chunk would re-read the same user,
 *    the same workspace and the same admin credit rules — turning one page of
 *    work into several hundred identical queries. `cache` keys on the argument
 *    values, so an entire request shares one read of each.
 *
 * The rules themselves are in `lib/domain/ai-quota.ts`; this module only
 * supplies them with facts.
 */

export interface QuotaTarget {
  task: AITask;
  /** Any of the three may be supplied; whatever is missing is looked up. */
  userId?: string | null;
  chatbotId?: string | null;
  workspaceId?: string | null;
  /** Only consulted for tasks the platform actually bills. */
  modelId?: string | null;
  isTestChat?: boolean;
  isFreeMessage?: boolean;
}

interface WorkspaceOwner {
  userId: string | null;
  workspaceId: string | null;
}

const readChatbotOwner = cache(async (chatbotId: string): Promise<WorkspaceOwner> => {
  const bot = await db.chatbot.findFirst({
    where: { chatbotId },
    select: { userId: true, workspaceId: true },
  });

  return { userId: bot?.userId ?? null, workspaceId: bot?.workspaceId ?? null };
});

const readBalance = cache(async (userId: string): Promise<number | null> => {
  const user = await db.user.findUnique({ where: { userId }, select: { creditsBalance: true } });
  return user?.creditsBalance ?? null;
});

const readWorkspaceStatus = cache(async (workspaceId: string): Promise<string | null> => {
  const workspace = await db.workspace.findUnique({
    where: { workspaceId },
    select: { status: true },
  });
  return workspace?.status ?? null;
});

const readCreditCost = cache(async (modelId: string, isTestChat: boolean): Promise<number> => {
  // The same resolver `chargeUsage()` bills with, so the amount checked here and
  // the amount actually deducted can never disagree.
  return (await resolveReplyCredits(modelId, { isTestChat })).credits;
});

/**
 * Lets the merchant know their credits ran out.
 *
 * Loaded dynamically, following `lib/services/feedback.ts`, so the mail stack is
 * not pulled into the module graph of every route that merely *might* block a
 * call. `checkUsageThresholds` swallows its own errors, but the import itself
 * can still fail, so the whole thing is wrapped.
 */
async function notifyCreditsExhausted(userId: string): Promise<void> {
  try {
    const { checkUsageThresholds } = await import("@/lib/services/usage-alerts");
    const outcome = await checkUsageThresholds(userId);

    if (outcome && outcome.fired.length > 0) {
      console.warn("[AI_QUOTA] credits exhausted — merchant notified", {
        userId,
        fired: outcome.fired,
      });
    }
  } catch (error) {
    console.error("[AI_QUOTA] could not notify the merchant about exhausted credits", error);
  }
}

export async function assertAIQuota(target: QuotaTarget): Promise<QuotaDecision> {
  try {
    let userId = target.userId ?? null;
    let workspaceId = target.workspaceId ?? null;

    if (target.chatbotId && (!userId || !workspaceId)) {
      const owner = await readChatbotOwner(target.chatbotId);
      userId = userId ?? owner.userId;
      workspaceId = workspaceId ?? owner.workspaceId;
    }

    const policy = getTaskPolicy(target.task);

    const [balance, workspaceStatus] = await Promise.all([
      userId ? readBalance(userId) : Promise.resolve(null),
      workspaceId ? readWorkspaceStatus(workspaceId) : Promise.resolve(null),
    ]);

    const requiredCredits =
      policy.isCharged && target.modelId ? await readCreditCost(target.modelId, target.isTestChat === true) : 0;

    const decision = decideQuota({
      task: target.task,
      balance,
      workspaceStatus,
      isFreeMessage: target.isFreeMessage,
      requiredCredits,
    });

    if (!decision.allowed) {
      // ── কেউ যেন জানতে পারে ────────────────────────────────────────────────
      //
      // ⚠️ আগে এখানে কিছুই হত না। merchant-এর credit শেষ হয়ে গেলে reply আসা
      //    বন্ধ হয়ে যেত, কিন্তু কেউ জানত না — কারণ `checkUsageThresholds` কেবল
      //    *সফল* charge-এর পরে ডাকা হয়, আর credit শেষ হওয়ার পর কোনো charge-ই
      //    হয় না। ফলে "credit শেষ" মেইলটা হয়তো কখনোই যেত না।
      //
      //    `checkUsageThresholds` নিজেই `claimAlert` দিয়ে DB-তে dedupe করা এবং
      //    merchant-এর notification setting মানে, তাই একটা আটকে যাওয়া loop
      //    শত শত মেইল পাঠাবে না — threshold প্রতি চক্রে ঠিক একবার যাবে।
      //
      // suspension আলাদা: ওটা admin-এর সিদ্ধান্ত, merchant-কে "recharge করুন"
      // বলার বিষয় নয়।
      if (decision.reason === "quota_exceeded" && userId) {
        void notifyCreditsExhausted(userId);
      }

      throw new AIError(
        decision.reason,
        decision.reason === "workspace_suspended"
          ? "This workspace is suspended"
          : `Insufficient credits: ${decision.requiredCredits} required, ${decision.balance ?? 0} available`,
        { task: target.task, model: target.modelId ?? undefined }
      );
    }

    return decision;
  } catch (error) {
    // Our own refusal is a decision, not a failure — it must not be swallowed
    // by the fail-open path underneath it.
    if (isAIError(error)) throw error;

    // ⚠️ Fails **open**, deliberately. A transient database error must not mute
    //    a live customer conversation; the same reasoning
    //    `/api/automations/evaluate` already uses. The exposure is bounded to
    //    whatever the closing calls of a cycle cost, and `chargeUsage()` still
    //    refuses to overdraw the balance afterwards.
    console.error("[AI_QUOTA] check failed, allowing the call", error);
    return { allowed: true, requiredCredits: 0, balance: null };
  }
}
