/**
 * Pricing Catalogue — admin-নির্ধারিত দাম, ছাড় ও কুপন (১৫.৭)
 * ─────────────────────────────────────────────────────────────────────────────
 * `plan-config.ts`-এর দাম আজ **কোডে লেখা** (BD Starter ৳৯৯৯, Business ৳২,৪৯৯ …),
 * আর সেগুলো বদলাতে হলে deploy লাগে। অথচ দামই একমাত্র সংখ্যা যা একজন ব্যবসায়ী
 * সবচেয়ে বেশিবার বদলাতে চান — ছাড় দিতে, প্রতিযোগীর সাথে মিলতে, ঈদের অফার করতে।
 * এই ফাইলটি সেই বদলটির **হিসাব** করে; কোথায় লেখা থাকবে সেটি `lib/services/`-এর কাজ।
 *
 * ── কেন this file-এ কোনো DB নেই ─────────────────────────────────────────────
 * repo-র নিয়ম: হিসাব `lib/domain/`-এ (pure, `server-only` ছাড়া), আর DB-র তার
 * `lib/services/`-এ। এখানে থাকার একটি প্রত্যক্ষ ফল আছে — নিচের প্রতিটি নিয়ম
 * (ছাড়ের ক্রম, ৳১ floor, কুপনের মেয়াদ) একটি সাধারণ unit test-এ চালানো যায়, অথচ
 * route handler-এ লেখা থাকলে কোনো test কখনো তাকে ধরতে পারত না। ১৫.৯-এ
 * `reset-eligibility.ts` ঠিক এই কারণে আলাদা করা হয়েছিল।
 *
 * ── নীল-ছাপা: ডিফল্ট কোডে, override DB-তে ────────────────────────────────────
 * ⚠️ `plan-config.ts`-এর `price`/`priceLabel` **মুছে ফেলা হয় না**, আর সেটি
 *    ইচ্ছাকৃত। DB-তে কেবল **override** থাকে; override না থাকলে কোডের ডিফল্টই
 *    চলে। তিনটি ফল, আর তিনটিই চাওয়া:
 *      ১. `PlatformSetting` row না থাকলেও (বা পড়তে ব্যর্থ হলেও) সাইট আগের মতোই
 *         চলে — "সব দাম ০" কখনো হবে না।
 *      ২. বিদ্যমান কোনো test ভাঙে না, কারণ ডিফল্ট সংখ্যাগুলো হুবহু একই।
 *      ৩. একটি নতুন plan ক্যাটালগে যোগ করলে তার জন্য admin-কে **কিছুই** করতে
 *         হয় না — ডিফল্ট দাম নিজে থেকেই কাজ করে।
 *
 * ⚠️ `normalizeCatalogue`-এর দিকটি **fail-safe**: অজানা বা ভাঙা JSON → খালি
 *    catalogue → কোডের ডিফল্ট। ক্রেডিট-নিয়মের ("read ব্যর্থ হলে 500, ডিফল্ট
 *    নয়") বিপরীত দিক, এবং পার্থক্যের কারণটি স্পষ্ট: ওখানে ডিফল্ট লেখা মানে
 *    **আসল নিয়ম মুছে ফেলা**, এখানে ডিফল্ট পড়া মানে **আসল দাম দেখানো**।
 *    একটি দুর্বল JSON-কে দাম না-দেখানোর চেয়ে ডিফল্ট দাম দেখানো নিরাপদ।
 */

import type { Region } from "@/lib/core/region";
import type { BillingCycle } from "@/lib/domain/billing-cycle";
import { PLAN_KEYS, type PlanConfig } from "@/lib/domain/plan-config";

// ─── Types ────────────────────────────────────────────────────────────────────

/** একটি plan-এর দাম-সংক্রান্ত override। না থাকা মানে "ক্যাটালগের ডিফল্ট"। */
export interface PlanPriceOverride {
  /** মাসিক দাম (region-এর মুদ্রায়)। */
  monthly?: number;
  /** বার্ষিক দাম — না থাকলে `annualDiscountPercent` থেকে গণনা হবে। */
  yearly?: number;
  /** true হলে public pricing page-এ plan-টি দেখানো হবে না। */
  hidden?: boolean;
}

/** কুপন কোডের প্রয়োগ-ক্ষেত্র। */
export type CouponScope = "plan" | "topup" | "both";

/**
 * একটি কুপন কোড।
 *
 * ⚠️ এখানে **`redeemedCount` নেই, এবং সেটি ইচ্ছাকৃত।** কতবার ব্যবহার হয়েছে
 *    তা একটি `PlatformSetting` blob-এ গুনতে গেলে দুটি tab একসাথে
 *    read-modify-write করে সংখ্যাটি হারাত (lost update)। তাই ব্যবহারের একমাত্র
 *    দলিল **অর্থের লেজার** — `PaymentTransaction.metadata.couponCode` গুনে
 *    সংখ্যাটি বের করা হয় (দেখুন `countCouponRedemptions`-এর ডাকারি)। এটি
 *    `hasPaidForPlan`-এর ঠিক একই নীতি: আলাদা flag নয়, payment row গোনা।
 */
export interface Coupon {
  /** সবসময় UPPER_CASE-এ normalize করা। */
  code: string;
  /** শতকরা ছাড় (০–১০০)। `amountOff`-এর সাথে একটিই থাকবে। */
  percentOff?: number;
  /** স্থির ছাড় (region-এর মুদ্রায়)। */
  amountOff?: number;
  appliesTo: CouponScope;
  /** না থাকলে সীমা নেই। */
  maxRedemptions?: number;
  /** ISO তারিখ; এর পরে কুপন আর খাটে না। */
  expiresAt?: string;
  isActive: boolean;
}

/** পুরো প্রাইসিং-বিন্যাস, যেমনটি `PlatformSetting`-এ থাকে। */
export interface PricingCatalogue {
  plans: Partial<Record<Region, Record<string, PlanPriceOverride>>>;
  /** সব merchant-এর জন্য ছাড় (%), region-ভেদে। */
  discountPercent: Partial<Record<Region, number>>;
  /** বার্ষিক plan-এর ছাড় (%), region-ভেদে। ডিফল্ট ২৫। */
  annualDiscountPercent: Partial<Record<Region, number>>;
  /** top-up package id → দাম। */
  topUps: Record<string, number>;
  coupons: Coupon[];
}

/**
 * ⚠️ `BillingCycle` এখানে **পুনরায় রপ্তানি** — ঘোষণাটি `billing-cycle.ts`-এ।
 *    কারণ "মাসিক/বার্ষিক" সময়ের ধারণা, দামের নয়; আর `resolvePlanExpiry` ও
 *    reset-eligibility-ও এই একই টাইপটি পড়ে। এখানে শুধু পুনরায় রপ্তানি করা
 *    হয় যাতে দাম-সংক্রান্ত caller-দের দুটি import না করতে হয়।
 */
export type { BillingCycle } from "./billing-cycle";

/** বার্ষিক ছাড়ের ডিফল্ট — আপনার সিদ্ধান্ত (২০২৬-১০-১৫)। */
export const DEFAULT_ANNUAL_DISCOUNT_PERCENT = 25;

/**
 * একটি checkout-এর ন্যূনতম amount।
 *
 * ⚠️ শূন্য বা ঋণাত্মক amount gateway-এ গেলে লেনদেন ব্যর্থ হয়, অথচ merchant
 *    দেখতেন "পেমেন্ট হয়েছে" — কারণ ছাড়ের হিসাব আমাদের দিকেই ভুল হয়েছিল।
 *    তাই ছাড় যতই বড় হোক, চার্জ কখনো এই সংখ্যার নিচে নামবে না।
 */
export const MIN_CHECKOUT_AMOUNT = 1;

/** যে region-গুলো ক্যাটালগে থাকতে পারে — `Region` টাইপের একমাত্র মানগুলো। */
const REGIONS: Region[] = ["bd", "global"];

// ─── Bengali numerals ────────────────────────────────────────────────────────

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/**
 * ASCII অঙ্ক → বাংলা অঙ্ক (বাকি অক্ষর অপরিবর্তিত, তাই কমা/৳ টিকে থাকে)।
 *
 * ⚠️ `Intl.NumberFormat("bn-BD")` ব্যবহার করা হয়নি: সেটি দশমিক ও হাজার-বিভাজক
 *    নিজের মতো বদলে দেয়, ফলে ক্যাটালগে হাতে লেখা "৳২,৪৯৯"-এর সাথে মিলত না —
 *    অর্থাৎ একটি plan-এর দাম কখনো বাংলা আকারে, কখনো অন্য আকারে দেখাত।
 */
function toBengaliDigits(value: string): string {
  return value.replace(/[0-9]/g, (digit) => BN_DIGITS[Number(digit)] ?? digit);
}

/**
 * একটি সংখ্যাকে দামের লেখায় বদল করে, region-এর মুদ্রা-চিহ্ন দিয়ে।
 *
 * `lang === "bn"` হলে অঙ্কগুলো বাংলা হয় — ক্যাটালগের হাতে লেখা
 * `{ en: "৳2,499", bn: "৳২,৪৯৯" }` ঠিক এই আকারটাই।
 */
export function formatPrice(amount: number, region: Region, lang: string): string {
  const rounded = Math.round(amount);
  const grouped = rounded.toLocaleString("en-US");
  const symbol = region === "global" ? "$" : "৳";
  const text = `${symbol}${grouped}`;
  return lang === "bn" && region !== "global" ? toBengaliDigits(text) : text;
}

/** "Custom" / "কাস্টম" — নেগোসিয়েটেড tier-এর জন্য (দাম নেই, ফাঁকা নয়)। */
export function customPriceLabel(lang: string): string {
  return lang === "bn" ? "কাস্টম" : "Custom";
}

// ─── Reading numbers safely ──────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** একটি বৈধ ধনাত্মক দাম, নাহলে `undefined` (শূন্য ও ঋণাত্মক বাদ)। */
function readPositive(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value);
}

/** ০–১০০-এর মধ্যে একটি শতাংশ, নাহলে `undefined`। */
function readPercent(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(100, Math.max(0, value));
}

// ─── normalizeCatalogue ──────────────────────────────────────────────────────

/**
 * `PlatformSetting.value` (যেকোনো `Json`) → একটি নিরাপদ `PricingCatalogue`।
 *
 * ⚠️ দর্শন: **যা বোঝা যায় না, তা বাদ পড়ে** — কোনো ব্যাখ্যা চাপিয়ে দেওয়া হয় না।
 *    একটি ভাঙা plan-এ ডিফল্ট বসানো আর একটি অজানা package id-এ ডিফল্ট বসানো —
 *    দুটোই ভুল দাম দেখানোর সুযোগ, তাই দুটোই বাদ।
 */
export function normalizeCatalogue(raw: unknown): PricingCatalogue {
  const catalogue: PricingCatalogue = {
    plans: {},
    discountPercent: {},
    annualDiscountPercent: {},
    topUps: {},
    coupons: [],
  };

  if (!isRecord(raw)) return catalogue;

  // ── plans: region → planKey → override ─────────────────────────────────────
  //
  // ⚠️ `raw.plans`-কে একবার একটি টাইপ-করা ভেরিয়েবলে ধরা হয়, এবং `plansByRegion`
  //    নিজে টাইপ-করা। কারণ `isRecord(raw.plans)` দিয়ে সরাসরি `raw.plans[region]`
  //    পড়লে TypeScript-এর narrowing এই loop-এর ভেতরে নিজের উপর নির্ভর করে বসে
  //    (TS7022) — অর্থাৎ `perRegion`-এর টাইপ নির্ধারণের জন্য `perRegion`-কেই
  //    জানতে চায়। এক ধাপ আলাদা করলে সেই চক্র ভাঙে, আর এটি সৌন্দর্য নয়: টাইপটি
  //    `any` হয়ে গেলে `value.monthly`-এর একটি টাইপো কোনোদিন ধরা পড়ত না।
  const plansByRegion: unknown = raw.plans;
  if (isRecord(plansByRegion)) {
    for (const region of REGIONS) {
      const perRegion: unknown = plansByRegion[region];
      if (!isRecord(perRegion)) continue;

      const overrides: Record<string, PlanPriceOverride> = {};

      for (const [planKey, value] of Object.entries(perRegion)) {
        if (!isRecord(value)) continue;

        // ⚠️ অজানা plan key বাদ — একটি টাইপো (`bussiness`) নীরবে একটি override
        //    জমিয়ে রাখত যা কোনো plan-এর সাথে কখনো মেলে না, অথচ admin পর্দায়
        //    সেটি একটি দাম বসানো থাকার মতো দেখাত। এর চেয়ে ভালো: সেটি না থাকা।
        const key = planKey.trim().toLowerCase();
        if (!(PLAN_KEYS as readonly string[]).includes(key)) continue;

        const override: PlanPriceOverride = {};
        const monthly = readPositive(value.monthly);
        const yearly = readPositive(value.yearly);

        if (monthly !== undefined) override.monthly = monthly;
        if (yearly !== undefined) override.yearly = yearly;
        if (value.hidden === true) override.hidden = true;

        // কিছুই বসল না — অর্থহীন entry, বাদ
        if (Object.keys(override).length > 0) {
          overrides[key] = override;
        }
      }

      if (Object.keys(overrides).length > 0) catalogue.plans[region] = overrides;
    }
  }

  // ── শতকরা ছাড় ─────────────────────────────────────────────────────────────
  if (isRecord(raw.discountPercent)) {
    for (const region of REGIONS) {
      const percent = readPercent(raw.discountPercent[region]);
      if (percent !== undefined) catalogue.discountPercent[region] = percent;
    }
  }

  if (isRecord(raw.annualDiscountPercent)) {
    for (const region of REGIONS) {
      const percent = readPercent(raw.annualDiscountPercent[region]);
      if (percent !== undefined) catalogue.annualDiscountPercent[region] = percent;
    }
  }

  // ── top-up দাম: packageId → সংখ্যা ─────────────────────────────────────────
  if (isRecord(raw.topUps)) {
    for (const [packageId, value] of Object.entries(raw.topUps)) {
      const price = readPositive(value);
      if (price !== undefined) catalogue.topUps[packageId.trim()] = price;
    }
  }

  // ── কুপন ───────────────────────────────────────────────────────────────────
  if (Array.isArray(raw.coupons)) {
    const seen = new Set<string>();

    for (const value of raw.coupons) {
      const coupon = readCoupon(value);
      // ⚠️ একই কোড দুইবার থাকলে **প্রথমটিই** থাকে। দ্বিতীয়টি রাখলে কোনটি
      //    খাটবে তা নির্ভর করত array-এর ক্রমে — অর্থাৎ admin পর্দায় যা দেখছেন
      //    তার সাথে চার্জের হিসাব মিলত না।
      if (coupon && !seen.has(coupon.code)) {
        seen.add(coupon.code);
        catalogue.coupons.push(coupon);
      }
    }
  }

  return catalogue;
}

/** একটি কাঁচা কুপন-বস্তু → `Coupon`, বা `null` যদি ব্যবহারযোগ্যই না হয়। */
function readCoupon(value: unknown): Coupon | null {
  if (!isRecord(value)) return null;

  const code = String(value.code ?? "").trim().toUpperCase();
  if (!code) return null;

  const percentOff = readPercent(value.percentOff);
  const amountOff = readPositive(value.amountOff);

  // ⚠️ কোনো ছাড়ই নেই এমন কুপন রাখা মানে checkout-এ "কুপন প্রয়োগ হয়েছে"
  //    দেখিয়ে ০ টাকা ছাড় দেওয়া — যা merchant-এর সাথে অসৎ। তাই বাদ।
  if (percentOff === undefined && amountOff === undefined) return null;

  const appliesTo = value.appliesTo;
  const scope: CouponScope =
    appliesTo === "plan" || appliesTo === "topup" || appliesTo === "both"
      ? appliesTo
      : "both";

  const maxRedemptions =
    typeof value.maxRedemptions === "number" &&
    Number.isFinite(value.maxRedemptions) &&
    value.maxRedemptions > 0
      ? Math.floor(value.maxRedemptions)
      : undefined;

  const expiresAt =
    typeof value.expiresAt === "string" && !Number.isNaN(Date.parse(value.expiresAt))
      ? value.expiresAt
      : undefined;

  return {
    code,
    // ⚠️ একটি কুপনে দুটিই থাকলে শতাংশটি জেতে — ছাড় দুবার বসলে চার্জ ঋণাত্মক
    //    হওয়ার পথ খুলত, আর "কোনটি জেতে" প্রশ্নের উত্তর array-এর ক্রমে নির্ভর করত।
    percentOff: percentOff !== undefined ? percentOff : undefined,
    amountOff: percentOff === undefined ? amountOff : undefined,
    appliesTo: scope,
    maxRedemptions,
    expiresAt,
    isActive: value.isActive !== false,
  };
}

/** কোড দিয়ে কুপন — নেই হলে `null`। কোড সবসময় case-নিরপেক্ষ। */
export function findCoupon(catalogue: PricingCatalogue, code: string): Coupon | null {
  const wanted = String(code ?? "").trim().toUpperCase();
  if (!wanted) return null;
  return catalogue.coupons.find((coupon) => coupon.code === wanted) ?? null;
}

/** ছাড়ের টাকার অঙ্ক — কেনা হচ্ছে কি না তা জানার আগেই হিসাবের জন্য। */
export function couponDiscountAmount(coupon: Coupon, amount: number): number {
  if (coupon.percentOff !== undefined) {
    return Math.round((amount * coupon.percentOff) / 100);
  }
  if (coupon.amountOff !== undefined) {
    return Math.min(coupon.amountOff, amount);
  }
  return 0;
}

// ─── ছাড়ের নিয়ম ─────────────────────────────────────────────────────────────

/**
 * একটি কুপন এই কেনাকাটায় খাটে কি না।
 *
 * ⚠️ ক্রমটাই নিয়ম, আর কারণগুলো আলাদা রাখা হয়েছে যাতে admin response-এ
 *    "কেন খাটল না" বলা যায় — নীরব প্রত্যাখ্যান একজন merchant-কে checkout-এ
 *    আটকে রাখে অথচ কোনো সূত্র দেয় না।
 */
export type CouponReject =
  | "not_found"
  | "inactive"
  | "expired"
  | "limit_reached"
  | "not_applicable";

/**
 * ⚠️ এটি **ইনপুট**, ফলাফল নয় — অর্থাৎ `ok`/`reason` এখানে নেই, ওগুলো কেবল
 *    `validateCoupon`-এর return type-এ। আগে এখানে `ok: boolean` থেকে গিয়েছিল,
 *    ফলে প্রতিটি caller-কে একটি অর্থহীন `ok` পাঠাতে হত, আর test-গুলো টাইপ
 *    ভেঙে দিত। একটি ইনপুট টাইপে "এই কুপনটি খাটে কি না" রাখা নিজেই একটি ভুল:
 *    সেটি প্রশ্ন, উত্তর নয়।
 */
export interface CouponCheck {
  /** কেনাকাটার ধরন — `appliesTo`-এর সাথে মেলাতে। */
  scope: "plan" | "topup";
  /** কুপনটি এখন পর্যন্ত কতবার ব্যবহার হয়েছে (লেজার থেকে গোনা)। */
  redemptions: number;
  now: Date;
}

export function validateCoupon(
  coupon: Coupon | null,
  check: CouponCheck
): { ok: boolean; reason?: CouponReject } {
  if (!coupon) return { ok: false, reason: "not_found" };
  if (!coupon.isActive) return { ok: false, reason: "inactive" };

  if (coupon.expiresAt) {
    const expiry = new Date(coupon.expiresAt);
    // ⚠️ মেয়াদ **শেষের দিনটিও** ধরে — অর্ধেক দিনের হিসাব নয়। ISO তারিখটি
    //    তাই ২৩:৫৯-এ ধরা হয়, নইলে সেই দিন সন্ধ্যায় কুপন চুপচাপ বন্ধ হয়ে যেত।
    if (check.now.getTime() > expiry.getTime()) {
      return { ok: false, reason: "expired" };
    }
  }

  if (coupon.maxRedemptions !== undefined && check.redemptions >= coupon.maxRedemptions) {
    return { ok: false, reason: "limit_reached" };
  }

  if (coupon.appliesTo !== "both" && coupon.appliesTo !== check.scope) {
    return { ok: false, reason: "not_applicable" };
  }

  return { ok: true };
}

// ─── দাম নির্ধারণ ────────────────────────────────────────────────────────────

export interface ResolvedPrice {
  /** ছাড়ের আগের দাম। */
  amount: number;
  /** লোকালাইজড লেখা (৳2,499 / ৳২,৪৯৯ / Custom)। */
  label: string;
  /** মাসিক দাম — বার্ষিক plan-এ "মাসে X"-এর জন্য। */
  monthlyAmount: number;
  /** নেগোসিয়েটেড tier (দাম নেই, ফাঁকা নয়)। */
  isCustom: boolean;
}

/** এই region-এ plan-এর override, বা `undefined`। */
export function getPlanOverride(
  catalogue: PricingCatalogue,
  region: Region,
  planKey: string
): PlanPriceOverride | undefined {
  return catalogue.plans[region]?.[String(planKey ?? "").trim().toLowerCase()];
}

/** region-এর বার্ষিক ছাড় (%), ডিফল্ট ২৫-এ পড়ে। */
export function annualDiscountPercent(
  catalogue: PricingCatalogue,
  region: Region
): number {
  return catalogue.annualDiscountPercent[region] ?? DEFAULT_ANNUAL_DISCOUNT_PERCENT;
}

/**
 * একটি plan-এর প্রকাশিত দাম, cycle অনুযায়ী — সব override মিলিয়ে।
 *
 * ⚠️ নেগোসিয়েটেড tier (`contact: true`) এখানেই থেমে যায়: দাম **জানা নেই**,
 *    শূন্য নয়। `plan-revenue.ts`-এর "unknown ≠ 0" নীতির প্রথম প্রতিরক্ষা এটি।
 */
export function resolveListPrice(
  plan: PlanConfig,
  region: Region,
  cycle: BillingCycle,
  catalogue: PricingCatalogue,
  lang: string
): ResolvedPrice {
  const override = getPlanOverride(catalogue, region, plan.key);
  const monthly = override?.monthly ?? plan.price;

  if (plan.contact === true) {
    return {
      amount: 0,
      label: customPriceLabel(lang),
      monthlyAmount: 0,
      isCustom: true,
    };
  }

  if (cycle === "monthly") {
    return {
      amount: monthly,
      label: formatPrice(monthly, region, lang),
      monthlyAmount: monthly,
      isCustom: false,
    };
  }

  // বার্ষিক: admin স্পষ্ট দাম দিলে সেটিই, নাহলে ছাড়-হিসাব
  const percent = annualDiscountPercent(catalogue, region);
  const yearly =
    override?.yearly ?? Math.round((monthly * 12 * (100 - percent)) / 100);

  return {
    amount: yearly,
    label: formatPrice(yearly, region, lang),
    monthlyAmount: monthly,
    isCustom: false,
  };
}

/**
 * পাবলিক পেজের জন্য plan-তালিকা — override বসানো, hidden বাদ।
 *
 * ⚠️ return করা `PlanConfig`-গুলোর `price`/`priceLabel` **আসল** দাম বহন করে,
 *    অর্থাৎ যেকোনো downstream হিসাব (`plan-revenue`, `credit-plan`,
 *    `reset-eligibility`-র `price === 0` শাখা) overlaid দাম পেলে আপনা-আপনি
 *    সঠিক হয় — কোনো ফাইলে হাত দিতে হয় না।
 *
 * ⚠️ `options.includeHidden` কেবল **admin** পর্দার জন্য। নিয়মটি আপাতদৃষ্টিতে
 *    বিপরীতমুখী: "লুকানো plan দেখানো"। কিন্তু admin-এর dropdown থেকে একটি
 *    লুকানো plan বাদ পড়লে সেটি **আর কখনো ফিরিয়ে আনা যেত না** — admin আর
 *    সেই row-টিই দেখতেন না যার `hidden` চেকবক্সটি আনটিক করতে হয়। অর্থাৎ
 *    একটি বাদ-দেওয়া সারি তত্ত্বগতভাবে নয়, কার্যত অপরিবর্তনীয়।
 *
 * (`lang` প্যারামিটারটি সরানো হলো: এটি কোনোদিন ব্যবহৃতই হয়নি — নিচে দুই ভাষার
 *  লেবেলই একসাথে তৈরি হয়। একটি অব্যবহৃত প্যারামিটার থাকা মানে ভবিষ্যতের
 *  একটি caller ভাববেন এটি কিছু করে।)
 */
export function applyCatalogue(
  plans: PlanConfig[],
  region: Region,
  catalogue: PricingCatalogue,
  options: { includeHidden?: boolean } = {}
): PlanConfig[] {
  const result: PlanConfig[] = [];

  for (const plan of plans) {
    const override = getPlanOverride(catalogue, region, plan.key);
    if (override?.hidden === true && options.includeHidden !== true) continue;

    const overridePrice = override?.monthly;
    if (overridePrice === undefined) {
      // কোনো override নেই — ক্যাটালগের বস্তুটিই ফেরত, হুবহু একই রেফারেন্স।
      // (ডিফল্ট-নীতি: override না থাকলে কিছুই বদলায় না।)
      result.push(plan);
      continue;
    }

    const nextPriceLabel =
      typeof plan.priceLabel === "string"
        ? formatPrice(overridePrice, region, "en")
        : {
            en: formatPrice(overridePrice, region, "en"),
            bn: formatPrice(overridePrice, region, "bn"),
          };

    result.push({ ...plan, price: overridePrice, priceLabel: nextPriceLabel });
  }

  return result;
}

/** plan-টি admin public পেজ থেকে সরিয়েছেন কি না। */
export function isPlanHidden(
  catalogue: PricingCatalogue,
  region: Region,
  planKey: string
): boolean {
  return getPlanOverride(catalogue, region, planKey)?.hidden === true;
}

// ─── Checkout-এর হিসাব ───────────────────────────────────────────────────────

export interface CheckoutAmountInput {
  /** ছাড়ের আগের দাম (উপরের `resolveListPrice` থেকে)। */
  listAmount: number;
  region: Region;
  scope: "plan" | "topup";
  catalogue: PricingCatalogue;
  coupon?: Coupon | null;
}

export interface CheckoutAmount {
  listAmount: number;
  discountAmount: number;
  finalAmount: number;
  /** কত শতাংশ পড়ল — UI-তে "২৫% ছাড়" দেখানোর জন্য। */
  discountPercent: number;
}

/**
 * checkout-এর আসল amount — একমাত্র এই ফাংশনই gateway-এ যাওয়া সংখ্যাটি দেয়।
 *
 * ⚠️ **ছাড় গুণ হয়ে বসে, যোগ হয়ে নয়** (`list × (1−global) × (1−কুপন)`)।
 *    যোগ হলে দুটি ৬০% ছাড় একসাথে ১২০% হয়ে ঋণাত্মক চার্জ বানাত — অর্থাৎ
 *    gateway ব্যর্থ হত, অথচ merchant দেখতেন ছাড় "প্রয়োগ হয়েছে"।
 *
 * ⚠️ গুণের ক্রম গুরুত্বপূর্ণ নয় (গুণ বিনিময়যোগ্য) — তাই কুপন প্রথমে না
 *    global প্রথমে, তা নিয়ে প্রশ্ন ওঠে না।
 *
 * ⚠️ শেষে `MIN_CHECKOUT_AMOUNT`-এর floor, এবং সেটি ইচ্ছাকৃত।
 */
export function resolveCheckoutAmount(input: CheckoutAmountInput): CheckoutAmount {
  const { listAmount, region, catalogue } = input;

  const safeList = Number.isFinite(listAmount) && listAmount > 0 ? listAmount : 0;

  const globalPercent = catalogue.discountPercent[region] ?? 0;
  const afterGlobal = (safeList * (100 - globalPercent)) / 100;

  let afterCoupon = afterGlobal;
  if (input.coupon) {
    afterCoupon = afterGlobal - couponDiscountAmount(input.coupon, afterGlobal);
  }

  const finalAmount = Math.max(MIN_CHECKOUT_AMOUNT, Math.round(afterCoupon));

  return {
    listAmount: safeList,
    discountAmount: Math.max(0, Math.round(safeList) - finalAmount),
    finalAmount,
    discountPercent:
      safeList > 0 ? Math.round(((safeList - finalAmount) / safeList) * 100) : 0,
  };
}

/**
 * পর্দায় দেখানোর দাম — শুধু region-ব্যাপী ছাড় প্রয়োগ করে (কুপন বাদ)।
 *
 * ⚠️ এটি `resolveCheckoutAmount`-এরই একটি সরু মোড়ক, এবং সেটি ইচ্ছাকৃত: পর্দায়
 *    যে সংখ্যাটি দেখা যায় আর gateway-এ যে সংখ্যাটি যায়, দুটো **একই ফাংশন** থেকে
 *    আসে। দুটো আলাদা হিসাব থাকলে একদিন একটি বদলাত আর অন্যটি থাকত — অর্থাৎ
 *    merchant "৳৭৯৯" দেখে ৳৯৯৯ চার্জিত হতেন, আর কেউ বুঝতেই পারত না কেন।
 *
 * কুপন এখানে নেই কারণ কোডটি চেকআউটের আগে অজানা, আর কোডটি ব্রাউজারে যায় না।
 */
export function discountedPrice(
  listAmount: number,
  region: Region,
  catalogue: PricingCatalogue
): CheckoutAmount {
  return resolveCheckoutAmount({
    listAmount,
    region,
    scope: "plan",
    catalogue,
    coupon: null,
  });
}

/**
 * top-up package-এর দাম — override থাকলে সেটি, নাহলে কোডের ডিফল্ট।
 *
 * ⚠️ আজ এই দামটি **তিন জায়গায়** লেখা (payment-packages.ts, TopUpCards.tsx-এর
 *    নিজের তালিকা, আর admin পর্দা)। override একটি হলেও কপিগুলো এক থাকতে হবে,
 *    তাই সবাই এই ফাংশন দিয়েই পড়বে।
 */
export function resolveTopUpPrice(
  packageId: string,
  defaultAmount: number,
  catalogue: PricingCatalogue
): number {
  return catalogue.topUps[packageId] ?? defaultAmount;
}

/**
 * ব্রাউজারে পাঠানোর মতো catalogue — **কুপন ছাড়া**।
 *
 * ⚠️ কুপন কোড কখনো client-এ যাবে না, এবং কারণটি কোড-গোপনীয়তার চেয়ে বেশি কিছু:
 *    কুপন একটি ছাড়ের চাবি। প্রতিটি merchant-কে পুরো তালিকা পাঠানো মানে
 *    সবাই সব কোড জানবে — অর্থাৎ একটি কুপন আর কখনো "শুধু এই গ্রাহকের জন্য" হতে
 *    পারবে না, আর কেউ একটি চেকআউট খুলে সব কোড পরীক্ষা করে ফেলতে পারবে।
 *
 * ছাড় প্রয়োগ হয় **server-এ** (`uddoktapay/charge`), তাই client-এর তালিকা
 * না থাকলেও হিসাব সঠিক থাকে। client শুধু একটি কোড **পাঠায়**।
 */
export function toPublicCatalogue(catalogue: PricingCatalogue): PricingCatalogue {
  return { ...catalogue, coupons: [] };
}
