import { describe, expect, it } from "vitest";

import {
  DEFAULT_RETRY_POLICY,
  classifyFailure,
  planNextAttempt,
  type AttemptOutcome,
  type RetryFailureKind,
} from "./ai-retry";

/** No jitter, so the backoff arithmetic below is exact. */
const NO_JITTER = () => 0;

function plan(
  outcome: AttemptOutcome,
  overrides: Partial<Parameters<typeof planNextAttempt>[0]> = {}
) {
  return planNextAttempt({
    outcome,
    attemptsForModel: 1,
    elapsedMs: 0,
    hasMoreModels: true,
    random: NO_JITTER,
    ...overrides,
  });
}

const http = (status: number, retryAfterMs?: number | null): AttemptOutcome => ({
  kind: "http",
  status,
  retryAfterMs,
});

const NETWORK: AttemptOutcome = { kind: "network" };

describe("classifyFailure", () => {
  it.each([
    [402, "provider_out_of_credit"],
    [429, "rate_limited"],
    [401, "not_configured"],
    [403, "not_configured"],
    [404, "model_failed"],
    [500, "model_failed"],
    [502, "model_failed"],
    [503, "model_failed"],
    [400, "model_failed"],
  ] satisfies Array<[number, RetryFailureKind]>)("reads HTTP %i as %s", (status, kind) => {
    expect(classifyFailure(http(status))).toBe(kind);
  });

  it("reads a network failure as a model failure", () => {
    expect(classifyFailure(NETWORK)).toBe("model_failed");
  });

  it("reads an empty completion as a model failure", () => {
    expect(classifyFailure({ kind: "empty" })).toBe("model_failed");
  });

  it("returns null for a success, which is not a failure at all", () => {
    expect(classifyFailure({ kind: "success" })).toBeNull();
  });
});

describe("planNextAttempt — budget", () => {
  it("retries the same model while attempts remain and the budget allows", () => {
    expect(plan(http(429))).toEqual({ action: "retry_same", delayMs: 500 });
  });

  it("doubles the delay for the second wait", () => {
    expect(plan(http(429), { attemptsForModel: 2, policy: { maxAttemptsPerModel: 3 } })).toEqual({
      action: "retry_same",
      delayMs: 1_000,
    });
  });

  it("caps the exponential growth at maxDelayMs", () => {
    const result = plan(http(500), { attemptsForModel: 6, policy: { maxAttemptsPerModel: 7 } });

    expect(result).toEqual({ action: "retry_same", delayMs: DEFAULT_RETRY_POLICY.maxDelayMs });
  });

  it("keeps the jitter within a quarter of the delay", () => {
    const full = planNextAttempt({
      outcome: http(429),
      attemptsForModel: 1,
      elapsedMs: 0,
      hasMoreModels: true,
      random: () => 1,
    });

    expect(full).toEqual({ action: "retry_same", delayMs: 625 });
  });

  it("fails instead of sleeping into the platform timeout", () => {
    // Only 600ms of budget left: a 500ms sleep plus the 1500ms reserved for the
    // call itself does not fit.
    const result = plan(http(429), { elapsedMs: DEFAULT_RETRY_POLICY.budgetMs - 600 });

    expect(result).toEqual({ action: "fail", kind: "rate_limited" });
  });

  it("moves to the next model rather than sleeping when the budget is nearly gone", () => {
    // 1600ms left: too little for a sleep plus a call, but enough for one call.
    const result = plan(http(429), { elapsedMs: DEFAULT_RETRY_POLICY.budgetMs - 1_600 });

    expect(result).toEqual({ action: "next_model" });
  });

  it("fails when the budget cannot fit even one more call", () => {
    const result = plan(http(500), { elapsedMs: DEFAULT_RETRY_POLICY.budgetMs - 100, hasMoreModels: true });

    expect(result).toEqual({ action: "fail", kind: "model_failed" });
  });
});

describe("planNextAttempt — which failures are worth waiting out", () => {
  it("honours Retry-After over the computed backoff", () => {
    expect(plan(http(429, 3_000))).toEqual({ action: "retry_same", delayMs: 3_000 });
  });

  it("ignores a Retry-After that is shorter than the backoff", () => {
    // The provider's hint is a floor, not an instruction to hurry.
    expect(plan(http(429, 100))).toEqual({ action: "retry_same", delayMs: 500 });
  });

  it.each([[null], [undefined], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    "ignores the unusable Retry-After value %p",
    (retryAfterMs) => {
      expect(plan(http(429, retryAfterMs))).toEqual({ action: "retry_same", delayMs: 500 });
    }
  );

  it("retries a network failure", () => {
    expect(plan(NETWORK)).toEqual({ action: "retry_same", delayMs: 500 });
  });

  it.each([[500], [502], [503], [504]])("retries HTTP %i", (status) => {
    expect(plan(http(status))).toEqual({ action: "retry_same", delayMs: 500 });
  });

  it("does not retry a 402 — sleeping does not restore the account's credit", () => {
    expect(plan(http(402))).toEqual({ action: "next_model" });
  });

  it("does not retry a 404 — a retired model id stays retired", () => {
    expect(plan(http(404))).toEqual({ action: "next_model" });
  });

  it("does not retry a 400", () => {
    expect(plan(http(400))).toEqual({ action: "next_model" });
  });

  it("does not retry an empty completion — asking the same model again rarely helps", () => {
    expect(plan({ kind: "empty" })).toEqual({ action: "next_model" });
  });

  it("reports an empty completion as a model failure when the chain is exhausted", () => {
    expect(plan({ kind: "empty" }, { hasMoreModels: false })).toEqual({
      action: "fail",
      kind: "model_failed",
    });
  });

  it("stops retrying the same model once maxAttemptsPerModel is reached", () => {
    expect(plan(http(429), { attemptsForModel: 2 })).toEqual({ action: "next_model" });
  });
});

describe("planNextAttempt — running out of options", () => {
  it("reports a rate limit as a rate limit when the whole chain is rate limited", () => {
    expect(plan(http(429), { attemptsForModel: 2, hasMoreModels: false })).toEqual({
      action: "fail",
      kind: "rate_limited",
    });
  });

  it("reports an empty OpenRouter balance as an operational failure, not a model one", () => {
    // This is the TASK-21 signal: every model answering 402 means the platform's
    // own credit is gone and every workspace is about to stop.
    expect(plan(http(402), { hasMoreModels: false })).toEqual({
      action: "fail",
      kind: "provider_out_of_credit",
    });
  });

  it("gives up immediately on a rejected key instead of walking the whole chain", () => {
    // Every model will answer 401 identically; trying them just delays the
    // report by the length of the chain.
    expect(plan(http(401), { hasMoreModels: true })).toEqual({
      action: "fail",
      kind: "not_configured",
    });
    expect(plan(http(403), { hasMoreModels: true })).toEqual({
      action: "fail",
      kind: "not_configured",
    });
  });

  it("refuses to retry a 401 even when the attempt budget would allow it", () => {
    // Documents that the early exit is a deliberate rule and not an accident of
    // the switch statement: it is enforced before the transient-failure check,
    // so raising maxAttemptsPerModel cannot bring the retry back.
    const result = planNextAttempt({
      outcome: http(401),
      attemptsForModel: 1,
      elapsedMs: 0,
      hasMoreModels: true,
      policy: { maxAttemptsPerModel: 3, baseDelayMs: 10 },
      random: NO_JITTER,
    });

    expect(result).toEqual({ action: "fail", kind: "not_configured" });
  });

  it("reports a generic failure when a retired id exhausts the chain", () => {
    expect(plan(http(404), { hasMoreModels: false })).toEqual({ action: "fail", kind: "model_failed" });
  });
});

describe("planNextAttempt — purity", () => {
  it("does not mutate the caller's policy", () => {
    const policy = { budgetMs: 50 };
    plan(http(429), { policy });

    expect(policy).toEqual({ budgetMs: 50 });
  });

  it("is deterministic for the same inputs", () => {
    const args = { outcome: http(429), attemptsForModel: 1, elapsedMs: 0, hasMoreModels: true, random: NO_JITTER };

    expect(planNextAttempt(args)).toEqual(planNextAttempt(args));
  });
});
