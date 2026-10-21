/**
 * What to do after one attempt at one model fails.
 *
 * This is the decision table behind TASK-10's "429 / 402 / timeout handling". It
 * is pure so that every branch — including the ones that are hard to provoke
 * against a live provider — can be tested directly.
 *
 * The governing constraint is that a caller is waiting. A customer message has a
 * human on the other end and a platform timeout above us, so retrying is a budget
 * to spend, not a virtue: `budgetMs` is the total wall clock this call may
 * consume, and the reserve for the call itself is subtracted before any sleep is
 * approved. When the budget cannot fit another attempt, the honest answer is to
 * fail now rather than to be killed mid-flight by the platform.
 */

/** The four ways an attempt can end. */
export type AttemptOutcome =
  | { kind: "success" }
  /** The provider answered with an HTTP status. */
  | { kind: "http"; status: number; retryAfterMs?: number | null }
  /** The request never completed — DNS, TLS, socket reset, timeout. */
  | { kind: "network" }
  /**
   * The provider answered 200 with nothing in it. Real, and worth a fallback:
   * an empty completion reaches the customer as silence, so treating it as a
   * success would turn a recoverable provider hiccup into a dropped reply.
   */
  | { kind: "empty" };

/**
 * The same set minus the success signal.
 *
 * The gateway carries the provider's payload on its own success variant, so it
 * must be able to say "failed" without the two `kind: "success"` shapes
 * colliding. This is the type for that: every outcome a caller only sees after
 * something went wrong.
 */
export type AttemptFailure = Exclude<AttemptOutcome, { kind: "success" }>;

/**
 * Why the whole call failed, once every model is exhausted.
 *
 * Deliberately not `AIErrorCode`: this layer must not need to know how the
 * gateway names its errors, and the codes differ anyway — several of these map
 * onto one code when there is only one model left to try.
 */
export type RetryFailureKind =
  /** The provider's rate limit, not ours. */
  | "rate_limited"
  /** OpenRouter answered 402: the platform's own credit is gone. */
  | "provider_out_of_credit"
  /** The key is missing or was rejected — no model will work. */
  | "not_configured"
  /** Anything else: retired model id, 5xx, malformed request, network. */
  | "model_failed";

export type RetryPlan =
  /** Sleep, then try the same model again. */
  | { action: "retry_same"; delayMs: number }
  /** Move to the next model in the chain immediately. */
  | { action: "next_model" }
  /** Stop. Nothing left to try, or nothing left in the budget. */
  | { action: "fail"; kind: RetryFailureKind };

export interface RetryPolicy {
  /** Attempts allowed per model, including the first. */
  maxAttemptsPerModel: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Total wall clock this call may consume, across all models and sleeps. */
  budgetMs: number;
  /** Reserved per remaining attempt for the call itself, not for sleeping. */
  assumedCallMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttemptsPerModel: 2,
  baseDelayMs: 500,
  maxDelayMs: 4_000,
  // Kept well under the shortest platform timeout above us. Raising this
  // without checking the caller's own limit turns a slow reply into a 504.
  budgetMs: 10_000,
  assumedCallMs: 1_500,
};

const JITTER_RATIO = 0.25;

/**
 * Which failure this attempt represents, or `null` when it succeeded. Used for
 * the final error when the chain runs out, so a rate limit is reported as a rate
 * limit rather than as a generic "something went wrong".
 */
export function classifyFailure(outcome: AttemptOutcome): RetryFailureKind | null {
  if (outcome.kind === "success") return null;
  // Both of these mean "this model did not deliver", with no status to read.
  if (outcome.kind === "network" || outcome.kind === "empty") return "model_failed";

  switch (outcome.status) {
    case 402:
      return "provider_out_of_credit";
    case 429:
      return "rate_limited";
    case 401:
    case 403:
      return "not_configured";
    default:
      return "model_failed";
  }
}

/** Exponential backoff with jitter, widened to honour `Retry-After` when given. */
function computeDelay(outcome: AttemptOutcome, attemptsForModel: number, policy: RetryPolicy, random: () => number) {
  const exponential = policy.baseDelayMs * 2 ** (attemptsForModel - 1);
  const jitter = Math.floor(exponential * JITTER_RATIO * random());
  let delay = Math.min(policy.maxDelayMs, exponential) + jitter;

  const retryAfterMs = outcome.kind === "http" ? outcome.retryAfterMs : null;
  if (typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs) && retryAfterMs > delay) {
    delay = retryAfterMs;
  }

  return delay;
}

export interface NextAttemptInput {
  outcome: AttemptOutcome;
  /** Attempts already made against the current model, including the one that just failed. */
  attemptsForModel: number;
  /** Wall clock spent so far, including all previous models and sleeps. */
  elapsedMs: number;
  /** Whether the chain still has an untried model after this one. */
  hasMoreModels: boolean;
  policy?: Partial<RetryPolicy>;
  /** Injectable so the backoff is deterministic in tests. */
  random?: () => number;
}

export function planNextAttempt({
  outcome,
  attemptsForModel,
  elapsedMs,
  hasMoreModels,
  policy: policyOverrides,
  random = Math.random,
}: NextAttemptInput): RetryPlan {
  const policy = { ...DEFAULT_RETRY_POLICY, ...policyOverrides };
  const kind = classifyFailure(outcome) ?? "model_failed";

  // Unreachable through the gateway, which returns as soon as an attempt
  // succeeds. Kept so that a future caller cannot read "no plan" as "retry
  // forever".
  if (outcome.kind === "success") {
    return { action: "fail", kind };
  }

  // A rejected or missing key is not a property of the model — every model in
  // the chain will answer the same way, so walking the chain only wastes the
  // caller's time before reporting the same thing.
  if (kind === "not_configured") {
    return { action: "fail", kind };
  }

  const canStayOnThisModel =
    attemptsForModel < policy.maxAttemptsPerModel &&
    // 402 and 404 mean "this model cannot serve you" — sleeping does not change
    // that, and the fallback model is the only thing that might. 429 and 5xx are
    // the transient ones worth waiting out.
    (outcome.kind === "network" ||
      (outcome.kind === "http" && (outcome.status === 429 || outcome.status >= 500)));

  if (canStayOnThisModel) {
    const delayMs = computeDelay(outcome, attemptsForModel, policy, random);
    // The reserve matters: approving a sleep because the budget "has room" while
    // leaving too little for the call itself just moves the failure to the
    // platform's timeout, where the reason is lost.
    const remaining = policy.budgetMs - elapsedMs;
    if (delayMs + policy.assumedCallMs <= remaining) {
      return { action: "retry_same", delayMs };
    }
  }

  if (hasMoreModels) {
    const remaining = policy.budgetMs - elapsedMs;
    if (policy.assumedCallMs <= remaining) {
      return { action: "next_model" };
    }
  }

  return { action: "fail", kind };
}
