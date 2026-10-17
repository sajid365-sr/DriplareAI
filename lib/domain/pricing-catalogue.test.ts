import { describe, expect, it } from "vitest";

import { BD_PLANS, GLOBAL_PLANS } from "./plan-config";
import {
  DEFAULT_ANNUAL_DISCOUNT_PERCENT,
  MIN_CHECKOUT_AMOUNT,
  annualDiscountPercent,
  applyCatalogue,
  findCoupon,
  formatPrice,
  isPlanHidden,
  normalizeCatalogue,
  resolveCheckoutAmount,
  resolveListPrice,
  resolveTopUpPrice,
  validateCoupon,
  type Coupon,
  type PricingCatalogue,
} from "./pricing-catalogue";

/**
 * ১৫.৭ — প্রাইসিং ক্যাটালগের নিয়মগুলো।
 *
 * ⚠️ এই ফাইলটির অস্তিত্বের কারণই হলো `pricing-catalogue.ts`-কে `lib/domain`-এ
 *    রাখা: ছাড়ের ক্রম, ৳১ floor আর কুপনের মেয়াদ — এগুলো এমন নিয়ম যেখানে একটি
 *    ভুলের ফল সরাসরি টাকা। route handler-এ লেখা থাকলে কোন test কখনো ধরত না।
 */

const STARTER = BD_PLANS[0]; // ৳৯৯৯, ১৫,০০০ credit
const ENTERPRISE = BD_PLANS[2]; // contact: true, price: 0

/** একটি পরিষ্কার catalogue — প্রতিটি test নিজের পরিবর্তনটি যোগ করে। */
function catalogue(overrides: Partial<PricingCatalogue> = {}): PricingCatalogue {
  return {
    plans: {},
    discountPercent: {},
    annualDiscountPercent: {},
    topUps: {},
    coupons: [],
    ...overrides,
  };
}

function coupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    code: "EID2026",
    percentOff: 20,
    appliesTo: "both",
    isActive: true,
    ...overrides,
  };
}

const NOW = new Date(2026, 9, 15, 12, 0, 0);

describe("formatPrice", () => {
  it("keeps the thousands separator the hand-written labels use", () => {
    // ক্যাটালগে হাতে লেখা `{ en: "৳2,499", bn: "৳২,৪৯৯" }` — ফলটিও হুবহু তাই
    // হতে হবে, নইলে একটি plan-এর দাম কখনো বাংলা আকারে কখনো অন্য আকারে দেখাত।
    expect(formatPrice(2499, "bd", "en")).toBe("৳2,499");
    expect(formatPrice(2499, "bd", "bn")).toBe("৳২,৪৯৯");
  });

  it("switches digits only, never the currency symbol", () => {
    // ⚠️ `Intl.NumberFormat("bn-BD")` এখানে ব্যবহার করা হয়নি — সেটি দশমিক ও
    //    বিভাজকও বদলে দেয়, ফলে উপরের মিলটি ভাঙত।
    expect(formatPrice(999, "bd", "bn")).toBe("৳৯৯৯");
    expect(formatPrice(999, "global", "bn")).toBe("$999");
  });
});

describe("normalizeCatalogue — যা বোঝা যায় না, তা বাদ", () => {
  it("returns an empty catalogue for anything that is not an object", () => {
    // ⚠️ এটিই fail-safe: একটি ভাঙা setting-এ সাইট **কোডের ডিফল্ট দাম** দেখবে,
    //    "সব দাম ০" নয়।
    for (const raw of [null, undefined, "nonsense", 42, []]) {
      expect(normalizeCatalogue(raw).coupons).toEqual([]);
      expect(normalizeCatalogue(raw).plans).toEqual({});
    }
  });

  it("drops non-positive and non-finite prices rather than rounding them to zero", () => {
    const parsed = normalizeCatalogue({
      plans: { bd: { starter: { monthly: 0 }, business: { monthly: -5 } } },
      topUps: { topup_x: Number.NaN, topup_y: 0, topup_z: 400 },
    });

    expect(parsed.plans.bd).toBeUndefined();
    // শূন্য top-up মানে "বিনামূল্যে credit" — একটি বাগ, একটি সিদ্ধান্ত নয়
    expect(parsed.topUps).toEqual({ topup_z: 400 });
  });

  it("drops an override aimed at a plan key that does not exist", () => {
    // ⚠️ একটি টাইপো (`bussiness`) নীরবে একটি override জমিয়ে রাখত যা কোনো
    //    plan-এর সাথে কখনো মেলে না, অথচ admin পর্দায় একটি দাম বসানো থাকার
    //    মতো দেখাত — অর্থাৎ "আমি দাম বদলেছি" অথচ দাম বদলায়নি।
    const parsed = normalizeCatalogue({
      plans: { bd: { bussiness: { monthly: 1200 }, business: { monthly: 2200 } } },
    });

    expect(Object.keys(parsed.plans.bd ?? {})).toEqual(["business"]);
  });

  it("clamps percentages into 0–100 instead of trusting them", () => {
    const parsed = normalizeCatalogue({
      discountPercent: { bd: 150, global: -20 },
      annualDiscountPercent: { bd: 500 },
    });

    expect(parsed.discountPercent.bd).toBe(100);
    expect(parsed.discountPercent.global).toBe(0);
    expect(parsed.annualDiscountPercent.bd).toBe(100);
  });

  it("throws away a coupon that discounts nothing", () => {
    // ছাড়হীন কুপন রাখা মানে checkout-এ "কুপন প্রয়োগ হয়েছে" দেখিয়ে ০ টাকা
    // ছাড় দেওয়া — merchant-এর সাথে অসৎ।
    const parsed = normalizeCatalogue({
      coupons: [
        { code: "EMPTY", appliesTo: "both", isActive: true },
        { code: "REAL", percentOff: 10, isActive: true },
      ],
    });

    expect(parsed.coupons.map((c) => c.code)).toEqual(["REAL"]);
  });

  it("keeps the first of two coupons sharing a code", () => {
    // ⚠️ দ্বিতীয়টি রাখলে "কোনটি খাটবে" নির্ভর করত array-এর ক্রমে — অর্থাৎ
    //    admin পর্দায় যা দেখছেন তার সাথে চার্জের হিসাব মিলত না।
    const parsed = normalizeCatalogue({
      coupons: [
        { code: "dup", percentOff: 10, appliesTo: "both", isActive: true },
        { code: "DUP", percentOff: 90, appliesTo: "both", isActive: true },
      ],
    });

    expect(parsed.coupons).toHaveLength(1);
    expect(parsed.coupons[0].percentOff).toBe(10);
  });

  it("prefers percentOff when a coupon declares both, so a charge can never go negative", () => {
    const parsed = normalizeCatalogue({
      coupons: [{ code: "BOTH", percentOff: 10, amountOff: 5000, isActive: true }],
    });

    expect(parsed.coupons[0].percentOff).toBe(10);
    expect(parsed.coupons[0].amountOff).toBeUndefined();
  });

  it("treats a missing isActive as active, and an explicit false as inactive", () => {
    const parsed = normalizeCatalogue({
      coupons: [
        { code: "DEFAULTED", percentOff: 10 },
        { code: "OFF", percentOff: 10, isActive: false },
      ],
    });

    expect(findCoupon(parsed, "DEFAULTED")?.isActive).toBe(true);
    expect(findCoupon(parsed, "OFF")?.isActive).toBe(false);
  });
});

describe("findCoupon", () => {
  it("matches regardless of case and surrounding whitespace", () => {
    const parsed = normalizeCatalogue({
      coupons: [{ code: "eid2026", percentOff: 25, isActive: true }],
    });

    expect(findCoupon(parsed, "  EID2026 ")?.percentOff).toBe(25);
    expect(findCoupon(parsed, "")).toBeNull();
  });
});

describe("resolveListPrice", () => {
  it("falls back to the catalogue when nothing is overridden", () => {
    // ⚠️ নীল-ছাপা নীতি: override না থাকলে কোডের ডিফল্টই — যা বিদ্যমান সব test
    //    অপরিবর্তিত রাখে।
    const price = resolveListPrice(STARTER, "bd", "monthly", catalogue(), "en");

    expect(price.amount).toBe(999);
    expect(price.label).toBe("৳999");
    expect(price.isCustom).toBe(false);
  });

  it("uses an admin override, and regenerates the localised label with it", () => {
    const cat = catalogue({ plans: { bd: { starter: { monthly: 799 } } } });

    expect(resolveListPrice(STARTER, "bd", "monthly", cat, "en").label).toBe("৳799");
    // বাংলা অঙ্ক নিজে থেকে আসে — admin-কে দুই ভাষার দাম লিখতে হয় না
    expect(resolveListPrice(STARTER, "bd", "monthly", cat, "bn").label).toBe("৳৭৯৯");
  });

  it("computes the yearly price with the 25% default discount", () => {
    // ৯৯৯ × ১২ = ১১,৯৮৮; ২৫% ছাড়ে ৮,৯৯১
    const price = resolveListPrice(STARTER, "bd", "yearly", catalogue(), "en");

    expect(price.amount).toBe(8991);
    expect(price.label).toBe("৳8,991");
    // মাসিক সমতুল্য দাম অটুট — "মাসে ৳৭৪৯" দেখানোর জন্য
    expect(price.monthlyAmount).toBe(999);
  });

  it("lets an explicit yearly price beat the computed one", () => {
    const cat = catalogue({
      plans: { bd: { starter: { monthly: 999, yearly: 8000 } } },
      annualDiscountPercent: { bd: 50 },
    });

    expect(resolveListPrice(STARTER, "bd", "yearly", cat, "en").amount).toBe(8000);
  });

  it("still reports a negotiated tier as Custom, never as a number", () => {
    // ⚠️ "unknown ≠ 0" — নেগোসিয়েটেড tier-এর দাম **জানা নেই**। এটিই
    //    `plan-revenue`-কে ভুয়া ১০০% margin থেকে বাঁচায়।
    const price = resolveListPrice(ENTERPRISE, "bd", "yearly", catalogue(), "bn");

    expect(price.isCustom).toBe(true);
    expect(price.amount).toBe(0);
    expect(price.label).toBe("কাস্টম");
  });
});

describe("annualDiscountPercent", () => {
  it("defaults to the agreed 25%", () => {
    expect(DEFAULT_ANNUAL_DISCOUNT_PERCENT).toBe(25);
    expect(annualDiscountPercent(catalogue(), "bd")).toBe(25);
    expect(annualDiscountPercent(catalogue(), "global")).toBe(25);
  });

  it("reads a per-region override", () => {
    const cat = catalogue({ annualDiscountPercent: { bd: 40, global: 10 } });

    expect(annualDiscountPercent(cat, "bd")).toBe(40);
    expect(annualDiscountPercent(cat, "global")).toBe(10);
  });

  it("honours a deliberate 0% — a valid business choice, not absence", () => {
    // ⚠️ `?? 25` বনাম `|| 25` — দ্বিতীয়টি ০-কে "নেই" ধরে চুপচাপ ২৫% ছাড় বসাত।
    const cat = catalogue({ annualDiscountPercent: { bd: 0 } });

    expect(annualDiscountPercent(cat, "bd")).toBe(0);
    expect(resolveListPrice(STARTER, "bd", "yearly", cat, "en").amount).toBe(11988);
  });
});

describe("applyCatalogue", () => {
  it("returns the very same plan objects when nothing is overridden", () => {
    // ⚠️ রেফারেন্স-সমানতা এখানে একটি দাবি, সুবিধা নয়: এর অর্থ override না
    //    থাকলে এই ফাইলটি ক্যাটালগের একটি সংখ্যাও বদলায় না।
    const applied = applyCatalogue(BD_PLANS, "bd", catalogue());

    expect(applied).toHaveLength(BD_PLANS.length);
    expect(applied[0]).toBe(BD_PLANS[0]);
  });

  it("overrides price and label together, never one alone", () => {
    const cat = catalogue({ plans: { bd: { starter: { monthly: 899 } } } });
    const applied = applyCatalogue(BD_PLANS, "bd", cat);
    const starter = applied.find((p) => p.key === "starter")!;

    expect(starter.price).toBe(899);
    // দাম আর লেখা একসাথে বদলায় — এটিই `applyCatalogue`-এ রাখার কারণ। দুটো
    // আলাদা জায়গায় বদলালে পর্দায় এক দাম, চার্জে আরেক দাম হত।
    expect(starter.priceLabel).toEqual({ en: "৳899", bn: "৳৮৯৯" });
  });

  it("keeps Global's plain-string label shape instead of inventing an object", () => {
    // Global ক্যাটালগে priceLabel একটি সাধারণ string, BD-তে একটি বস্তু। override
    // প্রতিটি region-এর নিজের রীতিই মানবে — নইলে `resolveLocalStr` আচরণ বদলাত।
    const cat = catalogue({ plans: { global: { growth: { monthly: 39 } } } });
    const applied = applyCatalogue(GLOBAL_PLANS, "global", cat);
    const growth = applied.find((p) => p.key === "growth")!;

    expect(growth.price).toBe(39);
    expect(growth.priceLabel).toBe("$39");
  });

  it("leaves other plans untouched when only one is overridden", () => {
    const cat = catalogue({ plans: { bd: { starter: { monthly: 899 } } } });
    const applied = applyCatalogue(BD_PLANS, "bd", cat);
    const business = applied.find((p) => p.key === "business")!;

    expect(business).toBe(BD_PLANS[1]);
  });

  it("hides a plan from the public list without touching the catalogue", () => {
    const cat = catalogue({ plans: { bd: { business: { hidden: true } } } });

    expect(applyCatalogue(BD_PLANS, "bd", cat).map((p) => p.key)).toEqual([
      "starter",
      "enterprise",
    ]);
    expect(isPlanHidden(cat, "bd", "business")).toBe(true);
    // ⚠️ ক্যাটালগের মূল array অপরিবর্তিত — admin পর্দায় plan-টি এখনো আছে
    expect(BD_PLANS).toHaveLength(3);
  });

  it("ignores an override aimed at the other region", () => {
    const cat = catalogue({ plans: { bd: { starter: { monthly: 1 } } } });

    expect(resolveListPrice(STARTER, "global", "monthly", cat, "en").amount).toBe(999);
  });
});

describe("validateCoupon", () => {
  const base = { scope: "plan" as const, redemptions: 0, now: NOW };

  it("accepts a live coupon that covers this kind of purchase", () => {
    expect(validateCoupon(coupon(), base)).toEqual({ ok: true });
  });

  it("refuses an unknown code, an inactive one, and an expired one", () => {
    expect(validateCoupon(null, base)).toEqual({ ok: false, reason: "not_found" });
    expect(validateCoupon(coupon({ isActive: false }), base)).toEqual({
      ok: false,
      reason: "inactive",
    });
    expect(
      validateCoupon(coupon({ expiresAt: "2026-10-14T23:59:00.000Z" }), base)
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("accepts a coupon on its own final day", () => {
    // ⚠️ সীমাটি `>` — `>=` হলে শেষ দিনের সন্ধ্যায় কুপন চুপচাপ বন্ধ হয়ে যেত,
    //    অথচ admin পর্দায় "আজ পর্যন্ত" লেখা।
    expect(
      validateCoupon(coupon({ expiresAt: NOW.toISOString() }), base).ok
    ).toBe(true);
  });

  it("refuses once the redemption limit is reached, measured from the ledger", () => {
    const limited = coupon({ maxRedemptions: 5 });

    expect(validateCoupon(limited, { ...base, redemptions: 4 }).ok).toBe(true);
    expect(validateCoupon(limited, { ...base, redemptions: 5 })).toEqual({
      ok: false,
      reason: "limit_reached",
    });
  });

  it("refuses a plan-only coupon at a top-up checkout, and vice versa", () => {
    expect(validateCoupon(coupon({ appliesTo: "plan" }), base).ok).toBe(true);
    expect(validateCoupon(coupon({ appliesTo: "plan" }), { ...base, scope: "topup" })).toEqual({
      ok: false,
      reason: "not_applicable",
    });
    expect(validateCoupon(coupon({ appliesTo: "topup" }), base)).toEqual({
      ok: false,
      reason: "not_applicable",
    });
  });

  it("reasons are distinct so the admin response can say WHY", () => {
    // নীরব প্রত্যাখ্যান একজন merchant-কে checkout-এ আটকে রাখে অথচ কোনো সূত্র
    // দেয় না — তাই প্রত্যেকটির নিজের কারণ।
    const reasons = [
      validateCoupon(null, base).reason,
      validateCoupon(coupon({ isActive: false }), base).reason,
      validateCoupon(coupon({ maxRedemptions: 1 }), { ...base, redemptions: 1 }).reason,
    ];

    expect(new Set(reasons).size).toBe(3);
  });
});

describe("resolveCheckoutAmount", () => {
  const noCoupon = { coupon: null };

  it("charges the list price when nothing is discounted", () => {
    const result = resolveCheckoutAmount({
      listAmount: 999,
      region: "bd",
      scope: "plan",
      catalogue: catalogue(),
      ...noCoupon,
    });

    expect(result).toEqual({
      listAmount: 999,
      discountAmount: 0,
      finalAmount: 999,
      discountPercent: 0,
    });
  });

  it("applies a region-wide discount", () => {
    const cat = catalogue({ discountPercent: { bd: 20 } });
    const result = resolveCheckoutAmount({
      listAmount: 999,
      region: "bd",
      scope: "plan",
      catalogue: cat,
      ...noCoupon,
    });

    expect(result.finalAmount).toBe(799);
    expect(result.discountAmount).toBe(200);
    expect(result.discountPercent).toBe(20);
  });

  it("STACKS multiplicatively, so two 50% discounts can never exceed 100%", () => {
    // ⚠️ যোগ হলে ৫০% + ৫০% = ১০০%... আর ৬০% + ৬০% = ১২০% — অর্থাৎ ঋণাত্মক
    //    চার্জ, gateway ব্যর্থ, অথচ merchant দেখতেন ছাড় "প্রয়োগ হয়েছে"।
    const cat = catalogue({ discountPercent: { bd: 50 } });
    const result = resolveCheckoutAmount({
      listAmount: 999,
      region: "bd",
      scope: "plan",
      catalogue: cat,
      coupon: coupon({ percentOff: 50 }),
    });

    // ৯৯৯ × ০.৫ × ০.৫ = ২৪৯.৭৫ → ২৫০
    expect(result.finalAmount).toBe(250);
  });

  it("never charges less than the ৳1 floor, however large the discount", () => {
    const cat = catalogue({ discountPercent: { bd: 100 } });
    const result = resolveCheckoutAmount({
      listAmount: 999,
      region: "bd",
      scope: "plan",
      catalogue: cat,
      coupon: coupon({ amountOff: 5000 }),
    });

    expect(result.finalAmount).toBe(MIN_CHECKOUT_AMOUNT);
  });

  it("caps a fixed-amount coupon at the amount it is discounting", () => {
    const result = resolveCheckoutAmount({
      listAmount: 400,
      region: "bd",
      scope: "topup",
      catalogue: catalogue(),
      coupon: coupon({ percentOff: undefined, amountOff: 1000 }),
    });

    expect(result.finalAmount).toBe(MIN_CHECKOUT_AMOUNT);
    expect(result.discountAmount).toBe(399);
  });

  it("discounts a top-up with a both-scope coupon", () => {
    const result = resolveCheckoutAmount({
      listAmount: 400,
      region: "bd",
      scope: "topup",
      catalogue: catalogue(),
      coupon: coupon({ percentOff: 25 }),
    });

    expect(result.finalAmount).toBe(300);
  });

  it("ignores a discount aimed at the other region", () => {
    const cat = catalogue({ discountPercent: { global: 50 } });
    const result = resolveCheckoutAmount({
      listAmount: 2500,
      region: "bd",
      scope: "plan",
      catalogue: cat,
      ...noCoupon,
    });

    expect(result.finalAmount).toBe(2500);
  });

  it("treats a nonsensical list amount as zero rather than passing NaN to the gateway", () => {
    const result = resolveCheckoutAmount({
      listAmount: Number.NaN,
      region: "bd",
      scope: "plan",
      catalogue: catalogue(),
      ...noCoupon,
    });

    expect(result.finalAmount).toBe(MIN_CHECKOUT_AMOUNT);
    expect(Number.isFinite(result.finalAmount)).toBe(true);
  });
});

describe("resolveTopUpPrice", () => {
  it("reads the default until an admin overrides it", () => {
    expect(resolveTopUpPrice("topup_50k_business_bdt", 400, catalogue())).toBe(400);
    expect(
      resolveTopUpPrice("topup_50k_business_bdt", 400, catalogue({ topUps: { topup_50k_business_bdt: 350 } }))
    ).toBe(350);
  });

  it("leaves other packs alone", () => {
    const cat = catalogue({ topUps: { topup_50k_business_bdt: 350 } });

    expect(resolveTopUpPrice("topup_100k_business_bdt", 800, cat)).toBe(800);
  });
});
