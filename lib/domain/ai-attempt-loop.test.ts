import { describe, expect, it, vi } from "vitest";

import { runModelChain, type AttemptResult } from "@/lib/domain/ai-attempt-loop";
import type { RetryPolicy } from "@/lib/domain/ai-retry";

/**
 * The model chain is the piece of TASK-10 that decides what a merchant's
 * customer actually sees when a provider fails, so these tests aim at the
 * decisions rather than at the plumbing: which model is tried next, when a
 * retry is worth the wait, and when the whole call gives up.
 *
 * Everything is injected — the provider, the clock and the sleep — so the suite
 * covers a 10-second budget in microseconds and never opens a socket.
 */

const POLICY: RetryPolicy = {
  maxAttemptsPerModel: 2,
  baseDelayMs: 500,
  maxDelayMs: 4_000,
  budgetMs: 10_000,
  assumedCallMs: 1_500,
};

function success<T>(value: T, tokens = { promptTokens: 10, completionTokens: 5, totalTokens: 15 }): AttemptResult<T> {
  return { kind: "success", value, ...tokens };
}

/** A controllable clock: `advance` moves it without anything actually waiting. */
function createClock(start = 1_000_000) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

function run<T>(
  order: string[],
  attempt: (model: string, timeoutMs: number) => Promise<AttemptResult<T>>,
  overrides: { policy?: Partial<RetryPolicy>; clock?: ReturnType<typeof createClock> } = {}
) {
  const clock = overrides.clock ?? createClock();
  const waited: number[] = [];

  return {
    waited,
    clock,
    result: runModelChain<T>({
      task: "chat",
      order,
      policy: { ...POLICY, ...(overrides.policy ?? {}) },
      startedAt: clock.now(),
      now: clock.now,
      attempt,
      // Waiting is recorded, not performed — and the clock is advanced by the
      // same amount, so the budget arithmetic is exercised as if it were real.
      wait: async (ms) => {
        waited.push(ms);
        clock.advance(ms);
      },
    }),
  };
}

describe("runModelChain", () => {
  it("returns the first model's answer without touching the chain", async () => {
    const attempt = vi.fn(async () => success("hello"));

    const { result } = run(["primary", "backup"], attempt);
    const answer = await result;

    expect(answer.value).toBe("hello");
    expect(answer.model).toBe("primary");
    expect(answer.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    expect(answer.tried).toEqual(["primary"]);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("passes each attempt whatever is left of the budget, not the whole budget", async () => {
    const clock = createClock();
    const timeouts: number[] = [];

    const { result } = run(
      ["primary"],
      async (_model, timeoutMs) => {
        timeouts.push(timeoutMs);
        clock.advance(4_000);
        return { kind: "http", status: 503 };
      },
      { clock, policy: { maxAttemptsPerModel: 3, baseDelayMs: 0, assumedCallMs: 0 } }
    );

    await expect(result).rejects.toThrow();

    // 10s budget, 4s spent: the second attempt may only take 6s.
    expect(timeouts[0]).toBe(10_000);
    expect(timeouts[1]).toBe(6_000);
  });

  it("moves to the next model when the provider is out of credit", async () => {
    const attempt = vi.fn(async (model: string) =>
      model === "primary" ? ({ kind: "http", status: 402 } as AttemptResult<string>) : success("from backup")
    );

    const { result, waited } = run(["primary", "backup"], attempt);
    const answer = await result;

    expect(answer.model).toBe("backup");
    expect(answer.tried).toEqual(["primary", "backup"]);
    // 402 is a provider account problem: waiting changes nothing, so no sleep.
    expect(waited).toEqual([]);
  });

  it("waits out a rate limit on the same model before falling back", async () => {
    let calls = 0;
    const attempt = vi.fn(async () => {
      calls += 1;
      return calls === 1 ? ({ kind: "http", status: 429 } as AttemptResult<string>) : success("second time");
    });

    const { result, waited } = run(["primary", "backup"], attempt);
    const answer = await result;

    expect(answer.model).toBe("primary");
    expect(answer.tried).toEqual(["primary", "primary"]);
    expect(waited).toHaveLength(1);
  });

  it("fails immediately on a 401 without spending the fallback chain", async () => {
    const attempt = vi.fn(async () => ({ kind: "http", status: 401 }) as AttemptResult<string>);

    const { result, waited } = run(["primary", "backup", "third"], attempt);

    await expect(result).rejects.toMatchObject({ code: "not_configured" });
    // Every model would answer 401 identically — a bad platform key is not a
    // reason to make three calls and bill for none of them.
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(waited).toEqual([]);
  });

  it("treats an empty completion as a failure worth another model", async () => {
    const attempt = vi.fn(async (model: string) =>
      model === "primary" ? ({ kind: "empty" } as AttemptResult<string>) : success("real answer")
    );

    const { result } = run(["primary", "backup"], attempt);
    const answer = await result;

    expect(answer.model).toBe("backup");
    expect(answer.value).toBe("real answer");
  });

  it("reports the last model tried and every attempt when the chain is exhausted", async () => {
    const attempt = vi.fn(async () => ({ kind: "http", status: 503 }) as AttemptResult<string>);

    const { result } = run(["primary", "backup"], attempt, { policy: { baseDelayMs: 0, assumedCallMs: 0 } });

    await expect(result).rejects.toMatchObject({
      code: "all_models_failed",
      details: { tried: ["primary", "primary", "backup", "backup"], attempts: 4 },
    });
  });

  it("stops before a retry that would overrun the budget", async () => {
    const clock = createClock();
    const attempt = vi.fn(async () => {
      // The first call eats most of the budget.
      clock.advance(9_000);
      return { kind: "http", status: 503 } as AttemptResult<string>;
    });

    const { result } = run(["primary", "backup"], attempt, { clock });

    await expect(result).rejects.toMatchObject({ code: "all_models_failed" });
    // 1s left cannot cover a 500ms wait plus a 1.5s assumed call, and switching
    // models would not fit either — better to fail now than to be killed by the
    // platform timeout with the reason lost.
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("never tries the same model more than the hard cap, whatever the policy says", async () => {
    const attempt = vi.fn(async () => ({ kind: "network" }) as AttemptResult<string>);

    const { result } = run(["primary"], attempt, {
      policy: { maxAttemptsPerModel: 999, baseDelayMs: 0, assumedCallMs: 0, budgetMs: 10_000_000 },
    });

    await expect(result).rejects.toThrow();
    expect(attempt.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it("gives up rather than looping when handed an empty chain", async () => {
    const attempt = vi.fn(async () => success("never reached"));

    const { result } = run([], attempt);

    await expect(result).rejects.toMatchObject({ code: "all_models_failed" });
    expect(attempt).not.toHaveBeenCalled();
  });

  it("keeps the last failure's meaning when the chain runs out", async () => {
    // A 429 on the final model is a rate limit, not a generic model failure, and
    // the caller acts on the difference: a rate limit is retried by the caller
    // later, a model failure is not.
    const attempt = vi.fn(async () => ({ kind: "http", status: 429 }) as AttemptResult<string>);

    const { result } = run(["primary"], attempt, { policy: { baseDelayMs: 0, assumedCallMs: 0 } });

    await expect(result).rejects.toMatchObject({ code: "rate_limited" });
  });
});
