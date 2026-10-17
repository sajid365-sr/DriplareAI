import { AIError, type AIErrorCode } from "@/lib/ai/ai-error";
import {
  classifyFailure,
  planNextAttempt,
  type AttemptFailure,
  type RetryFailureKind,
  type RetryPolicy,
} from "@/lib/domain/ai-retry";

// ══════════════════════════════════════════════════════════════════════════════
// The model chain
// ══════════════════════════════════════════════════════════════════════════════
//
// Walks an ordered list of models until one answers, deciding after every failed
// attempt whether to wait and try the same model again, move to the next one, or
// give up. The decisions come from `ai-retry.ts`; this module only carries them
// out and keeps the clock.
//
// ⚠️ Pure by construction — no network, no database, no `server-only`. The
//    providers and the quota gate live in `lib/ai/gateway.ts`, which calls in
//    here. Splitting them is what makes the budget and fallback rules testable:
//    every interesting case (a chain that only succeeds on its last model, a
//    budget that runs out mid-flight, a 401 that must not be retried) is a
//    two-line test against a fake `attempt`, instead of a mocked SDK.
// ══════════════════════════════════════════════════════════════════════════════

export interface ModelUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** One attempt that worked, carrying whatever the provider returned. */
export interface AttemptSuccess<T> {
  kind: "success";
  value: T;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type AttemptResult<T> = AttemptSuccess<T> | AttemptFailure;

export interface RunModelChainInput<T> {
  task: string;
  /** Models to try, in order. Must start with the primary. */
  order: string[];
  policy: RetryPolicy;
  /** `Date.now()` at the moment the whole call began. */
  startedAt: number;
  /** One call against one model, given the time it is allowed to take. */
  attempt: (model: string, timeoutMs: number) => Promise<AttemptResult<T>>;
  /** Injectable so tests do not actually wait. */
  wait?: (ms: number) => Promise<void>;
  /** Injectable clock, so a test can advance past the budget without sleeping. */
  now?: () => number;
}

export interface RunModelChainResult<T> {
  value: T;
  /** The model that answered. */
  model: string;
  usage: ModelUsage;
  /** Every model tried, in order — a repeat appears once per retry. */
  tried: string[];
}

/**
 * The last resort against a bad plan. `planNextAttempt` already bounds retries
 * by the budget, but if it were ever handed a policy with an enormous budget and
 * a zero delay it would loop forever; this cannot be reached by arithmetic.
 */
export const ATTEMPTS_PER_MODEL_HARD_CAP = 5;

/** Which public error code each internal failure becomes. */
const FAILURE_CODE: Record<RetryFailureKind, AIErrorCode> = {
  rate_limited: "rate_limited",
  provider_out_of_credit: "provider_out_of_credit",
  not_configured: "not_configured",
  model_failed: "all_models_failed",
};

export function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function failure(
  kind: RetryFailureKind,
  task: string,
  model: string,
  tried: string[],
  latencyMs: number
): AIError {
  const error = new AIError(FAILURE_CODE[kind], `AI gateway exhausted ${tried.length} attempt(s) for task "${task}"`, {
    task,
    model,
    tried,
    attempts: tried.length,
    latencyMs,
  });

  // ⚠️ An operational failure means every workspace is about to stop, which is
  //    an outage rather than a per-merchant event. It is logged loudly here and
  //    nothing else is done about it: a real alert channel (email/Slack, with
  //    the dedupe needed to avoid one mail per failed call) belongs to TASK-21,
  //    whose whole subject is alerting. Mailing from this path would mean one
  //    message per failed request, which is a worse outage than the one it
  //    would be reporting.
  if (error.isOperational) {
    console.error("[AI_GATEWAY_ALERT] operational AI failure — every workspace is affected", {
      code: error.code,
      task,
      model,
      tried,
      latencyMs,
    });
  }

  return error;
}

/**
 * Runs the chain and returns the first success, or throws an `AIError`.
 *
 * `timeoutMs` handed to each attempt is whatever is left of the budget, so a
 * slow model cannot overrun the promise made to the caller. The consequence is
 * deliberate: a model that consumes the whole budget gets no fallback, because
 * the merchant chose that model and waiting for it beats silently answering from
 * a different one. Outages fail fast (402/404/429/5xx), which is exactly when
 * the chain still has room to run.
 */
export async function runModelChain<T>({
  task,
  order,
  policy,
  startedAt,
  attempt,
  wait = sleep,
  now = Date.now,
}: RunModelChainInput<T>): Promise<RunModelChainResult<T>> {
  const tried: string[] = [];
  let lastKind: RetryFailureKind = "model_failed";

  for (let index = 0; index < order.length; index += 1) {
    const model = order[index];
    const hasMoreModels = index < order.length - 1;
    let attemptsForModel = 0;

    while (attemptsForModel < ATTEMPTS_PER_MODEL_HARD_CAP) {
      attemptsForModel += 1;
      tried.push(model);

      const remainingMs = policy.budgetMs - (now() - startedAt);
      const outcome = await attempt(model, Math.max(1, remainingMs));

      if (outcome.kind === "success") {
        return {
          value: outcome.value,
          model,
          usage: {
            promptTokens: outcome.promptTokens,
            completionTokens: outcome.completionTokens,
            totalTokens: outcome.totalTokens,
          },
          tried,
        };
      }

      const plan = planNextAttempt({
        outcome,
        attemptsForModel,
        elapsedMs: now() - startedAt,
        hasMoreModels,
        policy,
      });

      lastKind = classifyFailure(outcome) ?? lastKind;

      if (plan.action === "retry_same") {
        await wait(plan.delayMs);
        continue;
      }

      if (plan.action === "next_model") break;

      throw failure(plan.kind, task, model, tried, now() - startedAt);
    }
  }

  throw failure(lastKind, task, order[order.length - 1] ?? "unknown", tried, now() - startedAt);
}
