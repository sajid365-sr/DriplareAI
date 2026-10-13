import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Test doubles ──────────────────────────────────────────────────────────────
//
// Two imports are replaced here, and neither substitution weakens the test:
//
//   - `server-only` throws on import outside a Server Component by design, and
//     nothing in this file renders. Stubbed, as Vitest's own docs suggest.
//   - `@/lib/ai/quota-guard` reads Postgres through React's `cache`. What
//     `quota-answer` promises is a *mapping* — a decision, or a refusal — not
//     the queries behind it, so the guard is replaced by a function whose
//     outcome each test states outright. The rules the real guard applies are
//     covered by `lib/domain/ai-quota.test.ts`.
//
// Stubbing the guard rather than the database is what makes the interesting
// cases reachable at all: `workspace_suspended` is otherwise only reproducible
// by arranging a whole workspace row.

vi.mock("server-only", () => ({}));

const { assertAIQuota } = vi.hoisted(() => ({ assertAIQuota: vi.fn() }));

vi.mock("@/lib/ai/quota-guard", () => ({ assertAIQuota }));

import { AIError } from "@/lib/ai/ai-error";
import type { QuotaTarget } from "@/lib/ai/quota-guard";
import { QUOTA_REPLY_TEXT, failOpenAnswer, resolveQuotaAnswer } from "./quota-answer";

/**
 * Words a *customer* must never read.
 *
 * The shopper who receives this sentence has no relationship with the merchant's
 * account, so learning that the business ran out of money is the merchant's
 * loss. The dashboard copy in the same locale file says the opposite thing on
 * purpose ("Top up to keep your AI agents replying"); this one must not drift
 * into it during a future translation pass.
 */
const BILLING_VOCABULARY =
  /credit|balance|billing|invoice|subscribe|subscription|plan|top ?up|recharge|pay|ক্রেডিট|ব্যালেন্স|রিচার্জ|বিল|সাবস্ক্রিপশন|টাকা/i;

function makeTarget(): QuotaTarget {
  return {
    task: "chat",
    userId: "user_1",
    chatbotId: "bot_1",
    workspaceId: "ws_1",
    modelId: "anthropic/claude-sonnet-4",
  };
}

beforeEach(() => {
  // Implementations are set per test, so only the recorded calls need clearing.
  vi.clearAllMocks();
});

describe("resolveQuotaAnswer — allowed", () => {
  it("reports the decision's numbers and occupies no reason", async () => {
    assertAIQuota.mockResolvedValue({ allowed: true, requiredCredits: 12, balance: 480 });

    await expect(resolveQuotaAnswer(makeTarget())).resolves.toEqual({
      allowed: true,
      reason: null,
      balance: 480,
      requiredCredits: 12,
      replyText: QUOTA_REPLY_TEXT,
    });
  });

  it("asks the guard once, with the target unchanged", async () => {
    assertAIQuota.mockResolvedValue({ allowed: true, requiredCredits: 0, balance: null });
    const target = makeTarget();

    await resolveQuotaAnswer(target);

    // A renamed or dropped field here would silently change whose balance is
    // checked, because the guard falls back to looking the owner up itself.
    expect(assertAIQuota).toHaveBeenCalledTimes(1);
    expect(assertAIQuota).toHaveBeenCalledWith(target);
  });
});

describe("resolveQuotaAnswer — refusal", () => {
  it.each(["quota_exceeded", "workspace_suspended"] as const)(
    "turns a %s refusal into a decision rather than an exception",
    async (code) => {
      assertAIQuota.mockRejectedValue(new AIError(code, "refused"));

      // Both callers are route handlers whose outer `catch` fails **open** — it
      // returns "carry on" so a transient database error cannot mute a live
      // conversation. A refusal left as a thrown error would be swallowed by
      // that same rule, and a merchant with an empty balance would go on
      // spending the platform's OpenRouter key in complete silence. So the
      // throw is what these tests are really about.
      const answer = await resolveQuotaAnswer(makeTarget());

      expect(answer.allowed).toBe(false);
      expect(answer.reason).toBe(code);
      expect(answer.replyText).toBe(QUOTA_REPLY_TEXT);
    }
  );

  it("does not let the refusal escape as a rejected promise", async () => {
    assertAIQuota.mockRejectedValue(new AIError("quota_exceeded", "empty balance"));

    await expect(resolveQuotaAnswer(makeTarget())).resolves.toMatchObject({ allowed: false });
  });

  it("refuses without inventing a balance it never read", async () => {
    assertAIQuota.mockRejectedValue(new AIError("quota_exceeded", "empty balance"));

    const answer = await resolveQuotaAnswer(makeTarget());

    // `AIError.details` carries the numbers, but they are for the merchant's
    // logs. Mirroring them into the customer-facing answer would put a
    // balance in the payload n8n hands to the bot.
    expect(answer.balance).toBeUndefined();
    expect(answer.requiredCredits).toBeUndefined();
  });
});

describe("resolveQuotaAnswer — fail-open", () => {
  it.each([
    [new AIError("all_models_failed", "no model answered")],
    [new AIError("rate_limited", "slow down")],
    [new AIError("not_configured", "no key")],
    [new Error("socket hang up")],
    ["not even an error"],
    [undefined],
  ] satisfies Array<[unknown]>)("allows the call when the guard throws %p", async (thrown) => {
    assertAIQuota.mockRejectedValue(thrown);

    // Only the two block codes may refuse. An `AIError` is not automatically a
    // refusal — if this ever widens to "any AIError", an outage at the provider
    // or a missing key would silence every customer of every merchant.
    const answer = await resolveQuotaAnswer(makeTarget());

    expect(answer.allowed).toBe(true);
    expect(answer.reason).toBe("error");
    expect(answer.replyText).toBe(QUOTA_REPLY_TEXT);
  });

  it("marks the allow as degraded so the caller can tell it apart", async () => {
    assertAIQuota.mockRejectedValue(new Error("socket hang up"));

    const answer = await resolveQuotaAnswer(makeTarget());

    // `reason: "error"` on an allowed answer is the only signal that this was
    // not a real check. A plain `allowed: true` with `reason: null` would be
    // indistinguishable from a verified, funded balance.
    expect(answer.reason).not.toBeNull();
    expect(answer.balance).toBeUndefined();
  });
});

describe("failOpenAnswer", () => {
  it.each(["no_target", "error"] as const)("allows with reason %s", (reason) => {
    expect(failOpenAnswer(reason)).toEqual({
      allowed: true,
      reason,
      replyText: QUOTA_REPLY_TEXT,
    });
  });

  it("makes the reason mandatory", () => {
    // No zero-argument form exists on purpose: an allow that cannot name why it
    // allowed is the shape that hides a broken quota check.
    expect(failOpenAnswer.length).toBe(1);
  });
});

describe("QUOTA_REPLY_TEXT", () => {
  it("carries a refusal in both languages", () => {
    // n8n picks the language by looking for Bengali script in the customer's
    // message, so a missing translation becomes an empty reply, not a fallback.
    expect(QUOTA_REPLY_TEXT.en.trim().length).toBeGreaterThan(0);
    expect(QUOTA_REPLY_TEXT.bn.trim().length).toBeGreaterThan(0);
  });

  it.each(Object.entries(QUOTA_REPLY_TEXT))(
    "tells the %s reader nothing about the merchant's billing",
    (_language, text) => {
      expect(text).not.toMatch(BILLING_VOCABULARY);
    }
  );
});
