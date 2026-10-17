"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { type Region, type RegionConfig, getRegionFromCookie, getRegionConfig } from "@/lib/core/region";
import { getPlansForRegion, type PlanConfig } from "@/lib/domain/plan-config";
import {
  DEFAULT_ANNUAL_DISCOUNT_PERCENT,
  applyCatalogue,
  normalizeCatalogue,
  resolveCheckoutAmount,
  resolveListPrice,
  resolveTopUpPrice,
  type BillingCycle,
  type CheckoutAmount,
  type PricingCatalogue,
  type ResolvedPrice,
} from "@/lib/domain/pricing-catalogue";

/**
 * Region + Pricing context (১৫.৭)
 * ─────────────────────────────────────────────────────────────────────────────
 * `RegionProvider` আগেই client context ছিল আর `app/layout.tsx` (server) থেকে
 * `initialRegion` পেত — ঠিক সেই ছাঁচেই এখন একটি `initialCatalogue` যোগ হলো,
 * যাতে **দামও** একইভাবে server-এ নির্ধারিত হয়ে client-এ পৌঁছায়।
 *
 * ── কেন props দিয়ে, একটি API fetch দিয়ে নয় ─────────────────────────────────
 * `/pricing` ও landing page-এর দাম SEO-র অংশ — একটি client-side fetch মানে
 * পর্দায় প্রথমে ডিফল্ট দাম, তারপর সঠিক দাম ("flash of wrong price"), আর
 * crawler একটি ভুল দাম দেখে সূচিবদ্ধ করত। props হলে HTML-এ সঠিক দামই থাকে।
 *
 * ── ⚠️ payload-এ দুই region-ই থাকে ─────────────────────────────────────────
 * region **client-এ বদলাতে পারে** (নিচের `useEffect` cookie পড়ে) — অথচ
 * catalogue-এর জন্য দ্বিতীয় কোনো অনুরোধ নেই। তাই দুই region-এর মান একসাথে
 * আসে, আর `region` বদলালে সাথে সাথে সঠিক দাম বসে। একটি region-ভিত্তিক payload
 * হলে region বদলের মুহূর্তে পুরনো দাম দেখাত।
 *
 * ── কুপন এখানে নেই ────────────────────────────────────────────────────────
 * server কেবল `toPublicCatalogue(...)` পাঠায়, অর্থাৎ কুপন ছাড়া। ছাড় প্রয়োগ
 * হয় server-এ; client শুধু একটি কোড পাঠায় (দেখুন `toPublicCatalogue`-এর মন্তব্য)।
 */

interface RegionContextValue {
  region: Region;
  config: RegionConfig;
}

interface PricingContextValue {
  /** এই region-এর plan-তালিকা, override বসানো ও hidden বাদ দেওয়া। */
  plans: PlanConfig[];
  /** এই region-এর সম্পূর্ণ plan-তালিকা, hidden-সহ (admin পর্দার জন্য)। */
  allPlans: PlanConfig[];
  /**
   * **যেকোনো** region-এর plan-তালিকা, override বসানো।
   *
   * ⚠️ কেন একটি ফাংশন, শুধু `plans` নয়: admin পর্দাগুলো (workspaces, invoice)
   *    একটি নির্দিষ্ট workspace-এর দাম দেখায় — **তার** region অনুযায়ী, admin
   *    নিজে যে region-এ বসে আছেন সেটি নয়। `plans` ব্যবহার করলে একজন BD admin
   *    একটি Global workspace-এর দাম ভুল করে ৳-তে দেখতেন।
   *
   * ⚠️ `includeHidden` ডিফল্ট `false` — একটি লুকানো plan সাধারণ দর্শকের জন্য
   *    নেই, অথচ admin-এর dropdown-এ থাকা দরকার (নইলে তিনি সেটি আর কখনো
   *    ফিরিয়ে আনতে পারতেন না — লুকানোটাই চিরস্থায়ী হয়ে যেত)।
   */
  plansForRegion: (region: Region, options?: { includeHidden?: boolean }) => PlanConfig[];
  catalogue: PricingCatalogue;
  /**
   * plan-এর প্রকাশিত দাম, cycle ও ভাষা অনুযায়ী।
   *
   * ⚠️ `lang` এখানে ঐচ্ছিক কিন্তু গুরুত্বপূর্ণ: বাংলায় "৳৯৯৯" আর ইংরেজিতে
   *    "৳999" — একই সংখ্যা, দুই আকার। তাই ভাষাটি caller-ই জানে (`i18n.language`),
   *    context নয়; context-এ রাখলে প্রতিটি ভাষা-পরিবর্তনে গোটা pricing tree
   *    re-render হত।
   */
  listPrice: (plan: PlanConfig, cycle?: BillingCycle, lang?: string) => ResolvedPrice;
  /** top-up pack-এর দাম — ক্যাটালগের ডিফল্ট বা admin-এর override। */
  topUpPrice: (packageId: string, defaultAmount: number) => number;
  /**
   * পর্দায় দেখানোর দাম — region-ব্যাপী ছাড় বসানো (`resolveCheckoutAmount`-এর
   * সরু মোড়ক, তাই দেখানো দাম আর চার্জের দাম একই হিসাব থেকে আসে)।
   */
  publicPrice: (listAmount: number, scope?: "plan" | "topup") => CheckoutAmount;
  /** এই region-এ সব merchant-এর জন্য ঘোষিত ছাড় (%)। */
  discountPercent: number;
  /** এই region-এ বার্ষিক ছাড় (%)। */
  annualDiscountPercent: number;
}

const RegionContext = createContext<RegionContextValue>({
  region: "bd",
  config: getRegionConfig("bd"),
});

/**
 * ⚠️ ডিফল্টটি **খালি catalogue**, অর্থাৎ কোডের ডিফল্ট দাম। ফলে provider-এর
 *    বাইরে কোনো component (`usePricing()` ডেকে) ভেঙে পড়ে না, আর ভেঙে পড়ার
 *    চেয়ে ডিফল্ট দাম দেখানো ভালো — ওগুলোই সত্যিকারের প্রকাশিত দাম।
 */
const EMPTY_CATALOGUE = normalizeCatalogue(null);

/** override-হীন ডিফল্ট আচরণ — provider-এর বাইরের নিরাপদ fallback। */
function plainPlansForRegion(
  region: Region,
  options?: { includeHidden?: boolean }
): PlanConfig[] {
  return applyCatalogue(getPlansForRegion(region), region, EMPTY_CATALOGUE, options);
}

const PricingContext = createContext<PricingContextValue>({
  plans: plainPlansForRegion("bd"),
  allPlans: getPlansForRegion("bd"),
  plansForRegion: plainPlansForRegion,
  catalogue: EMPTY_CATALOGUE,
  listPrice: (plan, cycle = "monthly", lang = "en") =>
    resolveListPrice(plan, "bd", cycle, EMPTY_CATALOGUE, lang),
  topUpPrice: (_packageId, defaultAmount) => defaultAmount,
  publicPrice: (listAmount, scope = "plan") =>
    resolveCheckoutAmount({
      listAmount,
      region: "bd",
      scope,
      catalogue: EMPTY_CATALOGUE,
      coupon: null,
    }),
  discountPercent: 0,
  annualDiscountPercent: DEFAULT_ANNUAL_DISCOUNT_PERCENT,
});

export function RegionProvider({
  children,
  initialRegion = "bd",
  initialCatalogue,
}: {
  children: React.ReactNode;
  initialRegion?: Region;
  /**
   * server-এ পড়া প্রাইসিং catalogue (`toPublicCatalogue` করা)।
   * না দিলে কোডের ডিফল্ট দাম — অর্থাৎ সাইট আগের মতোই চলে।
   */
  initialCatalogue?: PricingCatalogue;
}) {
  const [region, setRegion] = useState<Region>(initialRegion);

  useEffect(() => {
    setRegion(getRegionFromCookie());
  }, []);

  const config = getRegionConfig(region);

  // ⚠️ `useMemo` এখানে বাহুল্য নয়: contexto-র মান প্রতি render-এ নতুন object
  //    হলে প্রতিটি `usePricing()` গ্রাহক প্রতিবার re-render হত — আর দাম দেখানো
  //    component-গুলো (pricing page, top-up কার্ড) ঠিক সেইগুলোই যেগুলো বড়।
  const pricing = useMemo<PricingContextValue>(() => {
    const catalogue = initialCatalogue ?? EMPTY_CATALOGUE;
    const basePlans = getPlansForRegion(region);

    const plansForRegion = (
      target: Region,
      options?: { includeHidden?: boolean }
    ): PlanConfig[] =>
      // ⚠️ লুকানো বাদ দেওয়া/রাখার সিদ্ধান্তটি `applyCatalogue`-এ, এখানে নয়:
      //    "দাম বসাও" আর "কার কাছে দেখাও" একই ফাংশনে থাকলে admin পর্দায় একটি
      //    override-কে লুকানো অবস্থায় দেখা যেত — অর্থাৎ দাম বসানো আছে অথচ
      //    চোখে পড়ে না, যা একটি নীরব ফাঁদ।
      applyCatalogue(getPlansForRegion(target), target, catalogue, options);

    return {
      plans: plansForRegion(region),
      allPlans: basePlans,
      plansForRegion,
      catalogue,
      listPrice: (plan, cycle = "monthly", lang = "en") =>
        resolveListPrice(plan, region, cycle, catalogue, lang),
      topUpPrice: (packageId, defaultAmount) =>
        resolveTopUpPrice(packageId, defaultAmount, catalogue),
      publicPrice: (listAmount, scope = "plan") =>
        resolveCheckoutAmount({ listAmount, region, scope, catalogue, coupon: null }),
      discountPercent: catalogue.discountPercent[region] ?? 0,
      annualDiscountPercent:
        catalogue.annualDiscountPercent[region] ?? DEFAULT_ANNUAL_DISCOUNT_PERCENT,
    };
  }, [region, initialCatalogue]);

  return (
    <RegionContext.Provider value={{ region, config }}>
      <PricingContext.Provider value={pricing}>{children}</PricingContext.Provider>
    </RegionContext.Provider>
  );
}

export function useRegion() {
  return useContext(RegionContext);
}

/**
 * দাম-সংক্রান্ত প্রতিটি প্রশ্নের একমাত্র ঠিকানা।
 *
 * ⚠️ **বাইরের কোনো component আর `getPlansForRegion()` সরাসরি ডাকবে না।** কারণ
 *    সরাসরি ডাকলে সে **override-হীন** তালিকা পায় — অর্থাৎ admin একটি দাম বদলালে
 *    সেটি পর্দায় পৌঁছায়ই না। এই hook-ই override বসানো তালিকা দেয়।
 */
export function usePricing() {
  return useContext(PricingContext);
}
