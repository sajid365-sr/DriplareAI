import { describe, expect, it } from "vitest";

import {
  CREDIT_CHANGE_REVIEW_RATIO,
  DEFAULT_EXPECTED_REPLY_TOKENS,
  DEFAULT_TARGET_BDT_PER_CREDIT,
  MIN_CREDITS_PER_REPLY,
  computeAllowanceEconomics,
  deriveCatalogueCredits,
  deriveModelCredits,
  estimateReplyCostUsd,
  planCreditUpdate,
  reviewCreditChange,
  sanitizeExpectedReplyTokens,
  sanitizeTargetBdtPerCredit,
} from "@/lib/ai/credit-derivation";
import { getIncludedCredits, getPlan } from "@/lib/domain/plan-config";

/**
 * These tests are written against the *live* configuration from
 * `/admin/ai-settings` on 2026-10-14, not against invented fixtures.
 *
 * The point of the module is that it reproduces a known-bad hand-typed table
 * correctly, so the fixtures have to be the bad table. A made-up price would
 * let the tests pass while the inversion they exist to catch went unnoticed.
 */

const RATE = 126; // the live USD → BDT rate from the same panel

/** Prices exactly as OpenRouter reports them in the admin panel ($ per 1M tokens). */
const PANEL_MODELS = [
  { modelId: "meta-llama/llama-3.3-70b-instruct", promptPrice: 0.1, completionPrice: 0.32 },
  { modelId: "openai/gpt-4o-mini", promptPrice: 0.15, completionPrice: 0.6 },
  { modelId: "deepseek/deepseek-chat", promptPrice: 0.26, completionPrice: 1.03 },
  { modelId: "google/gemini-2.5-flash", promptPrice: 0.3, completionPrice: 2.5 },
  { modelId: "openai/gpt-4o", promptPrice: 2.5, completionPrice: 10 },
  { modelId: "anthropic/claude-sonnet-4", promptPrice: 3, completionPrice: 15 },
] as const;

/** The credits someone had typed in by hand for those same models. */
const HAND_TYPED_CREDITS: Record<string, number> = {
  "meta-llama/llama-3.3-70b-instruct": 5,
  "openai/gpt-4o-mini": 3,
  "deepseek/deepseek-chat": 3,
  "google/gemini-2.5-flash": 5,
  "openai/gpt-4o": 3,
  "anthropic/claude-sonnet-4": 10,
};

function deriveAll(targetBdtPerCredit = DEFAULT_TARGET_BDT_PER_CREDIT) {
  return deriveCatalogueCredits(
    PANEL_MODELS.map((model) => ({ ...model, usdToBdtRate: RATE })),
    targetBdtPerCredit
  );
}

describe("deriveModelCredits — the inversion is gone", () => {
  it("charges more credits for a model that costs more, for every pair", () => {
    // This is the property the hand-typed table violated: gpt-4o cost 26× what
    // llama-3.3-70b cost and was charged 3 credits to its 5. Asserting it as a
    // *pairwise ordering* rather than a list of expected numbers means the test
    // keeps working when the target or the token estimate changes — which is
    // the whole design of this module.
    const derived = deriveAll().slice().sort((a, b) => a.costBdt - b.costBdt);

    for (let i = 1; i < derived.length; i++) {
      const cheaper = derived[i - 1];
      const dearer = derived[i];

      expect(dearer.costBdt).toBeGreaterThan(cheaper.costBdt);
      expect(dearer.credits).toBeGreaterThanOrEqual(cheaper.credits);
    }
  });

  it("reproduces the real panel models at the shipped target", () => {
    const credits = Object.fromEntries(deriveAll().map((model) => [model.modelId, model.credits]));

    // The cheap end barely moves — merchants on Fast/Smart see familiar numbers.
    expect(credits["meta-llama/llama-3.3-70b-instruct"]).toBe(4);
    expect(credits["openai/gpt-4o-mini"]).toBe(5);
    expect(credits["deepseek/deepseek-chat"]).toBe(9);
    expect(credits["google/gemini-2.5-flash"]).toBe(13);

    // The expensive end moves a long way, and that is the correction: these two
    // were the loss-makers, charged 3 and 10 for replies costing ৳1.638 and ৳2.079.
    expect(credits["openai/gpt-4o"]).toBe(82);
    expect(credits["anthropic/claude-sonnet-4"]).toBe(104);
  });

  it("would have caught the gpt-4o typo on its own", () => {
    // The specific defect, stated as an assertion: at ANY sane target the two
    // models cannot come out inverted, because the input is the price.
    const derived = deriveAll();
    const gpt4o = derived.find((model) => model.modelId === "openai/gpt-4o")!;
    const llama = derived.find((model) => model.modelId === "meta-llama/llama-3.3-70b-instruct")!;

    expect(gpt4o.costBdt / llama.costBdt).toBeGreaterThan(25);
    expect(gpt4o.credits).toBeGreaterThan(llama.credits);
    expect(HAND_TYPED_CREDITS["openai/gpt-4o"]).toBeLessThan(
      HAND_TYPED_CREDITS["meta-llama/llama-3.3-70b-instruct"]
    );
  });
});

describe("deriveModelCredits — rounding", () => {
  it("rounds up, so a credit never sells for less than it cost", () => {
    const model = deriveModelCredits({
      modelId: "test",
      promptPrice: 0.1,
      completionPrice: 0.32,
      usdToBdtRate: RATE,
      targetBdtPerCredit: DEFAULT_TARGET_BDT_PER_CREDIT,
    });

    // ৳0.062496 ÷ ৳0.02 = 3.1248 → 4, not 3.
    expect(model.costBdt).toBeCloseTo(0.062496, 9);
    expect(model.credits).toBe(4);
    expect(model.effectiveBdtPerCredit).toBeLessThan(DEFAULT_TARGET_BDT_PER_CREDIT);
  });

  it("does not round up an exact multiple on floating-point dust", () => {
    // 4,000 tokens at $0.25/1M is exactly $0.001; at ৳100/USD that is exactly
    // ৳0.1, which is exactly 5 credits at a ৳0.02 target. In IEEE-754 the
    // division lands on 5.000000000000001, and a bare Math.ceil would charge 6.
    const model = deriveModelCredits({
      modelId: "exact",
      promptPrice: 0.25,
      completionPrice: 0,
      usdToBdtRate: 100,
      targetBdtPerCredit: 0.02,
      tokens: { prompt: 4_000, completion: 300 },
    });

    expect(model.costBdt).toBeCloseTo(0.1, 12);
    expect(model.credits).toBe(5);
  });

  it("never charges less than one credit, however cheap the reply", () => {
    const model = deriveModelCredits({
      modelId: "nearly-free",
      promptPrice: 0.001,
      completionPrice: 0.001,
      usdToBdtRate: RATE,
      targetBdtPerCredit: DEFAULT_TARGET_BDT_PER_CREDIT,
    });

    expect(model.credits).toBe(MIN_CREDITS_PER_REPLY);
  });
});

describe("deriveModelCredits — an unusable price is reported, not guessed", () => {
  it.each([
    ["a missing price", Number.NaN, 10],
    ["a negative price", -1, 10],
    ["an infinite price", Number.POSITIVE_INFINITY, 10],
    ["an unusable completion price", 2.5, Number.NaN],
  ])("flags %s", (_label, promptPrice, completionPrice) => {
    const model = deriveModelCredits({
      modelId: "broken",
      promptPrice,
      completionPrice,
      usdToBdtRate: RATE,
      targetBdtPerCredit: DEFAULT_TARGET_BDT_PER_CREDIT,
    });

    expect(model.priceUnknown).toBe(true);
    expect(model.credits).toBe(MIN_CREDITS_PER_REPLY);
    // null, not the target — claiming a cost we could not compute is the habit
    // that produced the wrong table in the first place.
    expect(model.effectiveBdtPerCredit).toBeNull();
  });

  it("flags an unusable exchange rate too", () => {
    const model = deriveModelCredits({
      modelId: "no-rate",
      promptPrice: 2.5,
      completionPrice: 10,
      usdToBdtRate: 0,
      targetBdtPerCredit: DEFAULT_TARGET_BDT_PER_CREDIT,
    });

    expect(model.priceUnknown).toBe(true);
  });

  it("uses the documented default token estimate when none is given", () => {
    const withDefault = deriveModelCredits({
      modelId: "tokens",
      promptPrice: 2.5,
      completionPrice: 10,
      usdToBdtRate: RATE,
      targetBdtPerCredit: DEFAULT_TARGET_BDT_PER_CREDIT,
    });
    const withExplicit = deriveModelCredits({
      modelId: "tokens",
      promptPrice: 2.5,
      completionPrice: 10,
      usdToBdtRate: RATE,
      targetBdtPerCredit: DEFAULT_TARGET_BDT_PER_CREDIT,
      tokens: DEFAULT_EXPECTED_REPLY_TOKENS,
    });

    expect(withDefault).toEqual(withExplicit);
  });
});

describe("deriveModelCredits — an unquoted price is not a price", () => {
  // Found by running the research script (TASK-15.1) against the live
  // configuration: six of the thirty-four models on 2026-10-14 were absent from
  // OpenRouter's 455-model snapshot, so `resolveModelPrice()` returned its
  // placeholder ($0.15 / $0.60) with `source: "fallback"`.
  const FALLBACK = { promptPrice: 0.15, completionPrice: 0.6 };

  it("flags a fallback price even though it is a perfectly usable number", () => {
    const model = deriveModelCredits({
      modelId: "anthropic/claude-opus-4.7-fast",
      ...FALLBACK,
      usdToBdtRate: RATE,
      targetBdtPerCredit: DEFAULT_TARGET_BDT_PER_CREDIT,
      priceSource: "fallback",
    });

    expect(model.priceUnknown).toBe(true);
    // The arithmetic still runs — a panel showing "≈৳0.079 at the placeholder
    // price" is more useful than a blank. It just must not be called a derivation.
    expect(model.costBdt).toBeGreaterThan(0);
    expect(model.credits).toBeGreaterThan(0);
  });

  it("does not flag a real OpenRouter quote", () => {
    const model = deriveModelCredits({
      modelId: "anthropic/claude-opus-4.7-fast",
      ...FALLBACK,
      usdToBdtRate: RATE,
      targetBdtPerCredit: DEFAULT_TARGET_BDT_PER_CREDIT,
      priceSource: "openrouter",
    });

    expect(model.priceUnknown).toBe(false);
  });

  it("leaves the admin's number alone rather than cutting it by 92%", () => {
    // The actual near-miss, at the token counts the research run measured, so
    // this reproduces the live figure rather than a nearby one. Configured at 50
    // credits, the placeholder derives to 4 — and an Apply button would have
    // taken that as approval.
    const derived = deriveModelCredits({
      modelId: "anthropic/claude-opus-4.7-fast",
      ...FALLBACK,
      usdToBdtRate: RATE,
      targetBdtPerCredit: DEFAULT_TARGET_BDT_PER_CREDIT,
      priceSource: "fallback",
      tokens: { prompt: 2_014, completion: 548 },
    });
    const plan = planCreditUpdate({ "anthropic/claude-opus-4.7-fast": 50 }, [derived]);

    expect(derived.credits).toBe(4);
    expect(plan.rows[0].currentCredits).toBe(50);
    expect(plan.rows[0].proposedCredits).toBe(50); // not 4
    expect(plan.rows[0].verdict).toBe("needs_review");
  });

  it("does not invent a number for an unquoted model the admin never priced", () => {
    const derived = deriveModelCredits({
      modelId: "mystery/model",
      ...FALLBACK,
      usdToBdtRate: RATE,
      targetBdtPerCredit: DEFAULT_TARGET_BDT_PER_CREDIT,
      priceSource: "fallback",
    });
    const plan = planCreditUpdate({}, [derived]);

    expect(plan.rows[0].currentCredits).toBeNull();
    // Not 4 — the floor, and flagged. An unconfigured model needs a person.
    expect(plan.rows[0].proposedCredits).toBe(MIN_CREDITS_PER_REPLY);
    expect(plan.rows[0].verdict).toBe("needs_review");
  });
});

describe("estimateReplyCostUsd", () => {
  it("prices prompt and completion tokens differently", () => {
    // The whole reason a per-reply counter cannot track a per-token cost: the
    // two halves of a reply are billed at different rates.
    const cheap = estimateReplyCostUsd(0.1, 0.1, { prompt: 4_000, completion: 300 });
    const dear = estimateReplyCostUsd(0.1, 10, { prompt: 4_000, completion: 300 });

    expect(dear!).toBeGreaterThan(cheap!);
  });

  it("returns null rather than zero for an unusable price", () => {
    // Zero would read as "free", which is a claim. Unknown is the truth.
    expect(estimateReplyCostUsd(Number.NaN, 10)).toBeNull();
    expect(estimateReplyCostUsd(0, 0)).toBe(0);
  });
});

describe("sanitizeTargetBdtPerCredit", () => {
  it.each([
    ["a string", "0.02"],
    ["null", null],
    ["undefined", undefined],
    ["NaN", Number.NaN],
    ["zero", 0],
    ["a negative", -5],
  ])("falls back to the default for %s", (_label, value) => {
    expect(sanitizeTargetBdtPerCredit(value)).toBe(DEFAULT_TARGET_BDT_PER_CREDIT);
  });

  it("pulls an out-of-range value back inside the bounds", () => {
    expect(sanitizeTargetBdtPerCredit(0.0000001)).toBe(0.001);
    expect(sanitizeTargetBdtPerCredit(1_000)).toBe(10);
  });

  it("leaves a sane value alone", () => {
    expect(sanitizeTargetBdtPerCredit(0.035)).toBe(0.035);
  });
});

describe("sanitizeExpectedReplyTokens", () => {
  it("falls back to the placeholder for anything that is not a token pair", () => {
    for (const value of [null, undefined, 4_000, "4000", Number.NaN, {}]) {
      expect(sanitizeExpectedReplyTokens(value), String(value)).toEqual(
        DEFAULT_EXPECTED_REPLY_TOKENS
      );
    }
  });

  it("keeps a usable pair exactly as given", () => {
    // The research run measured this pair (docs/pricing §১৯.২). It is not the
    // default, and it must survive a round trip through the settings row.
    expect(sanitizeExpectedReplyTokens({ prompt: 2_014, completion: 548 })).toEqual({
      prompt: 2_014,
      completion: 548,
    });
  });

  it("rejects an all-zero estimate rather than deriving everything at one credit", () => {
    // Zero is legal on either half — a completion-only estimate is a real choice
    // — but both halves at zero would price every model at MIN_CREDITS_PER_REPLY
    // and call it a derivation.
    expect(sanitizeExpectedReplyTokens({ prompt: 0, completion: 500 })).toEqual({
      prompt: 0,
      completion: 500,
    });
    expect(sanitizeExpectedReplyTokens({ prompt: 0, completion: 0 })).toEqual(
      DEFAULT_EXPECTED_REPLY_TOKENS
    );
  });

  it("replaces only the unusable half", () => {
    expect(sanitizeExpectedReplyTokens({ prompt: -5, completion: 800 })).toEqual({
      prompt: DEFAULT_EXPECTED_REPLY_TOKENS.prompt,
      completion: 800,
    });

    // A missing half is filled from the placeholder rather than discarding the
    // half that was supplied — the same rule, applied to `undefined`.
    expect(sanitizeExpectedReplyTokens({ prompt: 1_200 })).toEqual({
      prompt: 1_200,
      completion: DEFAULT_EXPECTED_REPLY_TOKENS.completion,
    });
  });
});

describe("reviewCreditChange — the guard against silent repricing", () => {  it("reports no change when the number is the same", () => {
    expect(reviewCreditChange(10, 10)).toBe("unchanged");
  });

  it("accepts a move inside the threshold", () => {
    // 10 → 11 is 10%, under the 20% line.
    expect(reviewCreditChange(10, 11)).toBe("within_threshold");
    expect(reviewCreditChange(10, 9)).toBe("within_threshold");
  });

  it("demands a human when a merchant-visible number would jump", () => {
    // 10 → 104 is the real Genius case. It must never apply itself overnight.
    expect(reviewCreditChange(10, 104)).toBe("needs_review");
    expect(reviewCreditChange(10, 13)).toBe("needs_review"); // exactly 30%
  });

  it("treats a 20% move as inside and a shade over as outside", () => {
    expect(reviewCreditChange(100, 120, CREDIT_CHANGE_REVIEW_RATIO)).toBe("within_threshold");
    expect(reviewCreditChange(100, 120.5, CREDIT_CHANGE_REVIEW_RATIO)).toBe("needs_review");
  });

  it("refuses to compute a ratio against nothing", () => {
    // A model that had no cost has no baseline. Reading that as "0% change"
    // would be a division by zero wearing an approval.
    expect(reviewCreditChange(0, 5)).toBe("needs_review");
    expect(reviewCreditChange(-1, 5)).toBe("needs_review");
    expect(reviewCreditChange(Number.NaN, 5)).toBe("needs_review");
  });
});

describe("planCreditUpdate — the diff an admin approves", () => {
  it("counts every row that crosses the threshold", () => {
    const plan = planCreditUpdate(HAND_TYPED_CREDITS, deriveAll());

    // gpt-4o (3 → 82), claude-sonnet-4 (10 → 104), deepseek-chat (3 → 9) and
    // gemini-2.5-flash (5 → 13) all move far more than 20%. llama (5 → 4) is
    // exactly at the line and gpt-4o-mini (3 → 5) is over it.
    expect(plan.needsReview).toBeGreaterThan(0);
    expect(plan.rows).toHaveLength(PANEL_MODELS.length);
    expect(plan.rows.map((row) => row.modelId)).toEqual(PANEL_MODELS.map((model) => model.modelId));
  });

  it("marks an unconfigured model as needing review, not as unchanged", () => {
    const plan = planCreditUpdate({}, deriveAll().slice(0, 1));

    expect(plan.rows[0].currentCredits).toBeNull();
    expect(plan.rows[0].verdict).toBe("needs_review");
    expect(plan.needsReview).toBe(1);
  });

  it("carries the cost through so the panel can explain the number", () => {
    const row = planCreditUpdate(HAND_TYPED_CREDITS, deriveAll()).rows.find(
      (entry) => entry.modelId === "openai/gpt-4o"
    )!;

    expect(row.currentCredits).toBe(3);
    expect(row.proposedCredits).toBe(82);
    expect(row.costBdt).toBeCloseTo(1.638, 6);
    expect(row.priceUnknown).toBe(false);
  });
});

describe("computeAllowanceEconomics — validating the target against the real plans", () => {
  it("makes the shipped target produce a declining margin ladder", () => {
    // This is the argument for ৳0.020, as a test. The plan prices and the credit
    // allowances are read from `plan-config.ts`, so if either moves this fails —
    // which is correct: the target and the allowances are one decision, and the
    // module's header says so.
    const expectations = [
      { plan: "starter", margin: 70, cost: 300 },
      { plan: "business", margin: 60, cost: 1_000 },
      { plan: "enterprise", margin: 40, cost: 3_000 },
    ] as const;

    for (const { plan, margin, cost } of expectations) {
      const config = getPlan("bd", plan);
      const economics = computeAllowanceEconomics({
        includedCredits: getIncludedCredits("bd", plan),
        priceBdt: config.price,
        targetBdtPerCredit: DEFAULT_TARGET_BDT_PER_CREDIT,
      });

      expect(economics.costBdt, plan).toBe(cost);
      expect(economics.netMarginPercent, plan).toBe(margin);
      expect(economics.netProfitBdt, plan).toBe(config.price - cost);
    }
  });

  it("loses money on the full allowance when the target is set too high", () => {
    // ৳0.06 is the top-up rate — the number that looks harmless and is not.
    const economics = computeAllowanceEconomics({
      includedCredits: getIncludedCredits("bd", "business"),
      priceBdt: getPlan("bd", "business").price,
      targetBdtPerCredit: 0.06,
    });

    expect(economics.costBdt).toBe(3_000);
    expect(economics.netProfitBdt).toBeLessThan(0);
    expect(economics.netMarginPercent).toBeLessThan(0);
  });

  it("reports null rather than 0% for a plan priced by negotiation", () => {
    const economics = computeAllowanceEconomics({
      includedCredits: 150_000,
      priceBdt: null,
      targetBdtPerCredit: DEFAULT_TARGET_BDT_PER_CREDIT,
    });

    expect(economics.costBdt).toBe(3_000);
    // 0% would claim the plan charges nothing. It does not; it negotiates.
    expect(economics.netProfitBdt).toBeNull();
    expect(economics.netMarginPercent).toBeNull();
  });

  it("treats a free plan as a real, measurable cost", () => {
    // Global Starter is $0 with 500 credits. The free tier is not "no cost" —
    // it is ৳10 against ৳0 of revenue, which is why it needs watching.
    const economics = computeAllowanceEconomics({
      includedCredits: 500,
      priceBdt: 0,
      targetBdtPerCredit: DEFAULT_TARGET_BDT_PER_CREDIT,
    });

    expect(economics.costBdt).toBe(10);
    expect(economics.netMarginPercent).toBeNull();
  });
});
