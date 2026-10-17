import { describe, expect, it } from "vitest";

import { HIGH_COST_ALERT_BDT, computeUnitEconomics } from "@/lib/domain/unit-economics";

/** A rate that makes the arithmetic readable in assertions. */
const RATE = 120;

/** A comfortable Business workspace: ৳2,499 in, $2 (৳240) out. */
const profitable = {
  plan: "business",
  region: "bd",
  usdToBdtRate: RATE,
  costUsd: 2,
};

describe("computeUnitEconomics — known plan revenue", () => {
  it("subtracts API cost from the plan price to get profit and margin", () => {
    const result = computeUnitEconomics(profitable);

    expect(result.revenueBdt).toBe(2499);
    expect(result.revenueBasis).toBe("plan");
    expect(result.costBdt).toBe(240);
    expect(result.netProfitBdt).toBe(2259);
    expect(result.netMarginPercent).toBe(90);
    expect(result.isHighCostAlert).toBe(false);
  });

  it("converts the cost with the live rate, not a stored one", () => {
    // The whole point of keeping `costBdt` out of the maths: the same USD spend
    // must produce a different BDT figure when the admin's rate changes.
    const at120 = computeUnitEconomics({ ...profitable, usdToBdtRate: 120 });
    const at140 = computeUnitEconomics({ ...profitable, usdToBdtRate: 140 });

    expect(at120.costBdt).toBe(240);
    expect(at140.costBdt).toBe(280);
    expect(at140.netProfitBdt).toBe(2499 - 280);
  });

  it("reports a genuine loss as a negative profit and margin", () => {
    // $25 at ৳120 is ৳3,000 of API spend against a ৳999 Starter plan.
    const result = computeUnitEconomics({ ...profitable, plan: "starter", costUsd: 25 });

    expect(result.netProfitBdt).toBe(999 - 3000);
    expect(result.netMarginPercent).toBe(Math.round(((999 - 3000) / 999) * 100));
    expect(result.netMarginPercent).toBeLessThan(0);
  });

  it("flags a workspace spending more than 80% of what it pays", () => {
    // ৳2,100 on a ৳2,499 plan is 84% — under the price, over the threshold.
    const result = computeUnitEconomics({ ...profitable, costUsd: 2100 / RATE });

    expect(result.netProfitBdt).toBeGreaterThan(0);
    expect(result.isHighCostAlert).toBe(true);
  });

  it("does not flag a workspace spending comfortably under that share", () => {
    // ৳1,992 against ৳2,499 — close to, but on the safe side of, the threshold.
    const result = computeUnitEconomics({ ...profitable, costUsd: 1992 / RATE });

    expect(result.costBdt).toBe(1992);
    expect(result.isHighCostAlert).toBe(false);
  });
});

describe("computeUnitEconomics — revenue we cannot know", () => {
  it.each([
    ["custom-priced Enterprise", "enterprise", "global"],
    ["a plan key that is not in the catalogue", "pro", "bd"],
    ["a plan from the other region", "growth", "bd"],
  ])("leaves profit and margin unanswered for %s", (_label, plan, region) => {
    // ⚠️ The tripwire for the bug this module removed: reading these as revenue
    //    0 with a −100% margin is what made a healthy Enterprise account look
    //    like a bleeding one. "Unknown" must stay unknown.
    const result = computeUnitEconomics({ plan, region, usdToBdtRate: RATE, costUsd: 5 });

    expect(result.netProfitBdt).toBeNull();
    expect(result.netMarginPercent).toBeNull();
    expect(result.revenueBasis).not.toBe("plan");
  });

  it("still reports the cost, which is always measurable", () => {
    // Withholding what we know because of what we don't would be the opposite
    // failure: the admin can still see this workspace burns ৳600 a month.
    const result = computeUnitEconomics({
      plan: "enterprise",
      region: "global",
      usdToBdtRate: RATE,
      costUsd: 5,
    });

    expect(result.costUsd).toBe(5);
    expect(result.costBdt).toBe(600);
  });

  it("falls back to the flat cost threshold when revenue is unknown", () => {
    const cheap = computeUnitEconomics({ plan: "pro", region: "bd", usdToBdtRate: RATE, costUsd: 0.1 });
    const pricey = computeUnitEconomics({ plan: "pro", region: "bd", usdToBdtRate: RATE, costUsd: 1 });

    expect(cheap.costBdt).toBeLessThan(HIGH_COST_ALERT_BDT);
    expect(cheap.isHighCostAlert).toBe(false);
    expect(pricey.costBdt).toBeGreaterThan(HIGH_COST_ALERT_BDT);
    expect(pricey.isHighCostAlert).toBe(true);
  });
});

describe("computeUnitEconomics — a real plan that earns nothing", () => {
  it("shows the loss but declines to invent a margin", () => {
    // Global Starter is a free 14-day trial. Its revenue is a known ৳0, so the
    // loss is real and the margin is a division by zero — not −100%.
    const result = computeUnitEconomics({
      plan: "starter",
      region: "global",
      usdToBdtRate: RATE,
      costUsd: 1,
    });

    expect(result.revenueBasis).toBe("plan");
    expect(result.revenueBdt).toBe(0);
    expect(result.netProfitBdt).toBe(-120);
    expect(result.netMarginPercent).toBeNull();
  });

  it("marks a free plan as costing nothing as flat-zero, not as a loss", () => {
    const result = computeUnitEconomics({
      plan: "starter",
      region: "global",
      usdToBdtRate: RATE,
      costUsd: 0,
    });

    expect(result.netProfitBdt).toBe(0);
    expect(result.netMarginPercent).toBeNull();
    expect(result.isHighCostAlert).toBe(false);
  });
});

describe("computeUnitEconomics — region handling", () => {
  it("prices a Global plan in USD converted to BDT", () => {
    const result = computeUnitEconomics({
      plan: "growth",
      region: "global",
      usdToBdtRate: RATE,
      costUsd: 0,
    });

    expect(result.revenueBdt).toBe(29 * RATE);
  });

  it.each([["bd"], [null], [undefined], [""], ["GLOBAL"], ["Global"], ["bangladesh"], [42]])(
    "treats %s as Bangladesh rather than moving the merchant to USD pricing",
    (region) => {
      const result = computeUnitEconomics({ plan: "business", region, usdToBdtRate: RATE, costUsd: 0 });

      expect(result.revenueBdt).toBe(2499);
    },
  );
});

describe("computeUnitEconomics — rounding", () => {
  it("keeps cents, not float noise", () => {
    const result = computeUnitEconomics({ ...profitable, costUsd: 0.1 + 0.2 });

    expect(result.costBdt).toBe(36);
    expect(result.netProfitBdt).toBe(2463);
  });

  it("rounds the USD cost to four places, matching the admin API contract", () => {
    const result = computeUnitEconomics({ ...profitable, costUsd: 1.23456789 });

    expect(result.costUsd).toBe(1.2346);
  });
});
