import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { isResetEligible, type ResetEligibilityInput } from "./reset-eligibility";

/**
 * Reset eligibility — ৳৯০,০০০/মাস leak-এর ঢাকনা (১৫.৯).
 *
 * ── যে বাগটি এই ফাইল আটকায় ───────────────────────────────────────────────────
 * `reset-credits` cron **একটি payment-ও দেখত না**; একমাত্র শর্ত ছিল
 * `creditsResetDate <= now`, আর নতুন user-এর ডিফল্টই `now()`
 * (`prisma/schema/auth.prisma:20`)। অর্থাৎ sign-up করে একটি channel connect করা
 * মাত্রই — এক টাকাও না দিয়ে — BD Starter-এর ১৫,০০০ credit প্রতি ৩০ দিনে,
 * চিরকাল। derivation-এ (১৫.২) ১৫,০০০ credit ≈ ৳৯০০ খরচ, তাই ১০০ non-converting
 * trial = মাসে ৳৯০,০০০।
 *
 * ── নিয়মটি কেন "ever-paid", "এই মাসে paid" নয় ───────────────────────────────
 * এই প্ল্যাটফর্মে **recurring billing নেই** — প্রতিটি plan কেনাকাটা এক-বারের
 * `PaymentTransaction`, আর নবায়নের কোনো রেল নেই। তাই ৩০-দিনের উইন্ডো দিলে
 * প্রথম মাসের পর **প্রতিটি পরিশোধকারী merchant** skip হয়ে যেতেন: ছিদ্র বন্ধ
 * করতে গিয়ে প্রোডাক্টটাই ভাঙত।
 */

/** একটি নির্দিষ্ট দিনের দুপুর — তারিখ-সীমার হিসাব যেন পড়ার মতো থাকে। */
function date(y: number, m: number, d: number): Date {
  return new Date(y, m, d, 12, 0, 0, 0);
}

const NOW = date(2026, 9, 15); // ২০২৬-১০-১৫
const YESTERDAY = date(2026, 9, 14);
const TOMORROW = date(2026, 9, 16);

/** ছোট helper — test-এর প্রতিটি লাইন যেন একটাই সিদ্ধান্ত বলে। */
function decide(overrides: Partial<ResetEligibilityInput>): {
  eligible: boolean;
  reason: string;
} {
  return isResetEligible({
    plan: "starter",
    region: "bd",
    hasPaidPlanPayment: false,
    hasRefundedPayment: false,
    // ⚠️ ডিফল্ট `null` — অর্থাৎ **মেয়াদ নেই**, যা প্রতিটি নতুন user-এর সত্যিকারের
    //    অবস্থা (schema-তে `planExpiresAt`-এর কোনো default নেই)। ফলে ১৫.৯-এর
    //    প্রতিটি পুরনো test আগের মতোই অর্থ রাখে, আর মেয়াদ-সংক্রান্ত কেসগুলো
    //    স্পষ্টভাবে নিজের তারিখ বসায়।
    planExpiresAt: null,
    now: NOW,
    ...overrides,
  });
}

describe("isResetEligible — the leak itself", () => {
  it("🔴 refuses the exact scenario the cron used to pay out on", () => {
    // নতুন user, BD, কোনো payment নেই, কোনো refund নেই — i.e. আজকের ডিফল্ট
    // অবস্থা যা থেকে ১৫,০০০ credit প্রতি মাসে জন্মাত।
    expect(decide({ plan: "starter", region: "bd" })).toEqual({
      eligible: false,
      reason: "never_paid",
    });
  });

  it("refuses the paid tiers too — an unpaid Business is not a Business", () => {
    for (const plan of ["business", "enterprise"]) {
      expect(decide({ plan, region: "bd" }).eligible, plan).toBe(false);
    }
  });

  it("grants to whoever ever paid, whatever plan they are on now", () => {
    // plan key ইচ্ছাকৃতভাবে এলোমেলো: যোগ্যতা আসে ledger থেকে, `User.plan` থেকে নয়।
    for (const plan of ["starter", "business", "growth", "platinum"]) {
      expect(decide({ plan, region: "bd", hasPaidPlanPayment: true }), plan).toEqual({
        eligible: true,
        reason: "ever_paid",
      });
    }
  });
});

describe("isResetEligible — refunds", () => {
  it("refuses a user whose only payment came back to them", () => {
    // টাকা আমাদের কাছে নেই, তাই মাসিক allowance-ও নেই।
    expect(decide({ plan: "business", region: "bd", hasRefundedPayment: true })).toEqual({
      eligible: false,
      reason: "refunded",
    });
  });

  it("grants to a re-payer, and checks the live payment first", () => {
    // ⚠️ **ক্রমটাই নিয়ম।** যিনি টাকা দিয়ে refund নিয়ে আবার টাকা দিয়েছেন, তিনি
    //    একজন পরিশোধকারী। দুটি ধাপ উল্টো হলে ঠিক এই মানুষটিই বাদ পড়তেন —
    //    এবং তিনিই সবচেয়ে কম বাদ-পড়ার যোগ্য।
    expect(
      decide({
        plan: "business",
        region: "bd",
        hasPaidPlanPayment: true,
        hasRefundedPayment: true,
      })
    ).toEqual({ eligible: true, reason: "ever_paid" });
  });
});

describe("isResetEligible — free and unknown plans (fail-safe)", () => {
  it("renews Global's genuinely free Starter", () => {
    // ⚠️ এটি **আবশ্যক**, ঐচ্ছিক নয়: Global Starter-এর দামই $০, আর Global-এ
    //    gateway-ই নেই। "টাকা দেননি" বলে আটকালে ওই free tier চিরকাল ৫০০
    //    credit-এ আটকে যেত, নবায়নের কোনো পথ ছাড়াই।
    expect(decide({ plan: "starter", region: "global" })).toEqual({
      eligible: true,
      reason: "free_plan",
    });
  });

  it("renews a retired key rather than cutting a payer off", () => {
    // `growth`/`pro` BD ক্যাটালগে নেই, কিন্তু এগুলো ছিল **প্রকৃত পেইড plan** —
    // `isPaidPlan`-এর মতো একই দিক। ধরা না পড়লে একজন পরিশোধকারী হারিয়ে যেতেন।
    expect(decide({ plan: "growth", region: "bd" })).toEqual({
      eligible: true,
      reason: "unknown_plan",
    });
    expect(decide({ plan: "pro", region: "bd" }).reason).toBe("unknown_plan");
  });

  it("refuses a negotiated tier that nobody has paid for", () => {
    // ⚠️ **এই ফাইলের দ্বিতীয় ফাঁদ।** `contact: true` plan-এর `price` ও ০,
    //    তাই `price === 0` শাখাটি আগে এলে একজন চুক্তিভিত্তিক Enterprise — যাঁকে
    //    admin invoice ছাড়া plan দিয়েছেন — প্রতি মাসে ১,৫০,০০০ credit পেতেন:
    //    একটিই অ্যাকাউন্টে ≈ ৳৯,০০০ মাসে, চিরকাল। "unknown ≠ 0" নীতি
    //    (`plan-revenue.ts`): দাম **জানা নেই**, শূন্য নয়।
    expect(decide({ plan: "enterprise", region: "bd" })).toEqual({
      eligible: false,
      reason: "negotiated_unpaid",
    });
    expect(decide({ plan: "enterprise", region: "global" }).reason).toBe(
      "negotiated_unpaid"
    );
  });

  it("still renews a negotiated tier that HAS paid", () => {
    // নেগোসিয়েটেড মানে "অযোগ্য" নয় — মানে "অযোগ্য যদি টাকা না আসে"।
    expect(decide({ plan: "enterprise", region: "bd", hasPaidPlanPayment: true }).eligible).toBe(
      true
    );
  });

  it("fails safe on an empty plan, a branch the schema makes unreachable", () => {
    // `User.plan` non-nullable with `@default("starter")`, তাই "" বাস্তবে ঘটে না।
    // ঘটলে fail-safe দিকেই পড়ে (renew) — কিন্তু সীমাটি জানা: রুট তখন
    // `getPlanCredits("", "bd")` → starter-এর ১৫,০০০ ধরে। খারাপ দিকটি
    // (একজন পেইং merchant-এর allowance বন্ধ) আরও খারাপ, তাই এই পছন্দ।
    expect(decide({ plan: "" }).reason).toBe("unknown_plan");
  });
});

describe("isResetEligible — মেয়াদ শেষ (১৫.৭)", () => {
  it("🔴 মেয়াদ পার হলে একজন পরিশোধকারীরও নবায়ন বন্ধ", () => {
    // ⚠️ **এই test-টিই ১৫.৭-এর পুরো কেন্দ্র।** ১৫.৯-এর ever-paid নিয়মে এই
    //    merchant প্রতি ৩০ দিনে ১৫,০০০ credit পেতেন **চিরকাল** — একবার ৳৯৯৯
    //    দিয়ে। ফলে credit কখনো সত্যিই শেষ হয় না, "বট বন্ধ হবে" নীতির কোনো
    //    দাঁত থাকে না, আর বার্ষিক plan-এর কোনো অর্থই থাকে না।
    expect(
      decide({
        plan: "starter",
        region: "bd",
        hasPaidPlanPayment: true,
        planExpiresAt: YESTERDAY,
        now: NOW,
      })
    ).toEqual({ eligible: false, reason: "plan_expired" });
  });

  it("মেয়াদ এখনো বাকি থাকলে নবায়ন হয়", () => {
    expect(
      decide({
        plan: "starter",
        region: "bd",
        hasPaidPlanPayment: true,
        planExpiresAt: TOMORROW,
        now: NOW,
      })
    ).toEqual({ eligible: true, reason: "ever_paid" });
  });

  it("মেয়াদ ঠিক এখন মুহূর্তে শেষ হলে নবায়ন বন্ধ (সীমাটি `<=`)", () => {
    // ⚠️ `>` হলে মেয়াদোত্তীর্ণ merchant আরও একটি পূর্ণ cycle পেতেন — অর্থাৎ
    //    নিয়মটি ঠিক সেই একজনকেই ছাড় দিত যাঁকে ধরতে লেখা হলো।
    expect(
      decide({
        plan: "starter",
        region: "bd",
        hasPaidPlanPayment: true,
        planExpiresAt: new Date(NOW),
        now: NOW,
      }).reason
    ).toBe("plan_expired");
  });

  it("`null` মেয়াদ মানে 'মেয়াদ নেই', 'শেষ' নয়", () => {
    // ⚠️ **এই শাখাটি বাদ দেওয়া সবচেয়ে বড় বিপর্যয় হত।** schema-তে
    //    `planExpiresAt`-এর কোনো default নেই, অর্থাৎ প্রতিটি নতুন user NULL।
    //    NULL-কে অতীত ধরে নিলে প্রতিটি বিদ্যমান পরিশোধকারী merchant সাথে সাথে
    //    অযোগ্য হয়ে যেতেন — অর্থাৎ ঠিক যা এই ফাইলটি আটকাতে জন্মেছিল।
    expect(
      decide({
        plan: "business",
        region: "bd",
        hasPaidPlanPayment: true,
        planExpiresAt: null,
        now: NOW,
      })
    ).toEqual({ eligible: true, reason: "ever_paid" });
  });

  it("ভাঙা তারিখকেও 'মেয়াদ নেই' ধরে, 'মেয়াদ শেষ' নয়", () => {
    // NaN-এর সাথে যেকোনো তুলনা false, তাই সেটি নিজে থেকেই নিরাপদ দিকে পড়ে —
    // কিন্তু সেটি স্পষ্টভাবে লেখা থাকুক, যাতে ভবিষ্যতে কেউ `!== null` কে
    // `!= null` করে বা তুলনার ক্রম বদলে এই সুরক্ষাটি না হারায়।
    expect(
      decide({
        plan: "starter",
        region: "bd",
        hasPaidPlanPayment: true,
        planExpiresAt: new Date(Number.NaN),
        now: NOW,
      }).eligible
    ).toBe(true);
  });

  it("🟢 Global-এর বিনামূল্যের plan মেয়াদোত্তীর্ণ হলেও নবায়ন পায়", () => {
    // ⚠️ **নিয়মটি এক বাক্যে: যে টাকা দেওয়া হয়েছে সেটিই শেষ হতে পারে — যেখানে
    //    টাকা নেই, সেখানে ফুরানোর কিছু নেই।** Global Starter-এর দামই $০, আর
    //    Global-এ gateway-ই নেই (নবায়নের আর কোনো পথ নেই)। admin একবার
    //    `setUserPlan` চালালে তার মেয়াদ বসে যেত, আর মেয়াদ শেষে ওই free tier
    //    চিরকাল ৫০০ credit-এ আটকে যেত — অথচ ধাপ ৪ ঠিক সেটি আটকাতেই লেখা।
    expect(
      decide({
        plan: "starter",
        region: "global",
        planExpiresAt: YESTERDAY,
        now: NOW,
      })
    ).toEqual({ eligible: true, reason: "free_plan" });
  });

  it("🟢 retired key-ও মেয়াদোত্তীর্ণ হলেও নবায়ন পায় (fail-safe)", () => {
    // legacy `growth`-এর cycle-ই আমরা জানি না — তাই ওর মেয়াদ নিয়ে সিদ্ধান্ত
    // নেওয়া মানে অজানার উপর ভিত্তি করে একজন পরিশোধকারীকে বন্ধ করা।
    expect(
      decide({
        plan: "growth",
        region: "bd",
        planExpiresAt: YESTERDAY,
        now: NOW,
      })
    ).toEqual({ eligible: true, reason: "unknown_plan" });
  });

  it("টাকা ফেরত গেছে + মেয়াদ শেষ — কারণটি `refunded`-ই থাকে", () => {
    // ⚠️ দুটোই অযোগ্য, কিন্তু কারণগুলো আলাদা রাখার পুরো উদ্দেশ্যই হলো admin
    //    যেন TASK-06-এর নীতিতে **কেন** কেউ বাদ পড়ল তা জানতে পারেন। "টাকা ফেরত
    //    গেছে" বেশি নির্দিষ্ট ও বেশি তদন্তযোগ্য — তাই সেটিই আগে।
    expect(
      decide({
        plan: "business",
        region: "bd",
        hasRefundedPayment: true,
        planExpiresAt: YESTERDAY,
        now: NOW,
      })
    ).toEqual({ eligible: false, reason: "refunded" });
  });
});

describe("reset-credits route tripwire", () => {
  /**
   * ⚠️ একটি pure ফাংশনের unit test এমন একটি route-কে ধরতে পারে না যেটি হঠাৎ
   *    তাকে **ডাকা বন্ধ** করে দিল। আর ঠিক সেটাই এখানে সবচেয়ে বিপজ্জনক
   *    রিগ্রেশন: নিয়মটি ফাইলে থাকবে, টেস্ট সব পাস করবে, আর cron আবার আগের
   *    মতোই সবাইকে দিতে থাকবে। তাই route-এর নিজের এক লাইন পড়ে নিশ্চিত করা হয়
   *    যে সিদ্ধান্তটি দরজার বাইরে নেওয়া হয়নি।
   *
   * (`plan-revenue.test.ts`-এর tripwire-এর আয়না — সেটি behaviour দিয়ে একটি
   * ডিলিট-করা টেবিলের ফেরা ধরে, এখানে behaviour দিয়ে ধরা অসম্ভব, কারণ
   * অনুপস্থিত একটি call-এর কোনো ফলাফলই নেই।)
   */
  const routeSource = readFileSync(
    fileURLToPath(new URL("../../app/api/cron/reset-credits/route.ts", import.meta.url)),
    "utf8"
  );

  it("decides eligibility through `isResetEligible`", () => {
    expect(routeSource).toContain("isResetEligible");
    expect(routeSource).toMatch(/isResetEligible\(\{/);
  });

  it("🔴 selects `planExpiresAt` — নইলে মেয়াদ-নিয়মটি নীরবে মরে যায়", () => {
    // ⚠️ **এই ফাইলটির সবচেয়ে মূল্যবান assertion।** `plan_expired` নিয়মটি
    //    `isResetEligible`-এ বসিয়ে দিলেই যথেষ্ট নয়: route যদি `planExpiresAt`
    //    **select না করে**, তবে প্রতিটি user `undefined` নিয়ে আসে, অর্থাৎ
    //    `null`-এর মতো আচরণ করে ("মেয়াদ নেই") — আর নিয়মটি কখনোই চলে না।
    //
    //    বিপদটি এই যে ফলটি **সঠিক দেখায়**: cron চলে, `granted` সংখ্যা ঠিক,
    //    কোনো error নেই — কেবল ছিদ্রটি খোলা রয়ে যায়। আর প্রোডাকশনে cron
    //    চলে না (TASK-22), তাই মানুষের চোখেও ধরা পড়ত না।
    const selectStart = routeSource.indexOf("select: {");
    const selectBlock = routeSource.slice(selectStart, routeSource.indexOf("});", selectStart));

    expect(selectBlock).toContain("planExpiresAt");
    // প্যারামিটার হিসেবেও পাঠানো হচ্ছে — select করা আর পাঠানো আলাদা দুটি কাজ
    expect(routeSource).toMatch(/planExpiresAt:\s*user\.planExpiresAt/);
  });

  it("never writes a balance outside the eligible branch", () => {
    // সবচেয়ে ছোট, সবচেয়ে শক্ত assertion: `granted++` ঠিক একবার, এবং সেটি
    // `continue` দিয়ে skip করার পরে — অর্থাৎ একটি skip কখনোই credit দেয় না।
    expect(routeSource.match(/granted\+\+/g)?.length).toBe(1);
    expect(routeSource).toContain("if (!eligible)");
  });

  it("keeps the balance untouched when it skips", () => {
    // skip শাখায় কেবল ঘড়িটাই বদলায় — ব্যালান্স শূন্য করা ধ্বংসাত্মক ও
    // অপ্রয়োজনীয় দুটোই (১৫.৬ paused bot দিয়েই সেবা বন্ধ করে)।
    //
    // ⚠️ সীমাটি **`continue;`-এ**, `granted++`-এ নয়। দুই শাখারই `db.user.update({`
    //    আছে, তাই `granted++` পর্যন্ত টুকরো নিলে তার ভেতরে *eligible* শাখার
    //    write-ও পড়ে যেত (`creditsBalance: newBalance`) — আর তাহলে assertionটি
    //    ঠিক সেই জিনিসটাই খুঁজে পেত যা সে খুঁজছে না বলে দাবি করছে। অর্থাৎ test
    //    পাস করত না, কিন্তু ভুল কারণে নয়: দাবিটাই ভুল টুকরোর উপর করা হত।
    const skipStart = routeSource.indexOf(
      "db.user.update({",
      routeSource.indexOf("if (!eligible)")
    );
    const skipBranch = routeSource.slice(skipStart, routeSource.indexOf("continue;", skipStart));
    expect(skipBranch).toContain("creditsResetDate");
    expect(skipBranch).not.toContain("creditsBalance");
  });
});
