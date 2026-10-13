import { describe, expect, it } from "vitest";

import { decideQuota } from "./ai-quota";

describe("decideQuota", () => {
  it("allows a charged call the balance can cover", () => {
    const decision = decideQuota({ task: "chat", balance: 10, requiredCredits: 3 });

    expect(decision.allowed).toBe(true);
  });

  it("allows a charged call that costs exactly the whole balance", () => {
    // Spending the balance down to zero is legitimate — the next call is the
    // one that must be refused.
    expect(decideQuota({ task: "chat", balance: 3, requiredCredits: 3 }).allowed).toBe(true);
  });

  it("blocks a charged call the balance cannot cover", () => {
    const decision = decideQuota({ task: "chat", balance: 2, requiredCredits: 3 });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe("quota_exceeded");
      expect(decision.requiredCredits).toBe(3);
      expect(decision.balance).toBe(2);
    }
  });

  it("blocks every task once the balance is empty, even the unbilled ones", () => {
    // The floor. Prompt enhancement, translation and auto-training are never
    // billed to the merchant, so without this they would spend the platform's
    // OpenRouter key for free, forever.
    for (const task of ["chat", "enhance_prompt", "translate", "compare", "text_ingest", "embedding"] as const) {
      const decision = decideQuota({ task, balance: 0 });

      expect(decision.allowed, `${task} was allowed on an empty balance`).toBe(false);
    }
  });

  it("ignores a required cost passed for a task that is never charged", () => {
    // Computing the requirement from the policy in one place is what stops a
    // caller from accidentally gating an unbilled task on a credit price.
    const decision = decideQuota({ task: "enhance_prompt", balance: 1, requiredCredits: 99 });

    expect(decision.allowed).toBe(true);
    expect(decision.requiredCredits).toBe(0);
  });

  it("exempts a free message from the credit floor", () => {
    expect(decideQuota({ task: "chat", balance: 0, isFreeMessage: true }).allowed).toBe(true);
  });

  it("blocks a suspended workspace even for a free message", () => {
    // Suspension is an admin cutting a workspace off, not a billing state — it
    // must not be bypassed by the free-message exemption.
    const decision = decideQuota({
      task: "chat",
      balance: 5000,
      workspaceStatus: "suspended",
      isFreeMessage: true,
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe("workspace_suspended");
  });

  it.each([["active"], ["warning"], [null], [undefined]])(
    "does not block on the %p workspace status",
    (workspaceStatus) => {
      expect(decideQuota({ task: "chat", balance: 100, requiredCredits: 3, workspaceStatus }).allowed).toBe(true);
    }
  );

  it("fails open when the balance could not be read", () => {
    // A transient database error must not mute a live customer conversation.
    // `chargeUsage()` still refuses to overdraw afterwards, so the exposure is
    // bounded to whatever the cycle's last calls cost.
    const decision = decideQuota({ task: "chat", balance: null, requiredCredits: 3 });

    expect(decision.allowed).toBe(true);
    expect(decision.balance).toBeNull();
  });

  it("blocks a negative balance, which a manual admin adjustment can create", () => {
    expect(decideQuota({ task: "chat", balance: -5 }).allowed).toBe(false);
  });

  it("reports the requirement it used, so the caller can show it", () => {
    expect(decideQuota({ task: "chat", balance: 100, requiredCredits: 3 }).requiredCredits).toBe(3);
  });
});
