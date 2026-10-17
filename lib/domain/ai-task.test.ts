import { describe, expect, it } from "vitest";

import { AI_TASK_POLICY, AI_TASKS, getTaskPolicy, isAITask } from "./ai-task";

describe("AI_TASK_POLICY", () => {
  it("describes every task in the vocabulary", () => {
    for (const task of AI_TASKS) {
      const policy = AI_TASK_POLICY[task];

      expect(policy, `${task} has no policy`).toBeDefined();
      expect(policy.legacyChannel.length).toBeGreaterThan(0);
    }
  });

  /**
   * `embedding` and `auto_train` share the legacy channel `"auto_train"`, and
   * that is not a typo to be tidied away — it is the actual state of the data.
   * `lib/ai/embeddings.ts` has always logged every embedding call as
   * `"auto_train"`, whether it was auto-training, RAG retrieval or source
   * ingestion. So in every row written before the `task` column existed, the
   * cost of embedding is indistinguishable from the cost of auto-training.
   *
   * Asserting the collision instead of hiding it keeps the reason for this
   * whole column honest, and will fail loudly if a third task is ever given a
   * channel that is already taken.
   */
  it("collides on legacy channels only where the old data genuinely collided", () => {
    const byChannel = new Map<string, string[]>();
    for (const task of AI_TASKS) {
      const channel = AI_TASK_POLICY[task].legacyChannel;
      byChannel.set(channel, [...(byChannel.get(channel) ?? []), task]);
    }

    const collisions = [...byChannel.entries()].filter(([, tasks]) => tasks.length > 1);

    expect(collisions).toEqual([["auto_train", ["embedding", "auto_train"]]]);
  });

  /**
   * The single most important rule in this file. Chunks are stored as vectors
   * from one specific embedding model; a vector from any other model is not
   * comparable to them, so a "helpful" fallback would silently fill retrieval
   * with irrelevant context instead of reporting a failure.
   */
  it("forbids model fallback for embeddings and nothing else", () => {
    const forbidden = AI_TASKS.filter((task) => !AI_TASK_POLICY[task].allowsModelFallback);

    expect(forbidden).toEqual(["embedding", "compare"]);
  });

  /**
   * The reasoning differs from embeddings but the answer is the same. A
   * comparison exists to show which model says what; if a failed model were
   * answered by a fallback, the column labelled "GPT-4o" would hold text GPT-4o
   * never wrote, and the merchant would pick their model on a false reading.
   * Silence about a model is recoverable; a mislabelled answer is not.
   */
  it("keeps a failed comparison model failed rather than answering it from another", () => {
    expect(AI_TASK_POLICY.compare.allowsModelFallback).toBe(false);
    // Retrying the *same* model is still allowed — `allowsModelFallback` only
    // shortens the chain to one entry.
    expect(AI_TASK_POLICY.chat.allowsModelFallback).toBe(true);
  });

  /**
   * A tripwire, not a rule. Every app-side task below runs on the platform's
   * own OpenRouter key and is never billed to the merchant, so the quota floor
   * in `ai-quota.ts` is the only thing protecting that key. If someone starts
   * charging for one of these tasks, this test should fail so the change is
   * deliberate and the revenue-leak note in task.md gets revisited.
   */
  it("charges merchants only for chat today — every other task is a known revenue leak", () => {
    const charged = AI_TASKS.filter((task) => AI_TASK_POLICY[task].isCharged);

    expect(charged).toEqual(["chat"]);
  });
});

describe("getTaskPolicy", () => {
  it("returns the policy for the task it was asked about", () => {
    expect(getTaskPolicy("embedding").legacyChannel).toBe("auto_train");
    expect(getTaskPolicy("chat").isCharged).toBe(true);
  });
});

describe("isAITask", () => {
  it.each(AI_TASKS)("accepts %s", (task) => {
    expect(isAITask(task)).toBe(true);
  });

  it.each([["chat "], ["CHAT"], [""], ["unknown_task"]])("rejects the near-miss %p", (value) => {
    expect(isAITask(value)).toBe(false);
  });

  it.each([[null], [undefined], [42], [{}], [["chat"]]])(
    "rejects the non-string value %p without throwing",
    (value) => {
      expect(isAITask(value)).toBe(false);
    }
  );
});
