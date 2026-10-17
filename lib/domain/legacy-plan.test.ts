import { describe, expect, it } from "vitest";

import {
  PLAN_KEYS,
  getPlanIfDefined,
  getPlansForRegion,
  resolveLegacyPlanKey,
  resolvePlanKeyForRegion,
} from "./plan-config";
import type { Region } from "@/lib/core/region";

/**
 * Retired plan names → a plan this region actually sells (১৫.৪).
 *
 * ── কেন এই ফাইলটি আলাদা ───────────────────────────────────────────────────────
 * `growth` নামটি দুই region-এ দুই জিনিস বোঝায়, আর ঠিক সেই দ্বৈত অর্থই একটি বাগের
 * জন্ম দিয়েছিল: `admin-credits.ts`-এ একটি region-নিরপেক্ষ `VALID_PLAN_KEYS`
 * তালিকা `growth`-কে **বৈধ** বলত, ফলে BD merchant-এর `User.plan` হয়ে যেত
 * `growth` — অথচ BD ক্যাটালগে ওটি নেই, তাই `getPlan("bd","growth")` চুপচাপ
 * **starter** ফেরত দিত। পর্দায় "GROWTH", নিয়মে Starter: ৫০,০০০ credit-এর
 * বদলে ১৫,০০০, আর WhatsApp বন্ধ।
 *
 * তাই এখানে সবচেয়ে গুরুত্বপূর্ণ assertion কেবল "কী ফেরে" নয় — "কী ফেরে
 * **না**": BD-তে `growth` কোনোদিনই একটি উত্তর হতে পারবে না। নিচের invariant
 * টেস্টটি ঠিক সেটাই পাহারা দেয়, region × legacy key-এর গোটা ম্যাট্রিক্স জুড়ে।
 */

const REGIONS: Region[] = ["bd", "global"];

describe("resolveLegacyPlanKey", () => {
  it("maps BD's retired ৳999 growth to business, not to itself", () => {
    // ⚠️ ৳৯৯৯ দিয়ে কেনা নামটি BD-তে আর নেই। Business-এ না নামালে তাঁর
    //    WhatsApp/Instagram বন্ধ হয়ে যেত — অর্থাৎ যে টাকা দিয়েছেন তাঁর চ্যানেল
    //    ভাঙত। Global-এ উল্টো: `growth` আজও একটি **সত্যিকারের** plan ($২৯)।
    expect(resolveLegacyPlanKey("bd", "growth")).toBe("business");
    expect(resolveLegacyPlanKey("global", "growth")).toBe("growth");
  });

  it("maps pro to the tier its price belongs to, per region", () => {
    // `pro` ছিল $২৯ / ৳২,৯০০। Global-এ $২৯ আজও Growth-এর দাম, আর BD-তে
    // ৳২,৯০০ Business-এর (৳২,৪৯৯) সবচেয়ে কাছে।
    expect(resolveLegacyPlanKey("bd", "pro")).toBe("business");
    expect(resolveLegacyPlanKey("global", "pro")).toBe("growth");
  });

  it("maps agency — Enterprise's old name — to Enterprise in both regions", () => {
    expect(resolveLegacyPlanKey("bd", "agency")).toBe("enterprise");
    expect(resolveLegacyPlanKey("global", "agency")).toBe("enterprise");
  });

  it("normalises casing and padding, like every other key lookup here", () => {
    // `User.plan` একটি free-text কলাম — " Growth " সত্যিই ঘটে।
    for (const raw of ["Growth", " GROWTH ", "growth"]) {
      expect(resolveLegacyPlanKey("bd", raw)).toBe("business");
    }
  });

  it("does not invent a replacement for a name that never was a plan", () => {
    // ⚠️ এটিই `/api/plan-revenue`-এর `platinum` টেস্টের আয়না। ভুল নামের জন্য
    //    কিছু বানানো মানে বাগটি লুকিয়ে ফেলা।
    for (const key of ["platinum", "free", "premium", "starter", "business"]) {
      expect(resolveLegacyPlanKey("bd", key)).toBeNull();
      expect(resolveLegacyPlanKey("global", key)).toBeNull();
    }
  });

  it("returns null for an empty name rather than defaulting to a plan", () => {
    // খালি মান মানে plan-এর অনুপস্থিতি, অজানা plan নয় — `isPaidPlan`-এর মতোই।
    expect(resolveLegacyPlanKey("bd", "")).toBeNull();
    expect(resolveLegacyPlanKey("bd", "   ")).toBeNull();
    expect(resolveLegacyPlanKey("bd", undefined as unknown as string)).toBeNull();
  });
});

describe("resolvePlanKeyForRegion", () => {
  it("leaves a plan this region sells exactly where it is", () => {
    expect(resolvePlanKeyForRegion("bd", "starter")).toBe("starter");
    expect(resolvePlanKeyForRegion("bd", "business")).toBe("business");
    expect(resolvePlanKeyForRegion("bd", "enterprise")).toBe("enterprise");
    expect(resolvePlanKeyForRegion("global", "growth")).toBe("growth");
  });

  it("resolves a retired name through to a plan that exists here", () => {
    expect(resolvePlanKeyForRegion("bd", "growth")).toBe("business");
    expect(resolvePlanKeyForRegion("bd", "pro")).toBe("business");
    expect(resolvePlanKeyForRegion("bd", "agency")).toBe("enterprise");
  });

  it("🔴 never answers with a key the region does not sell", () => {
    // ⚠️ **এই round-এর মূল tripwire।** বাগটি ছিল না-জানা-কিছু-ফেরানো নয় —
    //    বাগটি ছিল একটি *ভুল* উত্তর: BD-তে `growth`। তাই "ফলাফল ⟹ এই region-এ
    //    ফলাফলটির একটি plan আছে" শর্তটি গোটা ম্যাট্রিক্সে প্রমাণ করা হয়, দুইটা
    //    উদাহরণে নয়।
    const inputs = [...PLAN_KEYS, "growth", "pro", "agency", "platinum", "", "FREE"];

    for (const region of REGIONS) {
      for (const input of inputs) {
        const resolved = resolvePlanKeyForRegion(region, input);

        if (resolved === null) continue; // "পাওয়া যায়নি" সবসময় অনুমোদিত

        expect(
          getPlanIfDefined(region, resolved),
          `${region}/${input} → ${resolved}`
        ).not.toBeNull();
        expect(PLAN_KEYS as readonly string[]).toContain(resolved);
      }
    }
  });

  it("🔴 never lets BD reach `growth`, which is what the silent fallback hid", () => {
    // সরাসরি, নাম ধরে: এই দুই input-এ `getPlan("bd", …)` একটি ভুয়া উত্তর দিত।
    expect(resolvePlanKeyForRegion("bd", "growth")).not.toBe("growth");
    expect(resolvePlanKeyForRegion("bd", "pro")).not.toBe("growth");
  });

  it("hands an unrecognised name back as null, so the caller decides", () => {
    // grant path-এ fail-open (টাকা তো কেটেই গেছে), আর checkout-এ fail-closed —
    // সিদ্ধান্তটি caller-এর, তাই এখানে থামা জরুরি।
    expect(resolvePlanKeyForRegion("bd", "platinum")).toBeNull();
    expect(resolvePlanKeyForRegion("global", "pro_max")).toBeNull();
    expect(resolvePlanKeyForRegion("bd", "")).toBeNull();
    expect(resolvePlanKeyForRegion("bd", undefined as unknown as string)).toBeNull();
  });

  it("resolves every plan the catalogue itself advertises", () => {
    // একমুখী রাস্তা নয়: যা বিক্রি হয়, তার প্রতিটি key-ও নিজের region-এ স্থির।
    for (const region of REGIONS) {
      for (const plan of getPlansForRegion(region)) {
        expect(resolvePlanKeyForRegion(region, plan.key)).toBe(plan.key);
      }
    }
  });
});
