import "server-only";

import { isAIError } from "@/lib/ai/ai-error";
import { assertAIQuota, type QuotaTarget } from "@/lib/ai/quota-guard";
import type { QuotaBlockReason } from "@/lib/domain/ai-quota";
import bnAiErrors from "@/public/locales/bn/ai-errors.json";
import enAiErrors from "@/public/locales/en/ai-errors.json";

/**
 * "May this call run?" — asked once, answered in one shape, for every caller.
 *
 * Two routes need this answer now: `POST /api/internal/ai-quota` (the standalone
 * pre-flight door) and `POST /api/automations/evaluate` (which folded the quota
 * question into the Automation Gate so n8n makes one hop instead of two). Both
 * must give n8n the identical JSON, or the merged node and the standalone node
 * would disagree about the same merchant — which is exactly the class of bug
 * `lib/ai/credit-resolver.ts` exists to prevent for credit amounts.
 *
 * The rules stay in `lib/domain/ai-quota.ts`; the reads stay in
 * `lib/ai/quota-guard.ts`. This module holds only the part that used to be
 * duplicated: which failures mean "refused", and what the customer is told.
 */

/**
 * The refusal a *customer* reads, in both languages.
 *
 * Deliberately not `aiErrors.quota_exceeded`: that string is dashboard copy for
 * the merchant ("top up your credits"). Whoever reads this one is a shopper who
 * has nothing to do with the merchant's billing, and telling them the business
 * ran out of money is the merchant's loss. See `public/locales/{en,bn}/ai-errors.json`.
 *
 * Both languages travel together because the platform does not know what
 * language the customer wrote in — only the AI does, and on a blocked path no
 * model runs. n8n picks one by looking for Bengali script in the message.
 *
 * A `const`, not a function, so a fail-open path that never awaits anything can
 * still attach the copy.
 */
export const QUOTA_REPLY_TEXT = {
  en: enAiErrors.reply_unavailable,
  bn: bnAiErrors.reply_unavailable,
} as const;

export type QuotaAnswerReason =
  /** The owner is out of credits. */
  | QuotaBlockReason
  | "ai_blocked"
  | "practice_mode"
  /** Neither a `chatbotId` nor a `userId` was supplied, so there is no balance to read. */
  | "no_target"
  /** Something unexpected broke; the answer is a deliberate "allow". */
  | "error";

export interface QuotaAnswer {
  allowed: boolean;
  /** `null` when allowed — nothing was refused. */
  reason: QuotaAnswerReason | null;
  /**
   * Always present. The caller can put it straight in the response body, so a
   * blocked turn still ends with a sentence the customer understands.
   */
  replyText: { en: string; bn: string };
  /** Only on an allowed answer that actually read a balance. */
  balance?: number | null;
  requiredCredits?: number;
}

/**
 * Asks the quota guard and turns **both** of its outcomes into one object.
 *
 * ⚠️ This function never throws, and that is load-bearing rather than tidy.
 *    `assertAIQuota` reports a refusal by throwing `AIError`, and its callers
 *    are route handlers with a broad `catch` that fails **open** — they return
 *    "carry on" so a transient database error cannot mute a live conversation.
 *    A refusal thrown into that catch would be swallowed by exactly that rule,
 *    and a merchant with an empty balance would go on spending the platform's
 *    OpenRouter key in complete silence. Catching it here is what keeps the
 *    refusal a *decision* instead of an exception.
 *
 * Failing open on an unexpected error matches `decideQuota`'s own choice for an
 * unreadable balance (`lib/domain/ai-quota.ts`) and the standalone route's
 * behaviour before the merge. The exposure is bounded — `chargeUsage()` still
 * refuses to overdraw — while failing closed would silence every customer of
 * every merchant for the length of one database hiccup.
 */
export async function resolveQuotaAnswer(target: QuotaTarget): Promise<QuotaAnswer> {
  try {
    const decision = await assertAIQuota(target);

    return {
      allowed: true,
      reason: null,
      balance: decision.balance,
      requiredCredits: decision.requiredCredits,
      replyText: QUOTA_REPLY_TEXT,
    };
  } catch (error) {
    if (
      isAIError(error) &&
      (error.code === "quota_exceeded" || error.code === "workspace_suspended")
    ) {
      // Logged, not emailed: an outage that trips this for every merchant would
      // otherwise send one mail per message. The merchant's own deduped alert is
      // fired inside `assertAIQuota`.
      console.warn("[AI_QUOTA] blocked", {
        task: target.task,
        chatbotId: target.chatbotId ?? null,
        userId: target.userId ?? null,
        modelId: target.modelId ?? null,
        reason: error.code,
      });

      return { allowed: false, reason: error.code, replyText: QUOTA_REPLY_TEXT };
    }

    console.error("[AI_QUOTA] unexpected failure, allowing the call", error);
    return { allowed: true, reason: "error", replyText: QUOTA_REPLY_TEXT };
  }
}

/** An "allow" for a caller that never got far enough to read a balance. */
export function failOpenAnswer(reason: "no_target" | "error"): QuotaAnswer {
  return { allowed: true, reason, replyText: QUOTA_REPLY_TEXT };
}
