import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  bdtPerCreditFrom,
  currentWhatsappCycleStart,
  FREE_MESSAGES_PER_CYCLE,
  whatsappSurchargeCredits,
} from "./whatsapp-cost";

/**
 * WhatsApp channel-এর খরচ — বিশুদ্ধ নিয়ম (১৫.৮)
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ এই ফাইলের সবচেয়ে বড় দাবি একটি: **কোনো ইনপুটই কখনো `NaN` বা `Infinity`
 *    credit বানাতে পারবে না।** কারণটি টাকার: একটা `NaN` credit ব্যালেন্সে
 *    ঢুকে গেলে `creditsBalance` বিষিয়ে যায়, আর তখন merchant-এর হয় সব credit
 *    চলে যায়, নয় সব reply আটকে যায় — দুটিই অনুৎপাদনযোগ্য।
 *
 * বাকি নিয়মগুলি সীমানার: ফ্রি tier-এর ঠিক কোথায় শেষ, আর কেন `ceil`।
 */

describe("whatsappSurchargeCredits — ফ্রি tier-এর সীমানা", () => {
  const base = { feePerMessageBdt: 0.54, bdtPerCredit: 999 / 15000 };

  it("১,০০০-এর ভেতরে কোনো credit নয়", () => {
    expect(whatsappSurchargeCredits({ ...base, messagesBeforeThisOne: 0 })).toBe(0);
    expect(whatsappSurchargeCredits({ ...base, messagesBeforeThisOne: 500 })).toBe(0);
    expect(whatsappSurchargeCredits({ ...base, messagesBeforeThisOne: 999 })).toBe(0);
  });

  it("🔴 সীমানাটি ঠিক ১,০০০-এ — এবং নামটি সেই কারণেই এত লম্বা", () => {
    // ⚠️ `messagesBeforeThisOne: 1000` মানে: এই বার্তার **আগে** ঠিক ১,০০০টি
    //    গেছে। অর্থাৎ এই বার্তাটি ১,০০১তম — বিল-যোগ্য।
    //
    //    এই assertion-টিই off-by-one-এর পাহারাদার। কেউ যদি "সুবিধার জন্য"
    //    `<=` করে দেয়, তাহলে প্রতিটি merchant একটি বাড়তি ফ্রি বার্তা পাবেন —
    //    এবং সেটি ধরা পড়বে এখানেই।
    expect(whatsappSurchargeCredits({ ...base, messagesBeforeThisOne: 1000 })).toBe(
      Math.ceil(0.54 / (999 / 15000))
    );
  });

  it("সীমানা নিজে থেকে বদলানো যায় (admin-নিয়ন্ত্রিত)", () => {
    expect(
      whatsappSurchargeCredits({ ...base, messagesBeforeThisOne: 5, freeMessages: 5 })
    ).toBeGreaterThan(0);
    expect(
      whatsappSurchargeCredits({ ...base, messagesBeforeThisOne: 4, freeMessages: 5 })
    ).toBe(0);
  });

  it("🔴 ঋণাত্মক freeMessages → ডিফল্টে ফেরা, শূন্যে চাপা নয়", () => {
    // ⚠️ শূন্যে চাপালে প্রতিটি merchant প্রথম বার্তা থেকেই চার্জ খেতেন — একটি
    //    ভাঙা config-এর দাম তাঁরা দিতেন। ডিফল্টে ফিরলে খরচ আমাদের ঘাড়ে, যা
    //    এই নকশার সচেতন পক্ষপাত (কম নেওয়া > বেশি নেওয়া)।
    expect(
      whatsappSurchargeCredits({ ...base, messagesBeforeThisOne: 0, freeMessages: -5 })
    ).toBe(0);
    expect(
      whatsappSurchargeCredits({ ...base, messagesBeforeThisOne: 999, freeMessages: -5 })
    ).toBe(0);
    expect(
      whatsappSurchargeCredits({ ...base, messagesBeforeThisOne: 1000, freeMessages: -5 })
    ).toBeGreaterThan(0);
  });

  it("`freeMessages = 0` বৈধ — সচেতনভাবে ফ্রি tier ছাড়া", () => {
    // ⚠️ শূন্য আর ঋণাত্মক আলাদা: শূন্য মানে admin ইচ্ছে করে ফ্রি tier তুলে
    //    দিয়েছেন, তাই প্রথম বার্তাটিই বিল-যোগ্য।
    expect(
      whatsappSurchargeCredits({ ...base, messagesBeforeThisOne: 0, freeMessages: 0 })
    ).toBeGreaterThan(0);
  });

  it("freeMessages না দিলে কোডের ধ্রুবকটিই চলে", () => {
    expect(FREE_MESSAGES_PER_CYCLE).toBe(1000);
    expect(whatsappSurchargeCredits({ ...base, messagesBeforeThisOne: 999 })).toBe(0);
    expect(whatsappSurchargeCredits({ ...base, messagesBeforeThisOne: 1000 })).toBeGreaterThan(0);
  });
});

describe("whatsappSurchargeCredits — কখন শূন্য (তিনটি kill-switch)", () => {
  it("🔴 ফি শূন্য = surcharge বন্ধ, এবং এটিই ডিফল্ট", () => {
    // ১৫.৮-এর সবচেয়ে গুরুত্বপূর্ণ সম্পত্তি: কোড deploy করা হয়েছে, অথচ কিছুই
    // কাটছে না। `0.54`-এর বদলে `0` বসালেই সেটি সত্যি হয়।
    expect(
      whatsappSurchargeCredits({
        messagesBeforeThisOne: 5000,
        feePerMessageBdt: 0,
        bdtPerCredit: 0.0666,
      })
    ).toBe(0);
  });

  it("🔴 bdtPerCredit শূন্য — `0 ÷ 0` কখনো credit হতে পারবে না", () => {
    // Global-এর free Starter-এর দাম ৳০, তাই এই ইনপুটটি সত্যিই আসে।
    // না থামলে: `0.54 / 0 = Infinity` → `Math.ceil(Infinity) = Infinity`,
    // আর ফি-ও শূন্য হলে `0 / 0 = NaN` → `Math.ceil(NaN) = NaN`।
    expect(
      whatsappSurchargeCredits({
        messagesBeforeThisOne: 5000,
        feePerMessageBdt: 0.54,
        bdtPerCredit: 0,
      })
    ).toBe(0);
    expect(
      whatsappSurchargeCredits({
        messagesBeforeThisOne: 5000,
        feePerMessageBdt: 0,
        bdtPerCredit: 0,
      })
    ).toBe(0);
  });

  it("🔴 যেকোনো NaN ইনপুটে ফল কখনোই NaN নয়", () => {
    const cases = [
      { messagesBeforeThisOne: NaN, feePerMessageBdt: 0.54, bdtPerCredit: 0.0666 },
      { messagesBeforeThisOne: 5000, feePerMessageBdt: NaN, bdtPerCredit: 0.0666 },
      { messagesBeforeThisOne: 5000, feePerMessageBdt: 0.54, bdtPerCredit: NaN },
      { messagesBeforeThisOne: Infinity, feePerMessageBdt: 0.54, bdtPerCredit: 0.0666 },
      { messagesBeforeThisOne: 5000, feePerMessageBdt: Infinity, bdtPerCredit: 0.0666 },
      { messagesBeforeThisOne: 5000, feePerMessageBdt: 0.54, bdtPerCredit: Infinity },
      { messagesBeforeThisOne: 5000, feePerMessageBdt: 0.54, bdtPerCredit: -1 },
      { messagesBeforeThisOne: 5000, feePerMessageBdt: -1, bdtPerCredit: 0.0666 },
    ];

    for (const c of cases) {
      const result = whatsappSurchargeCredits(c);
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  it("অগণিত `messagesBeforeThisOne` → শূন্য ধরে নেওয়া হয় (নিরাপদ দিক)", () => {
    // ⚠️ NaN-কে "সব বার্তা বিল-যোগ্য" ধরে নিলে merchant-কে ভুল চার্জ করা হত।
    //    শূন্য ধরে নিলে বরং ফ্রি tier প্রয়োগ হয় — ভুলটি আমাদের দিকে।
    expect(
      whatsappSurchargeCredits({
        messagesBeforeThisOne: NaN,
        feePerMessageBdt: 0.54,
        bdtPerCredit: 0.0666,
      })
    ).toBe(0);
  });
});

describe("whatsappSurchargeCredits — গোল করা হয় উপরে", () => {
  it("এক credit-এর চেয়ে কম খরচও ১ credit (কখনো ০ নয়)", () => {
    // ⚠️ `round` হলে `0.1 / 1 = 0.1` → ০ credit, অর্থাৎ Meta-র খরচ সম্পূর্ণ
    //    আমাদের ঘাড়ে। আর এখানে হিসাবটি টাকার, তাই ছোট দিকে গোল করা জমে ঘাটতি
    //    তৈরি করত।
    expect(
      whatsappSurchargeCredits({
        messagesBeforeThisOne: 2000,
        feePerMessageBdt: 0.1,
        bdtPerCredit: 1,
      })
    ).toBe(1);
  });

  it("BD Starter-এর বাস্তব হিসাব — ≈ ৯ credit", () => {
    // ৳৯৯৯ ÷ ১৫,০০০ = ৳০.০৬৬৬ প্রতি credit, ফি ৳০.৫৪
    expect(
      whatsappSurchargeCredits({
        messagesBeforeThisOne: 1001,
        feePerMessageBdt: 0.54,
        bdtPerCredit: 999 / 15000,
      })
    ).toBe(9);
  });

  it("দাম বদলালে credit-সংখ্যাও বদলায় — হার্ডকড নয়", () => {
    const cheap = whatsappSurchargeCredits({
      messagesBeforeThisOne: 2000,
      feePerMessageBdt: 0.54,
      bdtPerCredit: 999 / 15000,
    });
    const expensive = whatsappSurchargeCredits({
      messagesBeforeThisOne: 2000,
      feePerMessageBdt: 0.54,
      bdtPerCredit: 1999 / 15000,
    });
    // credit-এর নগদ মূল্য দ্বিগুণ হলে surcharge অর্ধেক credit-এ হবে
    expect(expensive).toBeLessThan(cheap);
  });
});

describe("bdtPerCreditFrom — শূন্য-দামের plan-এ থেমে যাওয়া", () => {
  it("স্বাভাবিক ইনপুটে ভাগফল", () => {
    expect(bdtPerCreditFrom(999, 15000)).toBeCloseTo(0.0666, 4);
  });

  it("🔴 শূন্য/অগণিত ইনপুটে ০ — অর্থাৎ surcharge বন্ধ", () => {
    // ⚠️ যে plan-এর জন্য merchant কিছুই দেননি, সেখানে "খরচ ভাগ করে নেওয়ার"
    //    প্রশ্নই ওঠে না। আর এটিই সেই পথ যা `0/0 = NaN` হওয়া থেকে বাঁচায়।
    expect(bdtPerCreditFrom(0, 15000)).toBe(0);
    expect(bdtPerCreditFrom(999, 0)).toBe(0);
    expect(bdtPerCreditFrom(0, 0)).toBe(0);
    expect(bdtPerCreditFrom(-999, 15000)).toBe(0);
    expect(bdtPerCreditFrom(999, -15000)).toBe(0);
    expect(bdtPerCreditFrom(NaN, 15000)).toBe(0);
    expect(bdtPerCreditFrom(999, NaN)).toBe(0);
    expect(bdtPerCreditFrom(Infinity, 15000)).toBe(0);
  });
});

describe("currentWhatsappCycleStart — Meta-র মাস, আমাদের চক্র নয়", () => {
  it("মাসের প্রথম দিন, UTC-তে মধ্যরাত", () => {
    expect(currentWhatsappCycleStart(new Date("2026-10-16T05:30:00Z")).toISOString()).toBe(
      "2026-10-01T00:00:00.000Z"
    );
  });

  it("মাসের একেবারে শুরুতে ও শেষে — একই জানালা", () => {
    const firstMoment = currentWhatsappCycleStart(new Date("2026-10-01T00:00:00Z"));
    const lastDay = currentWhatsappCycleStart(new Date("2026-10-31T23:59:59Z"));
    expect(firstMoment.toISOString()).toBe(lastDay.toISOString());
  });

  it("মাস বদলালে জানালাও বদলায় (দুই দিকে)", () => {
    expect(currentWhatsappCycleStart(new Date("2026-02-28T10:00:00Z")).toISOString()).toBe(
      "2026-02-01T00:00:00.000Z"
    );
    expect(currentWhatsappCycleStart(new Date("2026-03-01T00:00:00Z")).toISOString()).toBe(
      "2026-03-01T00:00:00.000Z"
    );
  });
});

/**
 * Service tripwire — যে তিনটি জিনিস pure টেস্ট কখনো ধরতে পারে না
 * ─────────────────────────────────────────────────────────────────────────────
 * `renewal-reminder.test.ts`-এর একই ছাঁচ। এখানে ঝুঁকিটা আলাদা ধরনের: উপরের সব
 * unit test পাস করেও surcharge-টি **কখনো কার্যকর নাও হতে পারত** — যদি
 * `charge-usage.ts` সেটি কখনো না ডাকে, বা ভুল শর্তে ডাকে। অনুপস্থিত একটি call-এর
 * কোনো ফলাফলই নেই যা behaviour দিয়ে মাপা যায়, তাই source পড়া হয়।
 */
describe("charge-usage service tripwire", () => {
  const chargeSource = readFileSync(
    fileURLToPath(new URL("../ai/charge-usage.ts", import.meta.url)),
    "utf8"
  );
  const surchargeSource = readFileSync(
    fileURLToPath(new URL("../services/whatsapp-surcharge.ts", import.meta.url)),
    "utf8"
  );

  it("🔴 surcharge-টি কেবল `channel === \"whatsapp\"`-এ ডাকা হয়", () => {
    const at = chargeSource.indexOf("whatsappSurcharge(ctx.userId");
    expect(at).toBeGreaterThan(-1);

    // ঠিক আগের অংশটিই শর্ত — ৪০০ অক্ষর যথেষ্ট
    const guard = chargeSource.slice(Math.max(0, at - 400), at);
    expect(guard).toMatch(/channel\s*===\s*"whatsapp"/);
    // ⚠️ টেস্ট চ্যাট কোনো ফোনে যায় না, তাই Meta কিছুই নেয় না
    expect(guard).toMatch(/!ctx\.isTestChat|!isTestChat/);
    // ফ্রি tier গোনা হয় per-bot, তাই bot ছাড়া গোনার ঘরই নেই
    expect(guard).toMatch(/input\.chatbotId/);
  });

  it("🔴 `resolveReplyCredits` অপরিবর্তিত — surcharge ওখানে বসেনি", () => {
    // ⚠️ এটিই পরিকল্পনা থেকে সচেতন বিচ্যুতির প্রমাণ। surcharge-টি ওখানে বসলে
    //    `resolveCompareCredits`-ও (যেটি ওই ফাংশনটি ডাকে) প্রভাবিত হত, আর
    //    মডেল-প্রতি credit-এর ফাংশনটি নীরবে channel-নির্ভর হয়ে যেত।
    //
    // ⚠️ `not.toContain("whatsapp-cost")` লেখা **যায় না** — এটি একবার ভুল
    //    assertion হয়ে ফেলেছিল, কারণ ফাইলের একটি মন্তব্যেই ওই পথটি লেখা আছে
    //    ("হিসাবের নিয়ম `lib/domain/whatsapp-cost.ts`-এ")। অর্থাৎ পরীক্ষাটি
    //    তখন একটি **মন্তব্য** মাপছিল, কোড নয়। তাই এখন import-স্টেটমেন্টটিই
    //    ধরা হয় — যেটি সত্যিই কোড।
    const resolverSource = readFileSync(
      fileURLToPath(new URL("../ai/credit-resolver.ts", import.meta.url)),
      "utf8"
    );
    expect(resolverSource).not.toContain("whatsappSurcharge");
    expect(resolverSource).not.toMatch(/import[^;]*whatsapp-cost/);
    // আর surcharge-এর ফাংশনটিই যে এখানে ডাকা হয় না — সেটিই আসল দাবি
    expect(resolverSource).not.toMatch(/resolveReplyCredits[\s\S]{0,600}whatsappSurcharge/);
  });

  it("🔴 `count()`-এর `where`-এ `chatbotId` ও `channel` দুটিই আছে", () => {
    // ⚠️ `chatbotId` বাদ পড়লে একজন merchant-এর সব bot মিলে একটি ফ্রি tier
    //    গুনত, আর দ্বিতীয় bot থেকে প্রথম দিন থেকেই চার্জ শুরু হত — একটি
    //    নীরব, ব্যাখ্যাতীত চার্জ।
    //    `channel` বাদ পড়লে Facebook-এর বার্তাও WhatsApp-এর ফ্রি tier খেয়ে
    //    ফেলত, অর্থাৎ ফ্রি tier-টি আগেই শেষ হয়ে যেত।
    const countAt = surchargeSource.indexOf("aIUsageLog.count");
    expect(countAt).toBeGreaterThan(-1);

    const whereBlock = surchargeSource.slice(countAt, countAt + 400);
    expect(whereBlock).toMatch(/chatbotId,/);
    expect(whereBlock).toMatch(/channel:\s*"whatsapp"/);
    expect(whereBlock).toMatch(/createdAt:\s*\{\s*gte:\s*cycleStart\s*\}/);
  });

  it("🔴 বন্ধ থাকলে plan/ক্যাটালগ পড়ার আগেই ফেরা হয়", () => {
    // ⚠️ এটিই "ডিফল্টে বন্ধ"-এর বাস্তব মূল্য: ফি শূন্য থাকলে প্রতিটি WhatsApp
    //    reply-তে দুটি বাড়তি DB read বন্ধ। ক্রমটি উল্টে গেলে সেই অপচয় নীরবে
    //    ফিরে আসত — ফলাফল হুবহু একই থাকত, তাই কোনো behaviour test ধরত না।
    const killSwitchAt = surchargeSource.indexOf("whatsappFeeBdtPerMessage <= 0");
    const countAt = surchargeSource.indexOf("aIUsageLog.count");
    const userAt = surchargeSource.indexOf("db.user.findUnique");

    expect(killSwitchAt).toBeGreaterThan(-1);
    expect(countAt).toBeGreaterThan(killSwitchAt);
    expect(userAt).toBeGreaterThan(countAt);
  });

  it("🔴 surcharge-এর জন্য ক্যাটালগের দাম পড়া হয়, হার্ডকড নয়", () => {
    // ⚠️ এখানে `plan.price` সরাসরি পড়া হলে admin-এর বসানো দাম উপেক্ষিত হত,
    //    আর তাহলে ড্যাশবোর্ডে যা দেখানো হয় তার সাথে হিসাব মিলত না।
    expect(surchargeSource).toContain("resolveListPrice");
    expect(surchargeSource).toContain("getPricingCatalogue");
    expect(surchargeSource).not.toMatch(/=\s*999\b/);
  });
});
