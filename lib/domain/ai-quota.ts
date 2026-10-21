/**
 * Whether a workspace may make an AI call at all — decided *before* the call.
 *
 * ⚠️ Why this exists, given `chargeUsage()` already refuses to overdraw:
 *    `chargeUsage()` runs **after** the reply was generated, so by the time it
 *    says "insufficient credits" the platform has already paid OpenRouter for
 *    that call. It protects the ledger, not the bank account. This module is the
 *    only thing standing between an empty balance and a burning OpenRouter key.
 *
 * ⚠️ It is advisory, not airtight. Two calls that start at the same instant can
 *    both pass this check and both deduct later; `chargeUsage()`'s conditional
 *    update is what stops the balance going negative. Say so out loud rather than
 *    implying a guarantee the code does not provide.
 *
 * Pure: the balance and workspace status are read by the caller, so every rule
 * below is unit-testable.
 */

import { getTaskPolicy, type AITask } from "@/lib/domain/ai-task";

export type QuotaBlockReason =
  /** The owner's credit balance is empty (or short of what this call needs). */
  | "quota_exceeded"
  /** An admin suspended the workspace; it must not produce AI output at all. */
  | "workspace_suspended";

export type QuotaDecision =
  | { allowed: true; requiredCredits: number; balance: number | null }
  | { allowed: false; reason: QuotaBlockReason; requiredCredits: number; balance: number | null };

export interface QuotaInput {
  task: AITask;
  /** The owner's credit balance. `null` = could not be read. */
  balance: number | null;
  /** `Workspace.status` — "active" | "warning" | "suspended". */
  workspaceStatus?: string | null;
  /** A free message is exempt from the credit floor, but not from suspension. */
  isFreeMessage?: boolean;
  /** What this call is expected to cost. Ignored for tasks that are never charged. */
  requiredCredits?: number;
}

export const SUSPENDED_WORKSPACE_STATUS = "suspended";

export function decideQuota({
  task,
  balance,
  workspaceStatus,
  isFreeMessage = false,
  requiredCredits = 0,
}: QuotaInput): QuotaDecision {
  const policy = getTaskPolicy(task);

  // A task that is never billed cannot be short of credits — computing the
  // requirement here, in one place, is what stops a caller from accidentally
  // passing a nonzero cost for a task that does not charge anything.
  const needed = policy.isCharged ? Math.max(0, requiredCredits) : 0;

  // 1. Suspension outranks everything, including free messages: an admin who
  //    has cut a workspace off does not want it answering customers at all.
  if (workspaceStatus === SUSPENDED_WORKSPACE_STATUS) {
    return { allowed: false, reason: "workspace_suspended", requiredCredits: needed, balance };
  }

  // 2. An unreadable balance fails **open**. Failing closed here would mute a
  //    live customer conversation because of a transient database error — the
  //    same reasoning `/api/automations/evaluate` already uses. The cost of the
  //    mistake is bounded (a few calls at the end of a cycle); the cost of the
  //    alternative is a merchant's customers getting no reply at all.
  if (balance === null) {
    return { allowed: true, requiredCredits: needed, balance };
  }

  if (isFreeMessage) {
    return { allowed: true, requiredCredits: needed, balance };
  }

  // 3. The floor that applies to **every** task. Even work the platform never
  //    bills for costs real money at OpenRouter, so an empty balance must stop
  //    all of it — otherwise a merchant who has paid nothing can keep spending
  //    the platform's key indefinitely through prompt enhancement, translation
  //    and auto-training.
  if (balance <= 0) {
    return { allowed: false, reason: "quota_exceeded", requiredCredits: needed, balance };
  }

  // 4. Charged tasks must additionally cover what this call will cost.
  if (needed > 0 && balance < needed) {
    return { allowed: false, reason: "quota_exceeded", requiredCredits: needed, balance };
  }

  return { allowed: true, requiredCredits: needed, balance };
}
