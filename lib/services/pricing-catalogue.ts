import "server-only";

import { db } from "@/lib/core/db";
import { PAID_STATUSES } from "@/lib/domain/payment-status";
import {
  normalizeCatalogue,
  type PricingCatalogue,
} from "@/lib/domain/pricing-catalogue";

/**
 * Pricing Catalogue — DB রেল (১৫.৭)
 * ─────────────────────────────────────────────────────────────────────────────
 * হিসাবগুলো সব `lib/domain/pricing-catalogue.ts`-এ (pure, test-যোগ্য); এখানে
 * কেবল **কোথায় থাকে** আর **কীভাবে পড়া/লেখা হয়**।
 *
 * ── কেন `PlatformSetting`, নতুন টেবিল নয় ────────────────────────────────────
 * `PlatformSetting` (`key @unique` + `value Json`) এই repo-র প্রতিষ্ঠিত ঘর —
 * `ai_credit_rules` · `ai_credit_derivation` · `openrouter_pricing` আগেই সেখানে।
 * একটি নতুন model মানে **DDL**, অর্থাৎ `prisma migrate diff` + ইউজারের অনুমতি —
 * অথচ এখানে সংরক্ষণের প্রয়োজন একটি ছোট, কম-সংখ্যার config, queryable ডেটা নয়।
 * ফলে ১৫.৭-এর গোটা দাম-ব্যবস্থা **একটিও schema পরিবর্তন ছাড়াই** হয়।
 *
 * ── ⚠️ কোনো in-memory cache নেই, এবং সেটি ইচ্ছাকৃত ───────────────────────────
 * `credit-resolver.ts` ও `openrouter-service.ts` থেকে cache সরানো হয়েছিল
 * কারণটি এখানেও হুবহু খাটে: Next.js App Router-এ প্রতিটি route handler-এর
 * **আলাদা module instance** থাকে, তাই admin-এর সেভ একটা bundle-এ cache মুছলেও
 * `/pricing` সার্ভ করা অন্য bundle পুরনো দাম নিয়েই বসে থাকত — অর্থাৎ admin
 * দাম বদলাতেন, আর পর্দায় পুরনো সংখ্যা দেখাত। একটি indexed `findUnique` সস্তা;
 * ভুল দাম দেখানোর চেয়ে অনেক সস্তা।
 */

/** `PlatformSetting`-এ যেই key-তে পুরো প্রাইসিং বিন্যাস থাকে। */
export const PRICING_CATALOGUE_KEY = "pricing_catalogue";

/**
 * পাবলিক পড়া — **কখনো throw করে না**।
 *
 * ⚠️ admin-এর পাঠের (`readPricingCatalogueForAdmin`) সাথে এই অসমতাটি ইচ্ছাকৃত,
 *    এবং কারণটি দিক-নির্ভর:
 *      • এখানে (public `/pricing`, checkout) ব্যর্থতার নিরাপদ দিক হলো **কোডের
 *        ডিফল্ট দাম** দেখানো — merchant কিছু দেখতে পান, আর ডিফল্টগুলো সত্যিকারের
 *        প্রকাশিত দাম। একটি খালি pricing পেজ কোনো পণ্য নয়।
 *      • ওখানে (admin সম্পাদনা) নিরাপদ দিক হলো **৫০০** — কারণ ডিফল্ট ফেরত দিলে
 *        admin বুঝতেই পারতেন না যে তিনি DB-র নিয়ম নাকি পড়তে-ব্যর্থ হয়ে বানানো
 *        ডিফল্ট দেখছেন, আর Save চেপে আসল বিন্যাসটি ডিফল্ট দিয়ে চাপা দিতেন।
 *        `app/api/admin/ai-settings/route.ts`-এ ঠিক এই কারণেই ৫০০ বসানো আছে।
 */
export async function getPricingCatalogue(): Promise<PricingCatalogue> {
  try {
    return await readPricingCatalogueForAdmin();
  } catch (error) {
    console.error("[PRICING_CATALOGUE_READ]", error);
    return normalizeCatalogue(null);
  }
}

/**
 * কাঁচা বিন্যাস পড়ে normalize করে — **ব্যর্থ হলে throw**।
 *
 * admin API এই ফাংশনটিই ডাকে, যাতে একটি পড়ার ব্যর্থতা ৫০০ হয়ে ফেরে এবং
 * কেউ চুপচাপ ডিফল্ট দিয়ে আসল দামগুলো মুছে না ফেলেন।
 */
export async function readPricingCatalogueForAdmin(): Promise<PricingCatalogue> {
  // `(db as any).platformSetting` — `ai-settings` route-এর মতোই: একটি পুরনো
  // Prisma client চললে এই property না-ও থাকতে পারে, আর সেটি এখানে throw-যোগ্য
  // অবস্থা (উপরের নীতি অনুযায়ী)।
  const platformSetting = (db as any).platformSetting;
  if (!platformSetting) {
    throw new Error("The platformSetting model is not available on this client");
  }

  const setting = await platformSetting.findUnique({
    where: { key: PRICING_CATALOGUE_KEY },
    select: { value: true },
  });

  // row নেই = কিছুই override করা হয়নি — খালি catalogue, অর্থাৎ কোডের ডিফল্ট।
  // এটি একটি ভুল নয়, এটি ডিফল্ট অবস্থা।
  return normalizeCatalogue(setting?.value ?? null);
}

/**
 * কাঁচা মান লিখে normalize করা মান ফেরত দেয়।
 *
 * ⚠️ যা সংরক্ষিত হয় তা **normalize করা মান**, admin যা পাঠিয়েছেন তা নয়। ফলে
 *    DB-তে কখনো `monthly: 0` বা `percentOff: 1500` পড়ে থাকতে পারে না — অর্থাৎ
 *    একটি বেঠিক অনুরোধ একটি চিরস্থায়ী বেঠিক অবস্থা বানাতে পারে না।
 */
export async function savePricingCatalogue(value: unknown): Promise<PricingCatalogue> {
  const normalised = normalizeCatalogue(value);

  const platformSetting = (db as any).platformSetting;
  if (!platformSetting) {
    throw new Error("The platformSetting model is not available on this client");
  }

  await platformSetting.upsert({
    where: { key: PRICING_CATALOGUE_KEY },
    update: { value: normalised as unknown as object },
    create: {
      key: PRICING_CATALOGUE_KEY,
      value: normalised as unknown as object,
    },
  });

  return normalised;
}

/**
 * একটি কুপন কতবার **সত্যিই** ব্যবহার হয়েছে।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ এই ফাংশনটিই কুপনের `redeemedCount` ক্ষেত্রটির অনুপস্থিতির কারণ ব্যাখ্যা করে।
 *
 * বিন্যাসটি একটি JSON blob-এ থাকায় administration-এর দিকটি সহজ, কিন্তু কুপন
 * ব্যবহারের **গোনা** যদি ওই blob-এই লেখা হত, তবে দুটি tab একসাথে
 * read-modify-write করে সংখ্যাটি হারাত (lost update) — অর্থাৎ একটি
 * "একবারই ব্যবহারযোগ্য" কুপন দুইবার খাটত, আর কেউ টের পেত না।
 *
 * তাই ব্যবহারের একমাত্র দলিল **অর্থের লেজার**: টাকা সত্যিই কাটা পড়েছে এমন
 * transaction-এ `metadata.couponCode` কতবার আছে। `hasPaidForPlan`
 * (`lib/domain/trial.ts`) ঠিক একই কারণে আলাদা flag রাখে না — payment row গোনে।
 *
 * ⚠️ এখানে `paymentStatus` ফিল্টারটি বাদ দেওয়া যাবে না: শুধু `initiated` হয়ে
 *    পড়ে থাকা একটি checkout একটি ব্যবহার **নয়**। না দিলে যে merchant কুপন নিয়ে
 *    চেকআউট খুলে টাকা না দিয়ে চলে যান, তিনি নিজের সীমাটি খেয়ে ফেলতেন।
 */
export async function countCouponRedemptions(code: string): Promise<number> {
  const wanted = String(code ?? "").trim().toUpperCase();
  if (!wanted) return 0;

  return db.paymentTransaction.count({
    where: {
      paymentStatus: { in: PAID_STATUSES },
      metadata: { path: ["couponCode"], equals: wanted },
    },
  });
}
