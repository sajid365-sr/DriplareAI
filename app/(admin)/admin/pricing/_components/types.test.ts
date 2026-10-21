import { describe, expect, it } from "vitest";

import { normalizeCatalogue } from "@/lib/domain/pricing-catalogue";

import {
  draftFromCatalogue,
  draftToPayload,
  emptyDraft,
  validateDraft,
  type PricingDraft,
} from "./types";

/**
 * `/admin/pricing`-এর খসড়া-স্তর
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ এখানে যা পরীক্ষা করা হয় তা **পর্দার রূপান্তর**, দামের হিসাব নয় — হিসাবগুলো
 *    `pricing-catalogue.test.ts`-এ। তবু এই ফাইলটির মূল্য বড়, কারণ এখানকার একটি
 *    ভুলের ফল হলো **admin-এর পর্দা যা দেখায় আর DB-তে যা যায় তার ফারাক** — এবং
 *    সেটি একটি নীরব ভুল: admin Save চাপেন, "সফল" দেখেন, অথচ একটি দাম বদলায়নি।
 */

/** একটি পূর্ণ ক্যাটালগ, যেমনটি DB-তে থাকতে পারে। */
const CATALOGUE = {
  plans: {
    bd: { starter: { monthly: 899 }, business: { monthly: 2499, yearly: 22499 } },
    global: { starter: { hidden: true } },
  },
  discountPercent: { bd: 20, global: 0 },
  annualDiscountPercent: { bd: 25, global: 25 },
  topUps: { topup_50k_business_bdt: 350 },
  coupons: [
    { code: "EID25", percentOff: 25, appliesTo: "both", isActive: true },
    {
      code: "FLAT100",
      amountOff: 100,
      appliesTo: "plan",
      maxRedemptions: 50,
      expiresAt: "2026-12-31T23:59:59.999Z",
      isActive: true,
    },
  ],
};

describe("draftFromCatalogue", () => {
  it("প্রতি region-এর **প্রতিটি** plan-এর একটি সারি বানায়, override থাকুক বা না", () => {
    const draft = draftFromCatalogue(normalizeCatalogue(CATALOGUE));

    // কেন এটিই জরুরি: কেবল override থাকা plan দেখালে admin জানতেনই না কোন
    // plan-গুলো এখনো কোডের ডিফল্ট দামে চলছে — অর্থাৎ পর্দাটি অসম্পূর্ণ ছবি দিত।
    expect(draft.plans.bd.starter).toBeDefined();
    expect(draft.plans.bd.enterprise).toBeDefined();
    expect(draft.plans.global.starter).toBeDefined();
  });

  it("override নেই এমন plan-এর ঘর ফাঁকা রাখে (০ নয়)", () => {
    const draft = draftFromCatalogue(normalizeCatalogue(CATALOGUE));
    // starter-এ override আছে, business-এ নেই বছরের।
    expect(draft.plans.bd.business.yearly).toBe("22499");
    expect(draft.plans.bd.enterprise.monthly).toBe("");
  });

  it("hidden override টগলে ওঠে", () => {
    const draft = draftFromCatalogue(normalizeCatalogue(CATALOGUE));
    expect(draft.plans.global.starter.hidden).toBe(true);
    expect(draft.plans.bd.starter.hidden).toBe(false);
  });

  it("amountOff কুপনকে `amount` mode-এ বসায়, percentOff-কে `percent`-এ", () => {
    const draft = draftFromCatalogue(normalizeCatalogue(CATALOGUE));
    expect(draft.coupons[0]).toMatchObject({ code: "EID25", mode: "percent", value: "25" });
    expect(draft.coupons[1]).toMatchObject({ code: "FLAT100", mode: "amount", value: "100" });
  });

  it("ISO মেয়াদকে `YYYY-MM-DD`-এ নামায় (অর্থাৎ `<input type=\"date\">` যা চায়)", () => {
    const draft = draftFromCatalogue(normalizeCatalogue(CATALOGUE));
    expect(draft.coupons[1].expiresAt).toBe("2026-12-31");
  });

  it("নেগুলোকে সীমা হিসেবে রাখে, অসীমকে ফাঁকা", () => {
    const draft = draftFromCatalogue(normalizeCatalogue(CATALOGUE));
    expect(draft.coupons[0].maxRedemptions).toBe("");
    expect(draft.coupons[1].maxRedemptions).toBe("50");
  });

  it("কোনো plan override নেই — তবু তালিকা তৈরি হয়, ক্র্যাশ করে না", () => {
    const draft = draftFromCatalogue(normalizeCatalogue(null));
    expect(Object.keys(draft.plans.bd).length).toBeGreaterThan(0);
    expect(draft.coupons).toEqual([]);
  });
});

describe("draftToPayload — round trip", () => {
  it("🔴 একবার ঘোরানো খসড়া আবার পাঠালে ক্যাটালগ **অপরিবর্তিত** থাকে", () => {
    // ⚠️ এটিই এই ফাইলের সবচেয়ে মূল্যবান পরীক্ষা। কারণ সবচেয়ে সাধারণ admin
    //    কাজটি (কিছু একটা বদলে Save) **গোটা** বিন্যাসটি আবার লেখে — অর্থাৎ
    //    কোনো একটি ক্ষেত্র পথে হারালে সেটি চুপচাপ মুছে যেত, আর ঠিক সেই ধরনের
    //    ক্ষতিই কেউ সাথে সাথে টের পায় না।
    const original = normalizeCatalogue(CATALOGUE);
    const payload = draftToPayload(draftFromCatalogue(original));

    expect(normalizeCatalogue(payload)).toEqual(original);
  });

  it("ফাঁকা দাম বাদ দেয়, `0` বা `null` পাঠায় না", () => {
    const payload = draftToPayload(emptyDraft());

    // খালি খসড়ায় কোনো plan-এ কোনো দাম নেই → প্রতিটি region-এর map খালি।
    expect(Object.keys(payload.plans.bd)).toHaveLength(0);
    expect(Object.keys(payload.plans.global)).toHaveLength(0);
  });

  it("কোড UPPER_CASE-এ normalize করে", () => {
    const draft = emptyDraft();
    draft.coupons = [
      {
        code: "eid25",
        mode: "percent",
        value: "25",
        appliesTo: "both",
        maxRedemptions: "",
        expiresAt: "",
        isActive: true,
      },
    ];

    const payload = draftToPayload(draft);
    // ⚠️ নইলে DB-তে "eid25" থাকত, অথচ `findCoupon` বড় হাতের অক্ষরে খোঁজে —
    //    অর্থাৎ admin একটি কুপন বানিয়ে সংরক্ষণ করতেন যা কেউ ব্যবহার করতে পারত না।
    expect(payload.coupons[0].code).toBe("EID25");
  });

  it("🔴 মেয়াদকে **দিনের শেষ মুহূর্তে** নামায়, রাত ০০:০০-এ নয়", () => {
    const draft = emptyDraft();
    draft.coupons = [
      {
        code: "NEWYEAR",
        mode: "amount",
        value: "100",
        appliesTo: "both",
        maxRedemptions: "",
        expiresAt: "2026-12-31",
        isActive: true,
      },
    ];

    const payload = draftToPayload(draft);
    const expiry = new Date(payload.coupons[0].expiresAt as string);

    // ⚠️ `<input type="date">` কেবল দিন দেয়। সেটিকে হুবহু পাঠালে UTC রাত ০০:০০
    //    হয়ে যেত — অর্থাৎ BD সময়ে সকাল ৬টা। তখন admin যে দিনটিকে "শেষ দিন"
    //    ভেবেছিলেন, তার সকালেই কুপনটি বন্ধ হয়ে যেত, আর `validateCoupon`-এর
    //    "মেয়াদ শেষের দিনটিও ধরা হয়" নিয়মটিও মিথ্যা হয়ে যেত।
    expect(expiry.getUTCDate()).toBe(31);
    expect(expiry.getUTCHours()).toBe(23);
    expect(expiry.getUTCMinutes()).toBe(59);
  });

  it("শতকরা কুপন `percentOff`, স্থির কুপন `amountOff` — কখনো দুটোই নয়", () => {
    const draft = emptyDraft();
    draft.coupons = [
      {
        code: "A",
        mode: "percent",
        value: "10",
        appliesTo: "both",
        maxRedemptions: "",
        expiresAt: "",
        isActive: true,
      },
      {
        code: "B",
        mode: "amount",
        value: "200",
        appliesTo: "topup",
        maxRedemptions: "5",
        expiresAt: "",
        isActive: false,
      },
    ];

    const payload = draftToPayload(draft);

    expect(payload.coupons[0]).toMatchObject({ percentOff: 10 });
    expect(payload.coupons[0].amountOff).toBeUndefined();
    expect(payload.coupons[1]).toMatchObject({ amountOff: 200, maxRedemptions: 5, isActive: false });
    expect(payload.coupons[1].percentOff).toBeUndefined();
  });
});

describe("validateDraft", () => {
  /** একটি ড্রাফটে একটি মান বসিয়ে যাচাই — পড়ার উপযোগী helper। */
  function withPlan(draft: PricingDraft, region: "bd" | "global", plan: string, cycle: "monthly" | "yearly", value: string) {
    draft.plans[region][plan][cycle] = value;
    return draft;
  }

  it("সুস্থ খসড়ায় কোনো সমস্যা নেই", () => {
    expect(validateDraft(draftFromCatalogue(normalizeCatalogue(CATALOGUE)))).toEqual([]);
    expect(validateDraft(emptyDraft())).toEqual([]);
  });

  it("ফাঁকা দাম সমস্যা নয় — সেটির অর্থ “ডিফল্ট থাকুক”", () => {
    const draft = emptyDraft();
    draft.plans.bd.starter.monthly = "   ";
    expect(validateDraft(draft)).toEqual([]);
  });

  it("শূন্য বা ঋণাত্মক দাম ধরে ফেলে", () => {
    // ⚠️ `0` এখানে **ধরা পড়া উচিত**: একটি ৳০ plan মানে বিনামূল্যে পণ্য, যা
    //    plan না বদলে কেবল দাম দিয়ে করা যায় না (আর Uddoktapay ০ নেয় না)।
    expect(validateDraft(withPlan(emptyDraft(), "bd", "starter", "monthly", "0"))).toEqual([
      { kind: "invalidPrice", region: "bd", plan: "starter", cycle: "monthly" },
    ]);
    expect(
      validateDraft(withPlan(emptyDraft(), "bd", "starter", "yearly", "-5"))[0].kind
    ).toBe("invalidPrice");
  });

  it("ছাড়ের শতাংশ ০–১০০-র বাইরে গেলে ধরে ফেলে", () => {
    const tooBig = emptyDraft();
    tooBig.discountPercent.bd = "120";
    expect(validateDraft(tooBig)[0]).toMatchObject({ kind: "percentRange", region: "bd" });

    const empty = emptyDraft();
    empty.annualDiscountPercent.global = "";
    expect(validateDraft(empty)[0]).toMatchObject({
      kind: "percentRange",
      field: "annualDiscountPercent",
    });

    // ০ বৈধ — "ছাড় নেই"।
    const none = emptyDraft();
    none.discountPercent.bd = "0";
    expect(validateDraft(none)).toEqual([]);
  });

  it("top-up-এর দাম আলাদা কারণ দিয়ে ধরে", () => {
    const draft = emptyDraft();
    draft.topUps.topup_50k_business_bdt = "0";
    expect(validateDraft(draft)).toEqual([
      { kind: "invalidTopUpPrice", packageId: "topup_50k_business_bdt" },
    ]);
  });

  it("কুপন-সারির সমস্যাগুলো **সারি নম্বর** ধরে বলে", () => {
    const draft = emptyDraft();
    draft.coupons = [
      { code: "", mode: "percent", value: "10", appliesTo: "both", maxRedemptions: "", expiresAt: "", isActive: true },
      { code: "OK10", mode: "percent", value: "10", appliesTo: "both", maxRedemptions: "", expiresAt: "", isActive: true },
      { code: "BAD CODE", mode: "percent", value: "10", appliesTo: "both", maxRedemptions: "", expiresAt: "", isActive: true },
      { code: "OK10", mode: "percent", value: "10", appliesTo: "both", maxRedemptions: "", expiresAt: "", isActive: true },
      { code: "OVER100", mode: "percent", value: "150", appliesTo: "both", maxRedemptions: "", expiresAt: "", isActive: true },
      { code: "NOAMT", mode: "amount", value: "", appliesTo: "both", maxRedemptions: "", expiresAt: "", isActive: true },
      { code: "BADMAX", mode: "percent", value: "10", appliesTo: "both", maxRedemptions: "2.5", expiresAt: "", isActive: true },
    ];

    expect(validateDraft(draft)).toEqual([
      { kind: "couponCode", row: 1 },
      { kind: "couponCode", row: 3 },
      { kind: "couponDuplicate", row: 4, code: "OK10" },
      { kind: "couponPercentMax", row: 5 },
      { kind: "couponValue", row: 6 },
      { kind: "couponMax", row: 7 },
    ]);
  });

  it("একটি সারিতে একটির বেশি সমস্যা বলে না (প্রথমটিই বলে)", () => {
    const draft = emptyDraft();
    draft.coupons = [
      { code: "!!", mode: "percent", value: "", appliesTo: "both", maxRedemptions: "", expiresAt: "", isActive: true },
    ];
    // কোডটিই ভুল, তাই মান যাচাই করে লাভ নেই — এবং একটি সারিতে দুটো লাল লেখা
    // admin-কে ভুলিয়ে দিত যে আসলে একটি জিনিস ঠিক করলেই চলবে।
    expect(validateDraft(draft)).toEqual([{ kind: "couponCode", row: 1 }]);
  });
});
