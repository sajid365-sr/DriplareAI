import { describe, expect, it } from "vitest";

import { BD_PLANS, GLOBAL_PLANS } from "@/lib/domain/plan-config";
import { isUsableRevenue, resolvePlanMonthlyRevenue } from "@/lib/domain/plan-revenue";

/** The rate the rest of these tests multiply against, when a Global plan is used. */
const RATE = 120;

describe("resolvePlanMonthlyRevenue — Bangladesh plans", () => {
  it.each([
    ["starter", 999],
    ["business", 2499],
    ["enterprise", 4999],
  ])("prices %s at its catalogue price in BDT", (plan, expectedBdt) => {
    const revenue = resolvePlanMonthlyRevenue(plan, "bd", RATE);

    expect(revenue.revenueBdt).toBe(expectedBdt);
    expect(revenue.basis).toBe("plan");
    expect(revenue.plan?.key).toBe(plan);
  });

  it("ignores the USD rate entirely, because BD plans are already priced in BDT", () => {
    // If the implementation ever started converting BDT prices, a wildly
    // different rate would move the number. It must not.
    expect(resolvePlanMonthlyRevenue("business", "bd", 1).revenueBdt).toBe(
      resolvePlanMonthlyRevenue("business", "bd", 999).revenueBdt,
    );
  });

  it("reports a plan from another region as unknown rather than guessing", () => {
    // `growth` is a Global plan. A BD account carrying that string is a data
    // problem, and inventing a price for it would hide it.
    const revenue = resolvePlanMonthlyRevenue("growth", "bd", RATE);

    expect(revenue.basis).toBe("unknown");
    expect(revenue.revenueBdt).toBe(0);
    expect(revenue.plan).toBeNull();
  });
});

describe("resolvePlanMonthlyRevenue — Global plans", () => {
  it.each([
    ["growth", 29],
    ["business", 79],
  ])("converts %s from USD to BDT at the live rate", (plan, usdPrice) => {
    const revenue = resolvePlanMonthlyRevenue(plan, "global", RATE);

    expect(revenue.revenueBdt).toBe(usdPrice * RATE);
    expect(revenue.basis).toBe("plan");
  });

  it("treats the Global free trial (Starter, price 0) as a real plan earning nothing", () => {
    // This is the one case where `revenueBdt: 0` with a `plan` basis is honest:
    // the plan genuinely costs the customer nothing.
    const revenue = resolvePlanMonthlyRevenue("starter", "global", RATE);

    expect(revenue.revenueBdt).toBe(0);
    expect(revenue.basis).toBe("plan");
  });

  it("reports contact-sales Enterprise as custom, never as free", () => {
    // ⚠️ Global Enterprise has `price: 0` **because it is sold by negotiation**,
    //    not because it is free. Reading it as 0 is what made every
    //    Enterprise workspace show a fake 100% margin.
    const revenue = resolvePlanMonthlyRevenue("enterprise", "global", RATE);

    expect(revenue.basis).toBe("custom");
    expect(revenue.revenueBdt).toBe(0);
    expect(revenue.plan?.key).toBe("enterprise");
    expect(isUsableRevenue(revenue)).toBe(false);
  });

  it("withholds a Global figure when the currency rate is unusable", () => {
    // A missing or zero rate would turn $79 into ৳0, which reads as a plan that
    // earns nothing while still costing money — a fake total loss.
    for (const badRate of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const revenue = resolvePlanMonthlyRevenue("business", "global", badRate);

      expect(revenue.basis).toBe("unknown");
      expect(revenue.revenueBdt).toBe(0);
    }
  });

  it("finds the plan even when it withholds the figure", () => {
    // The caller needs `plan` to explain *which* plan was unrecognised.
    expect(resolvePlanMonthlyRevenue("business", "global", 0).plan?.key).toBe("business");
  });
});

describe("resolvePlanMonthlyRevenue — input hygiene", () => {
  it("normalises case and surrounding whitespace", () => {
    // `User.plan` is a free-text column, so " Business " is a value that really
    // occurs — the same reason `planRank` trims and lowercases.
    for (const raw of ["Business", " business ", "BUSINESS"]) {
      expect(resolvePlanMonthlyRevenue(raw, "bd", RATE).revenueBdt).toBe(2499);
    }
  });

  it.each([[null], [undefined], [""], ["   "], ["pro"], ["agency"], ["platinum"]])(
    "reports %s as unknown instead of silently repricing it",
    (plan) => {
      const revenue = resolvePlanMonthlyRevenue(plan as string | null, "bd", RATE);

      expect(revenue.basis).toBe("unknown");
      expect(revenue.revenueBdt).toBe(0);
    },
  );
});

describe("isUsableRevenue", () => {
  it("only allows a figure that came from a real price", () => {
    expect(isUsableRevenue(resolvePlanMonthlyRevenue("business", "bd", RATE))).toBe(true);
    expect(isUsableRevenue(resolvePlanMonthlyRevenue("enterprise", "global", RATE))).toBe(false);
    expect(isUsableRevenue(resolvePlanMonthlyRevenue("pro", "bd", RATE))).toBe(false);
  });
});

/**
 * ── Regression tripwires ──────────────────────────────────────────────────────
 * These assertions exist to stop a specific, already-deleted bug from coming
 * back. Two admin routes used to carry their own copy of:
 *
 *     { starter: 0, growth: 2990, pro: 7990, agency: 14990, enterprise: 19900 }
 *
 * None of those numbers matched a real BD plan, and three of the keys did not
 * exist at all. Every profit figure those screens printed was therefore wrong.
 * If someone reintroduces a local revenue table, the first test below fails.
 */
describe("regression: plan revenue comes from the catalogue, not a local table", () => {
  it("prices every BD plan from `BD_PLANS` itself", () => {
    for (const plan of BD_PLANS) {
      const revenue = resolvePlanMonthlyRevenue(plan.key, "bd", RATE);

      expect(revenue.revenueBdt).toBe(plan.price);
      expect(revenue.basis).toBe("plan");
    }
  });

  it("prices every priced Global plan from `GLOBAL_PLANS` itself", () => {
    for (const plan of GLOBAL_PLANS.filter((entry) => entry.contact !== true)) {
      const revenue = resolvePlanMonthlyRevenue(plan.key, "global", RATE);

      expect(revenue.revenueBdt).toBe(plan.price * RATE);
      expect(revenue.basis).toBe("plan");
    }
  });

  it("has no BD plan whose catalogue price is 0", () => {
    // The old table priced `starter` at 0 in Bangladesh, which made Starter
    // workspaces look free. They are not — they cost ৳999 a month.
    expect(BD_PLANS.filter((plan) => plan.price === 0)).toEqual([]);
  });

  it.each([["pro"], ["agency"]])("does not recognise %s, which never was a plan", (key) => {
    expect(BD_PLANS.some((plan) => plan.key === key)).toBe(false);
    expect(GLOBAL_PLANS.some((plan) => plan.key === key)).toBe(false);
  });
});
