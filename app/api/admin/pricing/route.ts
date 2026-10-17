import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/core/admin-auth";
import {
  countCouponRedemptions,
  readPricingCatalogueForAdmin,
  savePricingCatalogue,
} from "@/lib/services/pricing-catalogue";

/**
 * Admin Pricing API (১৫.৭)
 * ─────────────────────────────────────────────────────────────────────────────
 * `/api/admin/ai-settings`-এর ঠিক একই ছাঁচ — এবং সেটি ইচ্ছাকৃত, কারণ দুটি
 * একই ধরনের কাজ করে: একটি `PlatformSetting` JSON সম্পাদনা, যার একটি ভুল মান
 * সমগ্র প্ল্যাটফর্মে প্রভাব ফেলে।
 *
 * ⚠️ এখানে Zod বাধ্যতামূলক (AGENTS §2), শুধু সৌন্দর্যের জন্য নয়: এই endpoint-এ
 *    একটি বেঠিক সংখ্যা মানে **প্রতিটি merchant-এর দাম** বদলে যাওয়া। client-এর
 *    input গার্ড সুবিধার জন্য, নিরাপত্তা নয় — শেষ প্রতিরক্ষা এখানেই।
 *
 * ⚠️ পড়তে ব্যর্থ হলে **৫০০**, ডিফল্ট নয়। কারণ ai-settings-এ যে যুক্তিটি লেখা
 *    আছে সেটি এখানেও হুবহু: ডিফল্ট ফেরত দিলে admin "DB-র দাম" আর "পড়তে ব্যর্থ
 *    হয়ে বানানো ডিফল্ট" — এই দুটোর পার্থক্য বুঝতেই পারতেন না, পেজটি স্বাভাবিক
 *    দেখাত, আর তিনি Save চেপে আসল দামগুলো ডিফল্ট দিয়ে চাপা দিতেন।
 */

// ─── Validation ───────────────────────────────────────────────────────────────

/** region-ভেদে একটি মান — দুটো region-ই ঐচ্ছিক। */
const RegionsSchema = <T extends z.ZodTypeAny>(inner: T) =>
  z
    .object({
      bd: inner.optional(),
      global: inner.optional(),
    })
    .optional();

/**
 * একটি plan-এর দাম-সংক্রান্ত override।
 *
 * ⚠️ উপরের সীমাগুলো ইচ্ছাকৃতভাবে উদার কিন্তু সসীম: এগুলো কোনো ব্যবসায়িক নিয়ম
 *    নয়, বরং একটি টাইপো-বাঁধা (একটি অতিরিক্ত শূন্য যোগ হয়ে ৯৯৯ → ৯,৯৯০ হয়ে
 *    যাওয়া)। প্রকৃত নিয়ম admin-এর নিজের হাতে।
 */
const PlanPriceOverrideSchema = z.object({
  monthly: z
    .number()
    .positive("A monthly price must be positive")
    .max(10_000_000, "That monthly price is not plausible")
    .optional(),
  yearly: z
    .number()
    .positive("A yearly price must be positive")
    .max(100_000_000, "That yearly price is not plausible")
    .optional(),
  hidden: z.boolean().optional(),
});

const CouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "A coupon code needs at least 2 characters")
      .max(40, "A coupon code is too long")
      // ⚠️ কোডটি URL ও ইমেইলে কপি-পেস্ট হয়, তাই শুধু নিরাপদ অক্ষর — একটি
      //    স্পেস বা `+` থাকলে লিংকে ভেঙে যেত, আর কেউ বুঝতেই পারত না কেন।
      .regex(/^[A-Za-z0-9_-]+$/, "Use only letters, digits, hyphen and underscore"),
    percentOff: z.number().min(0).max(100).optional(),
    amountOff: z.number().positive().max(1_000_000).optional(),
    appliesTo: z.enum(["plan", "topup", "both"]).default("both"),
    maxRedemptions: z.number().int().positive().max(1_000_000).optional(),
    // ⚠️ `z.string().datetime()` নয় — Zod-এর সংস্করণভেদে নাম বদলেছে, আর এই
    //    প্রকল্পে Zod 4 চলছে। একটি সাধারণ parseable-তারিখ যাচাই সংস্করণ-নিরপেক্ষ।
    expiresAt: z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), "Not a valid date")
      .optional(),
    isActive: z.boolean().default(true),
  })
  // ⚠️ ছাড়হীন কুপন গ্রহণ করা মানে checkout-এ "কুপন প্রয়োগ হয়েছে" দেখিয়ে ০ টাকা
  //    ছাড় দেওয়া। `normalizeCatalogue`-ও এটি বাদ দেয়, কিন্তু এখানে ৪০০ দিলে
  //    admin **কেন** জানতে পারেন — চুপচাপ বাদ পড়া একটি বাগের মতো দেখায়।
  .refine(
    (coupon) => coupon.percentOff !== undefined || coupon.amountOff !== undefined,
    { message: "Give the coupon a percentage off or a fixed amount off" }
  );

const CatalogueSchema = z.object({
  plans: z
    .object({
      bd: z.record(z.string(), PlanPriceOverrideSchema).optional(),
      global: z.record(z.string(), PlanPriceOverrideSchema).optional(),
    })
    .optional(),
  discountPercent: RegionsSchema(z.number().min(0).max(100)),
  annualDiscountPercent: RegionsSchema(z.number().min(0).max(100)),
  topUps: z.record(z.string(), z.number().positive().max(1_000_000)).optional(),
  coupons: z.array(CouponSchema).max(500, "Too many coupons").optional(),
});

// ─── GET /api/admin/pricing ───────────────────────────────────────────────────

export async function GET() {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const catalogue = await readPricingCatalogueForAdmin();

    // ⚠️ admin দৃশ্যটি সম্পূর্ণ catalogue পায় — **কুপন-সহ**। public payload
    //    থেকে কুপন বাদ যায় (`toPublicCatalogue`, `components/region-provider.tsx`),
    //    কিন্তু admin যিনি কোডগুলো বানাচ্ছেন তাঁর কাছে সেগুলো থাকতেই হবে।
    //
    // ⚠️ কতবার ব্যবহার হয়েছে তা **এখানেই লেজার থেকে গোনা হয়**, এবং এই পর্দাতেই
    //    সেটির একমাত্র প্রয়োজন: admin যখন `maxRedemptions: 50` বসান, তখন তিনি
    //    জানতে চান ইতিমধ্যে কতবার খরচ হয়েছে — নইলে "৫০" সংখ্যাটি একটি অন্ধ
    //    প্রতিশ্রুতি, আর সীমা শেষ হওয়ার খবর তিনি পাবেন শুধু merchant ফোন করলে।
    //
    // ⚠️ `countCouponRedemptions` **একই ফাংশন** যা checkout-এ ডাকা হয়, তাই
    //    পর্দার সংখ্যা আর কুপন বন্ধ হওয়ার মুহূর্ত কখনো আলাদা হতে পারে না।
    //    সমান্তরাল (`Promise.all`) ডাকা হয় কারণ কুপন কয়েকটি, আর একটির পর একটি
    //    চালালে পর্দা লোড হতে অকারণে বেশি সময় নিত।
    const codes = catalogue.coupons.map((coupon) => coupon.code);
    const counts = await Promise.all(codes.map((code) => countCouponRedemptions(code)));
    const redemptions = Object.fromEntries(
      codes.map((code, index) => [code, counts[index]])
    );

    // ⚠️ wrapper object, খালি catalogue নয় — কারণ কুপন-ব্যবহারের সংখ্যা catalogue-এর
    //    অংশ **নয়** (এটি config নয়, লেজার), আর দুটোকে একই স্তরে মিশিয়ে দিলে
    //    সেভ-এর সময় সংখ্যাগুলো config-এর সাথে DB-তে ফিরে যাওয়ার ঝুঁকি থাকত।
    return NextResponse.json({ catalogue, redemptions });
  } catch (error) {
    console.error("[ADMIN_PRICING_GET]", error);
    return NextResponse.json(
      { error: "Could not read the pricing catalogue from the database." },
      { status: 500 }
    );
  }
}

// ─── PUT /api/admin/pricing ───────────────────────────────────────────────────

/**
 * পুরো বিন্যাসটি প্রতিস্থাপন করে।
 *
 * ⚠️ **সম্পূর্ণ প্রতিস্থাপন** — `ai-settings`-এর মতোই। অর্থাৎ যে admin পর্দা
 *    লোড না করেই Save চাপেন, তিনি সব কিছু মুছে দেবেন। কিন্তু ক্লায়েন্টে সেই
 *    অবস্থাটি অসম্ভব করা হয়েছে: GET ব্যর্থ হলে পর্দা ফর্মই দেখায় না, আর লোড
 *    চলাকালীন Save বন্ধ থাকে। পর্দার যে গার্ডটি লিখতে হয় না, সেটি সবচেয়ে
 *    কার্যকর গার্ড।
 *
 * ── কেন `unknown` কী বাদ দেওয়ার দরকার নেই ──────────────────────────────────
 * `normalizeCatalogue` নিজেই যা বোঝে না তা ফেলে দেয়, আর `savePricingCatalogue`
 * **normalize করা মান** লেখে — admin যা পাঠিয়েছেন তা নয়। ফলে DB-তে কখনো
 * `monthly: 0` বা `percentOff: 1500` পড়ে থাকতে পারে না।
 */
export async function PUT(req: Request) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();
    const parsed = CatalogueSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const saved = await savePricingCatalogue(parsed.data);

    return NextResponse.json({ success: true, catalogue: saved });
  } catch (error) {
    console.error("[ADMIN_PRICING_PUT]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
