import type { Region } from "@/lib/core/region";
import { getPlansForRegion } from "@/lib/domain/plan-config";
import { PAYMENT_PACKAGES } from "@/lib/domain/payment-packages";
import {
  DEFAULT_ANNUAL_DISCOUNT_PERCENT,
  type Coupon,
  type CouponScope,
  type PlanPriceOverride,
  type PricingCatalogue,
} from "@/lib/domain/pricing-catalogue";

/**
 * `/admin/pricing`-এর খসড়া-রূপ (১৫.৭)
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ **সব সংখ্যা এখানে `string`, `number` নয় — এবং এটি ইচ্ছাকৃত।**
 *
 * কারণ override-এর অর্থই "না থাকলে কোডের ডিফল্ট দাম"। admin যখন একটি ঘর
 * মুছতে চান (আগের override তুলে ফেলে ডিফল্টে ফিরতে), তখন ফাঁকা ঘরটি `number`
 * হলে `Number("")` → `0` হত — আর Zod জিরো প্রত্যাখ্যান করে ("A monthly price
 * must be positive")। অর্থাৎ "মুছুন" অপারেশনটি একটি বিভ্রান্তিকর error হতো,
 * অথচ admin কিছুই ভুল করেননি। string রাখলে ফাঁকা = "ডিফল্ট থাকুক", যা হুবহু
 * override-এর ভাষা।
 *
 * ⚠️ এখানে **পাঠানোর আগে যাচাই হয় না** — Zod-ই শেষ প্রতিরক্ষা
 *    ([`/api/admin/pricing`](app/api/admin/pricing/route.ts))। `validateDraft`
 *    শুধু টাইপো ধরে আগেই থামানোর জন্য, নিরাপত্তার জন্য নয়।
 */

export interface PlanPriceDraft {
  /** ফাঁকা = কোডের ডিফল্ট দাম। */
  monthly: string;
  yearly: string;
  hidden: boolean;
}

export interface CouponDraft {
  code: string;
  /**
   * ⚠️ শতকরা ও স্থির ছাড় **আলাদা তালিকা নয়, একটি mode** — কারণ
   *    `normalizeCatalogue` দুটো থাকলে শতকরাকেই জেতায়। পর্দায় দুটো ঘর থাকলে
   *    admin দুটোই ভরে বসে থাকতেন আর "কোনটি খাটছে" তা কখনো জানতেন না।
   */
  mode: "percent" | "amount";
  value: string;
  appliesTo: CouponScope;
  /** ফাঁকা = অসীম। */
  maxRedemptions: string;
  /** `YYYY-MM-DD`, ফাঁকা = মেয়াদ নেই। */
  expiresAt: string;
  isActive: boolean;
}

export interface PricingDraft {
  plans: Record<Region, Record<string, PlanPriceDraft>>;
  discountPercent: Record<Region, string>;
  annualDiscountPercent: Record<Region, string>;
  topUps: Record<string, string>;
  coupons: CouponDraft[];
}

/**
 * খসড়া → wire-এ যা যায়।
 *
 * ⚠️ এই টাইপটি ঘোষণা করা হয়েছে যাতে "payload-টি আসলে কী" প্রশ্নের উত্তর একটি
 *    জায়গায় থাকে, `unknown`-এর ভিতরে লুকানো না থাকে। এটি হুবহু সেই আকার যা
 *    [`/api/admin/pricing`](app/api/admin/pricing/route.ts)-এর Zod স্কিমা
 *    গ্রহণ করে, অর্থাৎ দুটো আলাদা হয়ে গেলে টাইপ-ত্রুটিতেই ধরা পড়বে।
 */
export interface CataloguePayload {
  plans: Record<string, Record<string, PlanPriceOverride>>;
  discountPercent: Record<string, number>;
  annualDiscountPercent: Record<string, number>;
  topUps: Record<string, number>;
  coupons: Coupon[];
}

/** যে region-গুলো সম্পাদনা করা যায় — `Region` টাইপের ঠিক সেই দুটি। */
export const EDITABLE_REGIONS: Region[] = ["bd", "global"];

/** Region-এর i18n লেবেল-এর key (`admin` namespace)। */
export const REGION_LABEL_KEY: Record<Region, string> = {
  bd: "pricing.region.bd",
  global: "pricing.region.global",
};

/** ড্রপডাউনে দেখানোর জন্য top-up pack-এর তালিকা (plan-ভেদে দাম আলাদা নয়)। */
export const TOP_UP_PACKAGE_IDS: string[] = Object.entries(PAYMENT_PACKAGES)
  .filter(([, pkg]) => pkg.isTopUp === true)
  .map(([id]) => id);

/**
 * খালি খসড়া — ক্যাটালগ পড়তে ব্যর্থ হলে বা এখনো লোড না হলে।
 *
 * ⚠️ `annualDiscountPercent`-এর ডিফল্ট ২৫ **ক্যাটালগের ধ্রুবক থেকেই** আসে,
 *    হাতে লেখা নয়: নইলে কোডে ডিফল্ট বদলালে admin পর্দা ২৫ দেখাত অথচ গ্রাহককে
 *    অন্য ছাড় দেওয়া হত।
 */
export function emptyDraft(): PricingDraft {
  const plans = {} as Record<Region, Record<string, PlanPriceDraft>>;
  const discountPercent = {} as Record<Region, string>;
  const annualDiscountPercent = {} as Record<Region, string>;

  for (const region of EDITABLE_REGIONS) {
    const perPlan: Record<string, PlanPriceDraft> = {};
    // ⚠️ নীল-ছাপ তালিকাটি `getPlansForRegion` — অর্থাৎ **সব** plan, লুকোনো-সহ।
    //    একটি লুকোনো plan এই পর্দায় না এলে admin একবার লুকিয়ে ফেলার পর আর
    //    কখনো সেটি ফিরিয়ে আনতে পারতেন না।
    for (const plan of getPlansForRegion(region)) {
      perPlan[plan.key] = { monthly: "", yearly: "", hidden: false };
    }
    plans[region] = perPlan;
    discountPercent[region] = "0";
    annualDiscountPercent[region] = String(DEFAULT_ANNUAL_DISCOUNT_PERCENT);
  }

  const topUps: Record<string, string> = {};
  for (const id of TOP_UP_PACKAGE_IDS) topUps[id] = "";

  return { plans, discountPercent, annualDiscountPercent, topUps, coupons: [] };
}

/** ISO তারিখ → `<input type="date">`-এর `YYYY-MM-DD` (স্থানীয় নয়, UTC ধরে)। */
function isoToDateInput(iso: string | undefined): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

/**
 * DB থেকে পড়া ক্যাটালগ → সম্পাদনযোগ্য খসড়া।
 *
 * ⚠️ প্রতি region-এর **প্রতিটি** plan-এর একটি সারি বানানো হয়, এমনকি যেগুলোতে
 *    override নেই সেগুলোরও। কারণ পর্দার কাজই হলো সব দাম একসাথে দেখানো — কেবল
 *    override থাকা plan দেখালে admin জানতেনই না কোন plan-গুলো এখনো ডিফল্টে।
 */
export function draftFromCatalogue(catalogue: PricingCatalogue): PricingDraft {
  const draft = emptyDraft();

  for (const region of EDITABLE_REGIONS) {
    const overrides = catalogue.plans[region] ?? {};
    for (const [planKey, override] of Object.entries(overrides)) {
      // অজানা plan key (কখনো কোড থেকে সরানো হয়েছে) — পর্দায় সারি নেই, তাই
      // একটি নতুন সারি বানানো হয় **না**। বানালে ওই ভুল key-টি Save-এ আবার
      // DB-তে ফিরে যেত, অর্থাৎ মৃত config চিরকাল বেঁচে থাকত।
      const row = draft.plans[region][planKey];
      if (!row) continue;
      row.monthly = override.monthly !== undefined ? String(override.monthly) : "";
      row.yearly = override.yearly !== undefined ? String(override.yearly) : "";
      row.hidden = override.hidden === true;
    }

    if (catalogue.discountPercent[region] !== undefined) {
      draft.discountPercent[region] = String(catalogue.discountPercent[region]);
    }
    if (catalogue.annualDiscountPercent[region] !== undefined) {
      draft.annualDiscountPercent[region] = String(catalogue.annualDiscountPercent[region]);
    }
  }

  for (const [id, amount] of Object.entries(catalogue.topUps)) {
    if (id in draft.topUps) draft.topUps[id] = String(amount);
  }

  draft.coupons = catalogue.coupons.map((coupon) => couponToDraft(coupon));

  return draft;
}

function couponToDraft(coupon: Coupon): CouponDraft {
  // ⚠️ দুটোই থাকলে শতকরাকেই দেখানো হয় (`normalizeCatalogue`-এর নিয়মের সাথে
  //    মিলিয়ে), নইলে পর্দায় একটি মান দেখাত অথচ খাটত অন্য একটি।
  const usesPercent = coupon.percentOff !== undefined;
  return {
    code: coupon.code,
    mode: usesPercent ? "percent" : "amount",
    value: String(usesPercent ? coupon.percentOff : (coupon.amountOff ?? "")),
    appliesTo: coupon.appliesTo,
    maxRedemptions:
      coupon.maxRedemptions !== undefined ? String(coupon.maxRedemptions) : "",
    expiresAt: isoToDateInput(coupon.expiresAt),
    isActive: coupon.isActive,
  };
}

/** "2499" → 2499; ফাঁকা/আবর্জনা → `undefined` (অর্থাৎ "ডিফল্ট থাকুক")। */
function positiveOrUndefined(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value);
}

/** "0" সহ শূন্য গ্রহণ করে — ছাড়ের ক্ষেত্রে ০ একটি বৈধ মান ("ছাড় নেই")। */
function numberOrUndefined(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value);
}

/**
 * একটি টাইপো-সমস্যা, **কাঠামোবদ্ধভাবে** — প্রস্তুত করা বাক্য নয়।
 *
 * ⚠️ এখানে ইংরেজি বা বাংলা কোনো বাক্য বানানো হয় না, এবং `{ region: "bd" }`
 *    জাতীয় কাঁচা enum-ও পর্দায় দেখানো হয় না। কারণটি `kind` দিয়ে প্রকাশ করা
 *    হয়, আর পর্দা সেটিকে ভাষায় বদলায় — নইলে বাংলা পর্দায় "bd" পড়ত।
 *    `kind`-এর ওপর একটি exhaustive `Record` থাকায় নতুন একটি কারণ যোগ করলে
 *    অনুবাদহীন হয়ে যাওয়া টাইপ-ত্রুটিতেই ধরা পড়বে।
 */
export type DraftProblem =
  | { kind: "percentRange"; region: Region; field: "discountPercent" | "annualDiscountPercent" }
  | { kind: "invalidPrice"; region: Region; plan: string; cycle: "monthly" | "yearly" }
  | { kind: "invalidTopUpPrice"; packageId: string }
  | { kind: "couponCode"; row: number }
  | { kind: "couponDuplicate"; row: number; code: string }
  | { kind: "couponValue"; row: number }
  | { kind: "couponPercentMax"; row: number }
  | { kind: "couponMax"; row: number };

/**
 * টাইপো-বাঁধা — পাঠানোর আগে।
 *
 * ⚠️ এই তালিকা Zod-এর নকল **নয়** এবং হওয়া উচিতও নয়: এখানে কেবল সেই ভুলগুলো
 *    ধরা হয় যা একটি ফর্মে ঘটা স্বাভাবিক (একটি অসম্পূর্ণ কুপন-সারি, সীমার বাইরে
 *    একটি শতাংশ)। প্রকৃত কর্তৃপক্ষ server-এর Zod, কারণ client-এর যাচাই যে কেউ
 *    বাইপাস করতে পারে।
 */
export function validateDraft(draft: PricingDraft): DraftProblem[] {
  const problems: DraftProblem[] = [];

  for (const region of EDITABLE_REGIONS) {
    for (const field of ["discountPercent", "annualDiscountPercent"] as const) {
      const raw = draft[field][region].trim();
      const value = Number(raw);
      if (raw === "" || Number.isNaN(value) || value < 0 || value > 100) {
        problems.push({ kind: "percentRange", region, field });
      }
    }

    for (const [plan, row] of Object.entries(draft.plans[region])) {
      for (const cycle of ["monthly", "yearly"] as const) {
        const raw = row[cycle];
        if (!raw.trim()) continue;
        const value = Number(raw);
        if (Number.isNaN(value) || value <= 0) {
          problems.push({ kind: "invalidPrice", region, plan, cycle });
        }
      }
    }
  }

  for (const [packageId, raw] of Object.entries(draft.topUps)) {
    if (!raw.trim()) continue;
    const value = Number(raw);
    if (Number.isNaN(value) || value <= 0) {
      problems.push({ kind: "invalidTopUpPrice", packageId });
    }
  }

  const seenCodes = new Set<string>();
  draft.coupons.forEach((coupon, index) => {
    const row = index + 1;
    const code = coupon.code.trim().toUpperCase();

    if (!/^[A-Z0-9_-]{2,40}$/.test(code)) {
      problems.push({ kind: "couponCode", row });
      return; // একই সারিতে দুটো error দেখানোর দরকার নেই
    }
    if (seenCodes.has(code)) {
      problems.push({ kind: "couponDuplicate", row, code });
      return;
    }
    seenCodes.add(code);

    const value = Number(coupon.value.trim());
    if (!coupon.value.trim() || Number.isNaN(value) || value <= 0) {
      problems.push({ kind: "couponValue", row });
    } else if (coupon.mode === "percent" && value > 100) {
      problems.push({ kind: "couponPercentMax", row });
    }

    if (coupon.maxRedemptions.trim()) {
      const max = Number(coupon.maxRedemptions);
      if (!Number.isInteger(max) || max <= 0) {
        problems.push({ kind: "couponMax", row });
      }
    }
  });

  return problems;
}

/**
 * খসড়া → সেই payload যা `/api/admin/pricing` প্রত্যাশা করে।
 *
 * ⚠️ ফাঁকা মান **বাদ দেওয়া হয়**, `null` বা `0` পাঠানো হয় না — কারণ override-এর
 *    অনুপস্থিতিই "ডিফল্ট" (নীল-ছাপ নীতি)। `null` পাঠালে `normalizeCatalogue`
 *    সেটি অজানা হিসেবে ফেলে দিত ঠিকই, কিন্তু DB-তে একটি অর্থহীন key পড়ে থাকত
 *    আর পরের admin-এর পর্দায় সেটি "কিছু একটা আছে" বলে ভ্রম জন্মাত।
 */
export function draftToPayload(draft: PricingDraft): CataloguePayload {
  const plans: Record<string, Record<string, PlanPriceOverride>> = {};

  for (const region of EDITABLE_REGIONS) {
    const perPlan: Record<string, PlanPriceOverride> = {};
    for (const [planKey, row] of Object.entries(draft.plans[region])) {
      const entry: PlanPriceOverride = {};
      const monthly = positiveOrUndefined(row.monthly);
      const yearly = positiveOrUndefined(row.yearly);
      if (monthly !== undefined) entry.monthly = monthly;
      if (yearly !== undefined) entry.yearly = yearly;
      if (row.hidden) entry.hidden = true;

      if (Object.keys(entry).length > 0) perPlan[planKey] = entry;
    }
    plans[region] = perPlan;
  }

  const topUps: Record<string, number> = {};
  for (const [id, raw] of Object.entries(draft.topUps)) {
    const amount = positiveOrUndefined(raw);
    if (amount !== undefined) topUps[id] = amount;
  }

  const discountPercent: Record<string, number> = {};
  const annualDiscountPercent: Record<string, number> = {};
  for (const region of EDITABLE_REGIONS) {
    const discount = numberOrUndefined(draft.discountPercent[region]);
    const annual = numberOrUndefined(draft.annualDiscountPercent[region]);
    if (discount !== undefined) discountPercent[region] = discount;
    if (annual !== undefined) annualDiscountPercent[region] = annual;
  }

  const coupons: Coupon[] = draft.coupons.map((coupon) => {
    const value = Number(coupon.value.trim());
    const entry: Coupon = {
      // ⚠️ `findCoupon` UPPER_CASE-এ খোঁজে, তাই এখানেই normalize করা হয়।
      //    নইলে admin "eid25" লিখে সংরক্ষণ করলে একটি কোড DB-তে থাকত যা কেউ
      //    ব্যবহারই করতে পারত না।
      code: coupon.code.trim().toUpperCase(),
      appliesTo: coupon.appliesTo,
      isActive: coupon.isActive,
    };
    if (coupon.mode === "percent") entry.percentOff = value;
    else entry.amountOff = value;

    const max = Number(coupon.maxRedemptions.trim());
    if (coupon.maxRedemptions.trim() && Number.isInteger(max) && max > 0) {
      entry.maxRedemptions = max;
    }

    // ⚠️ `<input type="date">` এই সময়টুকু দেয়: `YYYY-MM-DD`। ওটিকে হুবহু
    //    পাঠালে এটি **UTC রাত ০০:০০** হয়ে যায় — অর্থাৎ BD সময়ে সকাল ৬টা।
    //    ফলে যে দিনটি admin "শেষ দিন" ভেবেছিলেন, তার সকালেই কুপনটি বন্ধ হয়ে
    //    যেত। তাই দিনের শেষ মুহূর্তে ঠেলে দেওয়া হয়, যা
    //    `validateCoupon`-এর "মেয়াদ শেষের দিনটিও ধরা হয়" নিয়মের সাথে মেলে।
    if (coupon.expiresAt.trim()) {
      const endOfDay = new Date(`${coupon.expiresAt.trim()}T23:59:59.999Z`);
      if (!Number.isNaN(endOfDay.getTime())) entry.expiresAt = endOfDay.toISOString();
    }

    return entry;
  });

  return {
    plans,
    discountPercent,
    annualDiscountPercent,
    topUps,
    coupons,
  };
}
