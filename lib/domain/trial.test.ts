import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Test doubles ──────────────────────────────────────────────────────────────
//
// Two imports are replaced, and neither substitution weakens a test:
//
//   - `server-only` throws on import outside a Server Component by design, and
//     nothing here renders — the same stub `credit-plan.test.ts` uses.
//   - `@/lib/core/db` is stubbed so the *write* can be inspected. What matters
//     about `startTrialIfEligible` is not that Prisma stores a row; it is
//     exactly which fields it sets, what guard it claims under, and — just as
//     much — that it writes NOTHING on a refusal. Only the arguments show that.
//
// Everything else in `trial.ts` (the plan catalogue, the region config) is the
// real thing, because the whole point of these tests is that the rules come
// from there and not from a second copy.

vi.mock("server-only", () => ({}));

const { findUnique, updateMany, findMany, count, groupBy } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  groupBy: vi.fn(),
}));

vi.mock("@/lib/core/db", () => ({
  db: {
    user: { findUnique, updateMany, findMany },
    paymentTransaction: { count, groupBy },
  },
}));

import { PAID_STATUSES } from "./payment-status";
import {
  computeTrialEnd,
  hasPaidForPlan,
  listExpiredUnpaidTrials,
  startTrialIfEligible,
  trialDaysFor,
} from "./trial";

/** ১৫.৬-এর সিদ্ধান্ত: trial-এর ঘড়ি `planExpiresAt`-ই — তাই সময় স্থির করা হয়। */
const NOW = new Date(2026, 9, 15, 10, 0, 0); // 15 Oct 2026, local

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  findUnique.mockReset();
  updateMany.mockReset();
  findMany.mockReset();
  count.mockReset();
  groupBy.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

/** একটি user সারি, যাকে test-ভেদে বদলানো যায়। */
function user(overrides: Partial<{ plan: string; region: string }> = {}) {
  return { plan: "starter", region: "bd", ...overrides };
}

describe("trialDaysFor", () => {
  it("reads the length off the catalogue — 3 days in BD, 14 in Global", () => {
    // `trialDays` ক্যাটালগে ১৫.৬-এর আগেও লেখা ছিল, কেবল কেউ পড়ত না। সংখ্যাটি
    // নিজে মূল বিষয় নয়, গুরুত্বপূর্ণ হলো সেটি ক্যাটালগ থেকেই আসে — দুই region-এ
    // দুই মান হওয়াটাই তার প্রমাণ।
    expect(trialDaysFor("starter", "bd")).toBe(3);
    expect(trialDaysFor("starter", "global")).toBe(14);
  });

  it("has no trial on a plan nobody starts on", () => {
    // Business/Enterprise-এর `trialDays` ক্যাটালগে নেই — ওদের বিক্রি হয়
    // আপগ্রেডে, আর নতুন user কখনো ওই plan-এ জন্মায় না (`plan` ডিফল্ট starter)।
    expect(trialDaysFor("business", "bd")).toBeNull();
    expect(trialDaysFor("enterprise", "bd")).toBeNull();
    expect(trialDaysFor("enterprise", "global")).toBeNull();
  });

  it("gives an unknown key no trial rather than a default one", () => {
    // ⚠️ দিকটি `trialDaysFor`-এর জন্য ইচ্ছাকৃতভাবে **fail-closed**, অথচ
    //    `isResetEligible`-এ fail-open। কারণটি অসমান: এখানে ভুল হলে কেউ বিনা
    //    টাকায় allowance পায়; ওখানে ভুল হলে একজন পরিশোধকারী নবায়ন হারান।
    for (const plan of ["growth", "pro", "platinum", "", "STARTERX"]) {
      expect(trialDaysFor(plan, "bd"), plan).toBeNull();
    }
  });
});

describe("computeTrialEnd", () => {
  it("adds whole days and leaves the time of day alone", () => {
    const now = new Date(2026, 9, 15, 10, 0, 0);
    const end = computeTrialEnd(now, 3);

    expect(end.getTime()).toBe(new Date(2026, 9, 18, 10, 0, 0).getTime());
  });

  it("does not mutate the date it was given", () => {
    // `now.setDate(...)` লিখলে caller-এর `now` চুপচাপ বদলে যেত — আর ওই `now`
    // একই routine-এ `creditsResetDate`-ও হতে পারে।
    const now = new Date(2026, 9, 15, 10, 0, 0);
    const before = now.getTime();

    computeTrialEnd(now, 14);

    expect(now.getTime()).toBe(before);
  });

  it("rolls over month and year boundaries, which is why it is not `+n*86400s`", () => {
    // ⚠️ `now + days * 86_400_000` একটি ভিন্ন ফাংশন: DST-হীন timezone-এ দুইটিই
    //    একই উত্তর দেয়, কিন্তু যে timezone-এ ঘড়ি এগোয়/পিছোয় সেখানে
    //    "৩ দিন পরে" মানে ৭২ ঘণ্টা নাও হতে পারে — আর trial-এর মেয়াদ ক্যালেন্ডারে
    //    বোঝা হয়, মিলিসেকেন্ডে নয়।
    expect(computeTrialEnd(new Date(2026, 0, 31, 10, 0, 0), 1).getTime()).toBe(
      new Date(2026, 1, 1, 10, 0, 0).getTime()
    );
    expect(computeTrialEnd(new Date(2026, 1, 28, 10, 0, 0), 14).getTime()).toBe(
      new Date(2026, 2, 14, 10, 0, 0).getTime()
    );
    expect(computeTrialEnd(new Date(2026, 11, 31, 10, 0, 0), 3).getTime()).toBe(
      new Date(2027, 0, 3, 10, 0, 0).getTime()
    );
  });
});

describe("startTrialIfEligible — refusals write nothing", () => {
  /** প্রতিটি refusal-এর পর একটাই শর্ত: ডেটাবেসে কোনো লেখা হয়নি। */
  function expectNoWrite() {
    expect(updateMany).not.toHaveBeenCalled();
  }

  it("refuses a user that does not exist", async () => {
    findUnique.mockResolvedValue(null);

    expect(await startTrialIfEligible("u1", "facebook")).toEqual({
      started: false,
      reason: "user_not_found",
    });
    expectNoWrite();
  });

  it("refuses in Global, where there is no gateway to convert with", async () => {
    // ⚠️ Global Starter-এর দামই $০, আর `paymentGateway: null`। Trial-এর একমাত্র
    //    উদ্দেশ্য রূপান্তর — সেখানে টাকা নেওয়ার পথই নেই। মেয়াদ শেষে merchant-এর
    //    অবস্থা হত: bot paused, credit নেই, কেনার উপায় নেই। ওই পরিণতি trial না
    //    দেওয়ার চেয়েও খারাপ, তাই অঞ্চলটি বাদ।
    findUnique.mockResolvedValue(user({ region: "global" }));

    expect(await startTrialIfEligible("u1", "facebook")).toEqual({
      started: false,
      reason: "region_has_no_gateway",
    });
    expectNoWrite();
  });

  it("refuses a plan that has no trial length", async () => {
    findUnique.mockResolvedValue(user({ plan: "business" }));

    expect(await startTrialIfEligible("u1", "facebook")).toEqual({
      started: false,
      reason: "no_trial_for_plan",
    });
    expectNoWrite();
  });

  it("refuses a plan key this region does not sell", async () => {
    // BD-র `growth` ভূতটি এখানেও দরজা নাড়তে পারে; উত্তর না।
    findUnique.mockResolvedValue(user({ plan: "growth" }));

    expect(await startTrialIfEligible("u1", "facebook")).toEqual({
      started: false,
      reason: "no_trial_for_plan",
    });
    expectNoWrite();
  });

  it("refuses n8n_source, which is an ingest rail and not a channel", async () => {
    // "আসল channel connect না করিলে activate হয় না" — n8n_source-এর কোনো
    // গ্রাহকই নেই যাঁকে সেবা দেওয়া হচ্ছে, তাই শর্তটি পূরণ হয় না। ১৫.৩-এ
    // `canAddIntegration`-ও ঠিক এই যুক্তিতেই এটি ছাড় দিয়েছিল।
    findUnique.mockResolvedValue(user());

    expect(await startTrialIfEligible("u1", "n8n_source")).toEqual({
      started: false,
      reason: "not_a_channel",
    });
    expect(await startTrialIfEligible("u1", "  N8N_SOURCE  ")).toEqual({
      started: false,
      reason: "not_a_channel",
    });
    expect(await startTrialIfEligible("u1", "")).toEqual({
      started: false,
      reason: "not_a_channel",
    });
    expectNoWrite();
  });

  it("refuses a channel the plan does not include", async () => {
    // ⚠️ নিয়মটি plan-এর `allowedPlatforms` থেকেই আসে, এখানে নকল করা নয় — যে
    //    channel তিনি connect করতে পারছেন না, তার জন্য allowance চাওয়ার
    //    প্রশ্নই ওঠে না। BD Starter: facebook + website, WhatsApp নয়।
    findUnique.mockResolvedValue(user());

    expect(await startTrialIfEligible("u1", "whatsapp")).toEqual({
      started: false,
      reason: "platform_not_allowed",
    });
    expectNoWrite();
  });
});

describe("startTrialIfEligible — the grant", () => {
  beforeEach(() => {
    findUnique.mockResolvedValue(user());
    updateMany.mockResolvedValue({ count: 1 });
  });

  it("starts once, on a real channel connect", async () => {
    const result = await startTrialIfEligible("u1", "facebook");

    expect(result).toEqual({
      started: true,
      days: 3,
      endsAt: new Date(2026, 9, 18, 10, 0, 0),
    });
  });

  it("claims atomically, under the guard that makes it once per account", async () => {
    await startTrialIfEligible("u1", "facebook");

    // ⚠️ `planExpiresAt: null` — দুটি tab একসাথে connect করলে দুটোই শর্তটি পড়তে
    //    পারে; `updateMany`-এর `where`-এ রাখায় কেবল একজন জেতে। দুইবার বসলে
    //    ঘড়ি এবং allowance দুটোই দুইবার বসত।
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", planExpiresAt: null },
      data: {
        planExpiresAt: new Date(2026, 9, 18, 10, 0, 0),
        includedCredits: 15000,
        creditsBalance: 15000,
        creditsUsedThisCycle: 0,
        creditsResetDate: new Date(2026, 9, 18, 10, 0, 0),
      },
    });
  });

  it("sets the two clocks to the same instant", async () => {
    // `planExpiresAt` = "trial কত দিন", `creditsResetDate` = "পরের cycle কবে"।
    // দুটো আলাদা করলে ১৫.৯-এর `isResetEligible` দুবার জিজ্ঞেস করা হত, আর
    // ব্যবহারকারী মাঝপথে একটি allowance-ও পেতেন।
    await startTrialIfEligible("u1", "facebook");

    const { data } = updateMany.mock.calls[0][0];
    expect(data.creditsResetDate.getTime()).toBe(data.planExpiresAt.getTime());
  });

  it("gives the plan's own allowance, not the sign-up default", async () => {
    // `creditsBalance` ডিফল্ট ৫০০ (`prisma/schema/auth.prisma:17`), আর BD
    // Starter-এর allowance ১৫,০০০। এই লেখাটিই "allowance একবার, connect-এ"
    // নীতির প্রথম অর্ধেক; দ্বিতীয় অর্ধেক ১৫.৯ (`isResetEligible`)।
    findUnique.mockResolvedValue(user({ plan: "starter", region: "bd" }));
    await startTrialIfEligible("u1", "website");

    const { data } = updateMany.mock.calls[0][0];
    expect(data.includedCredits).toBe(15000);
    expect(data.creditsBalance).toBe(15000);
  });

  it("reports `already_used` when the claim loses, without a second write", async () => {
    // দ্বিতীয়বার connect করা = count 0। এটি কেবল "একবার" নয় — এটি "trial
    // শেষ হওয়ার পরেও আর কখনো" (কারণ `planExpiresAt` কখনো মুছে ফেলা হয় না)।
    updateMany.mockResolvedValue({ count: 0 });

    expect(await startTrialIfEligible("u1", "facebook")).toEqual({
      started: false,
      reason: "already_used",
    });
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});

describe("hasPaidForPlan", () => {
  it("answers from one definition of 'a live plan payment'", async () => {
    count.mockResolvedValue(1);
    expect(await hasPaidForPlan("u1")).toBe(true);

    count.mockResolvedValue(0);
    expect(await hasPaidForPlan("u1")).toBe(false);
  });

  it("counts only live purchases of a plan, never a top-up or a refund", async () => {
    count.mockResolvedValue(0);
    await hasPaidForPlan("u1");

    // ⚠️ তিনটি শর্তই অর্থবহ:
    //   - `PAID_STATUSES` — pending/failed একটি কেনাকাটা নয়
    //   - `kind` — top-up টাকা, কিন্তু plan কেনা নয়; allowance-এর দাবি ওঠে না
    //   - refund: `requested`/`approved` বাদ পড়ে না (টাকা এখনো আমাদের কাছে),
    //     আর **`null`-ও বাদ পড়ে না** — স্বাভাবিক payment-এ মানটাই NULL। তাই
    //     শর্তটি `OR`, একা `{ not: "refunded" }` নয় (কারণ `trial.ts`-এ লেখা:
    //     nullable কলামে SQL-এর তিন-মান-যুক্তি প্রমাণ-নিরপেক্ষ নয়, আর ভুল পড়ায়
    //     একজন পরিশোধকারীর chatbot বন্ধ হয়ে যেত)।
    expect(count).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        paymentStatus: { in: PAID_STATUSES },
        kind: { in: ["plan", "invoice_plan"] },
        OR: [{ refundStatus: null }, { refundStatus: { not: "refunded" } }],
      },
    });
  });
});

describe("listExpiredUnpaidTrials", () => {
  it("skips a merchant who has since paid for a plan", async () => {
    // ⚠️ এটিই trial-expiry-এর আসল শর্ত। কেবল `planExpiresAt <= now` দেখলে
    //    যিনি টাকা দিয়ে নতুন মেয়াদ পেয়েছেন তিনিও ধরায় পড়তেন — অর্থাৎ মেয়াদ
    //    শেষের শাস্তি তাঁকে দেওয়া হত, যিনি ঠিক সেই পরিণতি টাকা দিয়ে এড়িয়েছেন।
    findMany.mockResolvedValue([
      { userId: "payer", planExpiresAt: new Date(2026, 9, 1) },
      { userId: "lapsed", planExpiresAt: new Date(2026, 9, 10) },
    ]);
    groupBy.mockResolvedValue([{ userId: "payer" }]);

    expect(await listExpiredUnpaidTrials()).toEqual([
      { userId: "lapsed", planExpiresAt: new Date(2026, 9, 10) },
    ]);
  });

  it("asks for the payment proof in one query, not one per candidate", async () => {
    // `groupBy`… একটি round-trip-এ পুরো সেট — N+1 নয়।
    findMany.mockResolvedValue([{ userId: "a", planExpiresAt: NOW }]);
    groupBy.mockResolvedValue([]);

    await listExpiredUnpaidTrials();

    expect(groupBy).toHaveBeenCalledTimes(1);
    expect(groupBy).toHaveBeenCalledWith({
      by: ["userId"],
      where: {
        userId: { in: ["a"] },
        paymentStatus: { in: PAID_STATUSES },
        kind: { in: ["plan", "invoice_plan"] },
        OR: [{ refundStatus: null }, { refundStatus: { not: "refunded" } }],
      },
    });
  });

  it("does not query payments at all when no trial has lapsed", async () => {
    findMany.mockResolvedValue([]);

    expect(await listExpiredUnpaidTrials()).toEqual([]);
    expect(groupBy).not.toHaveBeenCalled();
  });
});
