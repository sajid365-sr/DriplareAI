import { describe, expect, it } from "vitest";

import {
  getPlanIfDefined,
  isPaidPlan,
  planAllowsEcommerce,
  planAllowsPlatform,
} from "./plan-config";
import { isPackageAllowedForPlan } from "./payment-packages";

/**
 * Entitlement rules (১৫.৩).
 *
 * These are the four functions every gate in the app now reads — the channel
 * connect route, the courier settings, the orders module and the Uddhaoktapay
 * checkout. They are pure, so the whole rule table can be pinned here rather
 * than rediscovered by reading eight route handlers.
 *
 * The recurring theme is the **fail-open for an unknown plan key**. BD has no
 * `growth` plan and the repo still carries `growth_bdt` / `pro_bdt` payment
 * packages from when it did, so a merchant on one of those keys exists as far as
 * the database is concerned. Every check below therefore has to answer "what
 * happens to them", and the answer is deliberately "they keep what they had".
 *
 * ⚠️ দুটো ঠিকানা এই ফাইলের পরিধির বাইরে, কারণ তারা ক্যাটালগ বদলায় না — নিয়ম
 *    বদলায়: কোন legacy key কোন region-এ কোন plan (১৫.৪) → `legacy-plan.test.ts`,
 *    আর কেনা-যায়-কি-না সেই checkout-নিয়মের বাকি অর্ধেক → ১৫.৫-এর
 *    `isPackageAllowedForPlan` টেস্ট, নিচে।
 */

describe("getPlanIfDefined", () => {
  it("finds a plan this region actually sells", () => {
    expect(getPlanIfDefined("bd", "starter")?.key).toBe("starter");
    expect(getPlanIfDefined("bd", "business")?.key).toBe("business");
    expect(getPlanIfDefined("global", "growth")?.key).toBe("growth");
  });

  it("returns null for a key the region does not sell, unlike getPlan", () => {
    // `getPlan("bd", "growth")` silently answers with starter. That answer is
    // indistinguishable from a correct one, which is exactly why the gates use
    // this function instead.
    expect(getPlanIfDefined("bd", "growth")).toBeNull();
    expect(getPlanIfDefined("bd", "pro")).toBeNull();
    expect(getPlanIfDefined("global", "pro")).toBeNull();
  });

  it("tolerates casing, padding and nothing at all", () => {
    expect(getPlanIfDefined("bd", "  BUSINESS ")?.key).toBe("business");
    expect(getPlanIfDefined("bd", "")).toBeNull();
    expect(getPlanIfDefined("bd", undefined as unknown as string)).toBeNull();
  });
});

describe("isPaidPlan", () => {
  it("counts only the free tier as free", () => {
    expect(isPaidPlan("starter")).toBe(false);
    expect(isPaidPlan("  STARTER ")).toBe(false);
    expect(isPaidPlan("business")).toBe(true);
    expect(isPaidPlan("enterprise")).toBe(true);
  });

  it("treats a retired key as paid", () => {
    // `growth` and `pro` were real plans with real payments. Calling them free
    // would put a paying merchant behind the free tier's limits.
    expect(isPaidPlan("growth")).toBe(true);
    expect(isPaidPlan("pro")).toBe(true);
  });

  it("treats a missing plan as not paid", () => {
    // An empty value is not an unknown plan — it is the absence of one, and
    // every caller defaults it to starter before asking.
    expect(isPaidPlan("")).toBe(false);
    expect(isPaidPlan(undefined as unknown as string)).toBe(false);
  });
});

describe("planAllowsPlatform", () => {
  it("gives the free tier exactly what its feature list names", () => {
    // Both regions' Starter tiers: Facebook + the Web Widget, nothing else.
    expect(planAllowsPlatform("starter", "bd", "facebook")).toBe(true);
    expect(planAllowsPlatform("starter", "bd", "website")).toBe(true);
    expect(planAllowsPlatform("starter", "bd", "whatsapp")).toBe(false);
    expect(planAllowsPlatform("starter", "bd", "instagram")).toBe(false);
    expect(planAllowsPlatform("starter", "global", "facebook")).toBe(true);
    expect(planAllowsPlatform("starter", "global", "website")).toBe(true);
    // ...but the widget is the only extra one. `maxIntegrationsPerChatbot: 1`
    // is what limits the merchant to one of the two.
    expect(planAllowsPlatform("starter", "global", "whatsapp")).toBe(false);
  });

  it("lets every paid plan through", () => {
    for (const plan of ["business", "enterprise"]) {
      for (const platform of ["facebook", "instagram", "whatsapp", "website", "anything"]) {
        expect(planAllowsPlatform(plan, "bd", platform)).toBe(true);
      }
    }
    expect(planAllowsPlatform("growth", "global", "whatsapp")).toBe(true);
  });

  it("does not apply one region's limits to another region's merchant", () => {
    // Global sells `growth`; BD does not. A merchant on it must not pick up BD
    // Starter's Facebook-only rule just because BD is where the fallback lands.
    expect(planAllowsPlatform("growth", "bd", "whatsapp")).toBe(true);
  });

  it("normalises the slug before comparing", () => {
    expect(planAllowsPlatform("starter", "bd", "  FACEBOOK  ")).toBe(true);
    expect(planAllowsPlatform("starter", "bd", "WhatsApp")).toBe(false);
  });

  it("refuses an empty slug rather than reading it as a wildcard", () => {
    expect(planAllowsPlatform("business", "bd", "")).toBe(false);
    expect(planAllowsPlatform("business", "bd", undefined as unknown as string)).toBe(false);
  });
});

describe("planAllowsEcommerce", () => {
  it("follows the feature list in both regions", () => {
    expect(planAllowsEcommerce("starter", "bd")).toBe(false); // "No E-Commerce Integration"
    expect(planAllowsEcommerce("business", "bd")).toBe(true); // "E-Commerce (All Couriers)"
    expect(planAllowsEcommerce("enterprise", "bd")).toBe(true);
    expect(planAllowsEcommerce("starter", "global")).toBe(false);
    expect(planAllowsEcommerce("growth", "global")).toBe(true);
  });

  it("does not strip e-commerce from a merchant on a retired key", () => {
    expect(planAllowsEcommerce("growth", "bd")).toBe(true);
    expect(planAllowsEcommerce("pro", "bd")).toBe(true);
  });
});

describe("isPackageAllowedForPlan", () => {
  it("stops the free tier buying a pack priced for another plan", () => {
    // The hole ১৫.৩ closed: the plan filter lived only in `TopUpCards.tsx`, so
    // POSTing this package id straight at the charge route bought 50,000
    // credits at Business pricing.
    expect(isPackageAllowedForPlan("topup_50k_business_bdt", "starter", "bd")).toBe(false);
    expect(isPackageAllowedForPlan("topup_500k_enterprise_bdt", "starter", "bd")).toBe(false);
  });

  it("allows a plan to buy its own pack", () => {
    expect(isPackageAllowedForPlan("topup_50k_business_bdt", "business", "bd")).toBe(true);
    expect(isPackageAllowedForPlan("topup_500k_enterprise_bdt", "enterprise", "bd")).toBe(true);
    expect(isPackageAllowedForPlan("topup_50k_enterprise_bdt", "enterprise", "bd")).toBe(true);
  });

  it("stops a plan buying a pack it is not priced for, even a dearer plan", () => {
    // Business pays ৳0.008 a credit, Enterprise ৳0.005 — so buying "down" is a
    // discount, not an upgrade. The match is exact, not a rank comparison.
    expect(isPackageAllowedForPlan("topup_50k_enterprise_bdt", "business", "bd")).toBe(false);
    expect(isPackageAllowedForPlan("topup_50k_business_bdt", "enterprise", "bd")).toBe(false);
  });

  it("never blocks a plan purchase — that is the upgrade path", () => {
    // Gating this would mean a Starter merchant could not buy the Business plan
    // that removes every limit this file is about.
    expect(isPackageAllowedForPlan("business_bdt", "starter", "bd")).toBe(true);
    expect(isPackageAllowedForPlan("starter_bdt", "starter", "bd")).toBe(true);
  });

  it("refuses to sell a negotiated plan (১৫.৫)", () => {
    // BD Enterprise stopped being self-serve: it is unlimited chatbots and
    // unlimited credits, so a fixed published price only fixes one side of an
    // equation whose other side is unbounded (the derivation measured −524%).
    // `contact: true` says "the price is unknown", and a package with an unknown
    // price cannot be charged — the rail is an admin-issued payable invoice
    // (`kind: "invoice_plan"`) instead.
    //
    // `enterprise_bdt` stays in the catalogue because old transactions reference
    // it and the grant path reads it *after* the money has moved.
    expect(isPackageAllowedForPlan("enterprise_bdt", "starter", "bd")).toBe(false);
    expect(isPackageAllowedForPlan("enterprise_bdt", "business", "bd")).toBe(false);
    expect(isPackageAllowedForPlan("enterprise_bdt", "enterprise", "bd")).toBe(false);
  });

  it("refuses to sell a negotiated plan in either region", () => {
    // The rule is read off the catalogue, not written per region: Global
    // Enterprise has been `contact: true` all along, so this only had to be
    // stated once for both.
    expect(isPackageAllowedForPlan("enterprise_bdt", "starter", "global")).toBe(false);
  });

  it("lets a merchant on a retired key keep topping up", () => {
    // No pack names `growth` or `pro`, so an exact match can never succeed for
    // them. Refusing would tell someone who is paying that they may not buy
    // credits — the same fail-open rule the platform and e-commerce checks use.
    expect(isPackageAllowedForPlan("topup_50k_business_bdt", "growth", "bd")).toBe(true);
    expect(isPackageAllowedForPlan("topup_50k_business_bdt", "pro", "bd")).toBe(true);
  });

  it("rejects a package id that does not exist", () => {
    expect(isPackageAllowedForPlan("topup_free_forever", "business", "bd")).toBe(false);
    expect(isPackageAllowedForPlan("", "business", "bd")).toBe(false);
  });

  it("rejects an empty plan rather than failing open on it", () => {
    // Empty is an absent plan, not an unknown one — see `isPaidPlan`.
    expect(isPackageAllowedForPlan("topup_50k_business_bdt", "", "bd")).toBe(false);
  });
});
