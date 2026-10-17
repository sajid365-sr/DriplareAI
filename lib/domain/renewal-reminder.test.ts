import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  crossedThresholds,
  describeRenewal,
  daysUntil,
  isRenewalThreshold,
  RENEWAL_GRACE_DAYS,
  reminderThreshold,
  resolveRenewalWindow,
} from "./renewal-reminder";

/**
 * মেয়াদ-শেষের reminder — বিশুদ্ধ নিয়ম (১৫.৭ · ধাপ D.২)
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ এই ফাইলের সবচেয়ে বড় দাবি একটি: **reminder-এর লেখাটি ছাপার মুহূর্তে সত্য
 *    থাকতে হবে।** অর্থাৎ "৭ দিন বাকি" লেখা একটি email কেবল তখনই যাবে যখন সত্যিই
 *    প্রায় সাত দিন বাকি। কারণটি টাকার: যে merchant ভাবেন সাত দিন হাতে আছে,
 *    তিনি ওই সাত দিনে নবায়ন করেন না — আর তখন তাঁর সেবা বন্ধ হয়ে যায়।
 *
 * দ্বিতীয় দাবি: একটি ভুল দিন-গণনা **নীরব**। কেউ exception দেখেন না — কেবল একটি
 * email আসে বা আসে না। তাই এখানে প্রতিটি সীমানা আলাদা করে বসানো হলো।
 */

const NOW = new Date("2026-10-15T09:00:00.000Z");

/** `NOW` থেকে n দিন পরে (ভগ্নাংশ চলবে)। */
function inDays(n: number): Date {
  return new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
}

describe("daysUntil", () => {
  it("পুরো দিন গোনে — এবং **নিচের দিকে** গোল করে", () => {
    expect(daysUntil(NOW, inDays(7))).toBe(7);
    // ⚠️ ৬.৯ দিন বাকি → ৬। উপরে গোল করলে "৭ দিন বাকি" লেখা যেত, অথচ ৭ দিন নেই।
    expect(daysUntil(NOW, inDays(6.9))).toBe(6);
    expect(daysUntil(NOW, inDays(6.1))).toBe(6);
  });

  it("মেয়াদ পার হয়ে গেলে ঋণাত্মক দেয় (পুরো দিন, নিচের দিকে)", () => {
    expect(daysUntil(NOW, inDays(-1))).toBe(-1);
    expect(daysUntil(NOW, inDays(-3.5))).toBe(-4);
  });

  it("অবৈধ তারিখে ফেটে যায় না", () => {
    // ⚠️ `NaN` ছড়িয়ে পড়লে প্রতিটি তুলনা `false` হত — অর্থাৎ reminder **কখনো**
    //    যেত না, অথবা কখনো সবসময় যেত। দুটোই নীরব।
    expect(daysUntil(NOW, new Date("nonsense"))).toBe(0);
  });
});

describe("threshold এনকোডিং", () => {
  it("দিন → ঋণাত্মক সংখ্যা (শতাংশের সাথে সংঘর্ষ নেই)", () => {
    expect(reminderThreshold(7)).toBe(-7);
    expect(reminderThreshold(1)).toBe(-1);
    // শতাংশ থ্রেশহোল্ড ধনাত্মক, তাই `percent >= -7` কখনো এই পথে আসবে না
    expect(isRenewalThreshold(-7)).toBe(true);
    expect(isRenewalThreshold(80)).toBe(false);
    expect(isRenewalThreshold(0)).toBe(false);
  });
});

describe("resolveRenewalWindow", () => {
  it("`null` মেয়াদ → কিছুই নয় (এবং এটিই সবচেয়ে জরুরি কেস)", () => {
    // ⚠️ `planExpiresAt`-এর কোনো default নেই, তাই **প্রতিটি নতুন user** এখানে
    //    পড়েন। `NULL`-কে "মেয়াদ শেষ" ধরলে প্রত্যেক নতুন merchant একটি "আপনার
    //    মেয়াদ শেষ" email পেতেন — ঠিক যে ভুলটি `plan_expired` নিয়ম এড়াতে বানানো।
    expect(resolveRenewalWindow(NOW, null)).toBeNull();
    expect(resolveRenewalWindow(NOW, undefined)).toBeNull();
  });

  it("অবৈধ তারিখ → কিছুই নয়", () => {
    expect(resolveRenewalWindow(NOW, new Date("nope"))).toBeNull();
  });

  it("জানালার বাইরে দূরে থাকলে কিছুই নয়", () => {
    expect(resolveRenewalWindow(NOW, inDays(8))).toBeNull();
    expect(resolveRenewalWindow(NOW, inDays(30))).toBeNull();
    expect(resolveRenewalWindow(NOW, inDays(365))).toBeNull();
  });

  it("জানালার ভিতরে ঢুকলেই সত্যিকারের দিন-সংখ্যা দেয়", () => {
    expect(resolveRenewalWindow(NOW, inDays(7))?.daysLeft).toBe(7);
    expect(resolveRenewalWindow(NOW, inDays(4))?.daysLeft).toBe(4);
  });

  it("৭ দিন-এর সীমানা — জানালাটি ঠিক কোথায় খোলে", () => {
    // ⚠️ `daysUntil` নিচের দিকে গোল করে, তাই জানালাটি খোলে **৭.৯৯ দিনে**,
    //    ৮.০০-তে নয় — অর্থাৎ ইচ্ছাকৃতভাবে প্রায় এক দিন আগেভাগে, আর লেখাটি হয়
    //    "৭ দিন বাকি" (০.৯ দিন কম বলা)। এটি নিরাপদ দিক: merchant যে সময়টুকু
    //    সত্যিই পান তার কম বলেন, বেশি নয় — বেশি বললে তিনি দেরি করে ফেলতেন।
    expect(resolveRenewalWindow(NOW, inDays(7.99))?.daysLeft).toBe(7);
    expect(resolveRenewalWindow(NOW, inDays(7.999))?.daysLeft).toBe(7);
    expect(resolveRenewalWindow(NOW, inDays(8))).toBeNull();
  });

  it("মেয়াদ পার হলেও এক সপ্তাহ পর্যন্ত মনে করিয়ে দেয়", () => {
    // কারণ: cron একটি দিন বন্ধ থাকলেই যে merchant-এর মেয়াদ গতকাল শেষ হয়েছে
    // তিনি একটি email-ও না পেয়ে সেবা হারাতেন।
    expect(resolveRenewalWindow(NOW, inDays(-7))).not.toBeNull();
    expect(resolveRenewalWindow(NOW, inDays(-8))).toBeNull();
    expect(resolveRenewalWindow(NOW, inDays(-90))).toBeNull();
  });

  it("শেষ দিনে (৭ দিন আগে) একটি মান — জানালার সীমানা", () => {
    const window = resolveRenewalWindow(NOW, inDays(-RENEWAL_GRACE_DAYS));
    expect(window?.daysLeft).toBe(-RENEWAL_GRACE_DAYS);
  });
});

describe("crossedThresholds — ক্রম", () => {
  it("**জরুরি আগে** (১, ৩, ৭) — শতাংশ-পথের ঠিক উল্টো দিকে", () => {
    // ⚠️ কারণ: এখানকার প্রতিটি বার্তা সময়ের একটি দাবি, অবস্থা নয়। তিনটি
    //    একসাথে পাঠানো মানে ৩ দিন বাকি merchant-এর কাছে "৭ দিন বাকি" লেখা email
    //    — অর্থাৎ সরাসরি মিথ্যা। এজন্য caller কেবল প্রথম অদাবিকৃতটি পাঠাবে।
    expect(crossedThresholds(0)).toEqual([-1, -3, -7]);
    expect(crossedThresholds(1)).toEqual([-1, -3, -7]);
    expect(crossedThresholds(2)).toEqual([-3, -7]);
    expect(crossedThresholds(5)).toEqual([-7]);
    expect(crossedThresholds(7)).toEqual([-7]);
  });

  it("মেয়াদ পেরিয়ে গেলে তিনটিই — কিন্তু ক্রম জরুরিটি আগে রাখে", () => {
    expect(crossedThresholds(-3)).toEqual([-1, -3, -7]);
  });
});

describe("describeRenewal — সৎ লেখা", () => {
  it("থ্রেশহোল্ড নয়, আসল দিনকে বলে", () => {
    // ⚠️ এই দুটি পরীক্ষাই পুরো নকশার কারণ: থ্রেশহোল্ড `-7` হলেও চার দিন বাকি
    //    থাকলে লেখা হবে "৪ দিন", "৭ দিন" নয়।
    expect(describeRenewal(4)).toEqual({ kind: "days", days: 4 });
    expect(describeRenewal(7)).toEqual({ kind: "days", days: 7 });
  });

  it("বিশেষ দিনগুলো আলাদা করে — “আজ”, “আগামীকাল”", () => {
    expect(describeRenewal(0)).toEqual({ kind: "today" });
    expect(describeRenewal(1)).toEqual({ kind: "tomorrow" });
  });

  it("মেয়াদ পার হয়ে গেলে কত দিন আগে — একটি আলাদা বার্তা", () => {
    // ⚠️ "১ দিন বাকি" লেখা যাবে না যখন সত্যিই "১ দিন আগে শেষ হয়েছে" — দুটো
    //    লেখা বিপরীত অর্থ দেয়, আর ভুলটি merchant-কে ভুল প্রত্যাশা দিত।
    expect(describeRenewal(-1)).toEqual({ kind: "expired", daysAgo: 1 });
    expect(describeRenewal(-6)).toEqual({ kind: "expired", daysAgo: 6 });
  });
});

/**
 * Service tripwire — যে চারটি জিনিস pure ফাংশনের টেস্ট কখনো ধরতে পারে না
 * ─────────────────────────────────────────────────────────────────────────────
 * `reset-eligibility.test.ts`-এর একই ছাঁচ (সেখানে `reset-credits` route-এর এক
 * লাইন পড়া হয়)। এখানে চারটি আলাদা ঝুঁকি, আর প্রত্যেকটির কারণ আলাদা:
 *
 *  ১. **অ্যাপ-নোটিফিকেশনে claim হারানো** — এই বাগটি সত্যিই একবার লেখা হয়েছিল।
 *     `checkRenewalReminder` `/api/usage` থেকে চলে, অর্থাৎ ড্যাশবোর্ড খোলার
 *     **প্রতিবার**। claim না থাকলে `daysLeft <= 1` থাকা merchant প্রতিটি পেজ-লোডে
 *     আরেকটি বেল পেতেন। একটি pure টেস্ট এটি দেখতেই পারে না, কারণ বাগটি ফাংশন
 *     বাইরে কোথাও নেই — ঠিক যে call-টি **নেই**, সেটিই সমস্যা।
 *  ২. **এক run-এ এক email** — লুপটি `break` হারালে ৩ দিন বাকি থাকা merchant
 *     "৭ দিন বাকি" লেখা email পেতেন। লুপটি লিখতে ভুলে যাওয়া সহজ, আর লেখাটি
 *     তখন মিথ্যা — সেটিই এই নকশার একমাত্র বড় দাবি।
 *  ৩. **দুটি scan মিশে যাওয়া** — `scanUsageThresholds` `creditsBalance` দিয়ে
 *     ছাঁকে, `scanRenewalReminders` `planExpiresAt` দিয়ে। কেউ "সুবিধার জন্য"
 *     দুটো এক করে ফেললে **বার্ষিক merchant** (যাঁর credit ফুরায় না) কোনোদিন
 *     reminder পেতেন না — নীরবে, কারণ সব কিছু "কাজ করছে" দেখাত।
 *  ৪. **`/api/usage` hook মুছে ফেলা** — cron-টি Clerk-এ আটকে থাকে (TASK-22),
 *     তাই এই hook-টিই একমাত্র সত্যিকারের পথ। কেউ এটিকে "অপ্রয়োজনীয়" ভেবে
 *     সরালে reminder প্রোডাকশনে কখনো যেত না, অথচ টেস্ট সবুজ থাকত।
 */
describe("usage-alerts service tripwire", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../services/usage-alerts.ts", import.meta.url)),
    "utf8"
  );

  /** একটি `export async function`-এর শরীর, পরের top-level export পর্যন্ত। */
  function bodyOf(fnName: string): string {
    const start = source.indexOf(`export async function ${fnName}`);
    if (start < 0) return "";
    const next = source.indexOf("\nexport ", start + 1);
    return source.slice(start, next < 0 ? source.length : next);
  }

  const renewal = bodyOf("checkRenewalReminder");

  it("`checkRenewalReminder` আসলেই আছে", () => {
    expect(renewal).toContain("checkRenewalReminder");
  });

  it("🔴 অ্যাপ-নোটিফিকেশন claim করে **তারপর** লেখে", () => {
    // ⚠️ এই assertion-টিই একবার লেখা একটি আসল স্প্যাম-বাগ আটকায়। ক্রমটাই
    //    এখানে বিষয়: `notification.create`-এর **আগে** `claimAlert` ডাকা
    //    আবশ্যক, নইলে ড্যাশবোর্ডের প্রতিটি লোডে একটি নতুন বেল।
    const appStart = renewal.indexOf("if (wantsApp");
    const notifyAt = renewal.indexOf("db.notification.create", appStart);

    expect(appStart).toBeGreaterThan(-1);
    expect(notifyAt).toBeGreaterThan(appStart);

    const block = renewal.slice(appStart, notifyAt);

    // কেবল "claimAlert" শব্দটি খুঁজলে যথেষ্ট নয় (একবার যাচাই করা হয়েছে:
    // `true || await claimAlert(...)` লিখলেও পুরনো assertion সবুজ থাকত)।
    // তাই **গঠনটাই** দাবি করা হয়: await করা claim, আর তার ফল ব্যবহার করে
    // `!claimed` গার্ড — তিনটির ক্রম এই ক্রমেই।
    const claimedAt = block.search(/await claimAlert\(\{/);
    const guardAt = block.search(/if \(!\w*[Cc]laimed\)/);

    expect(claimedAt).toBeGreaterThan(-1);
    expect(guardAt).toBeGreaterThan(claimedAt);
    // চ্যানেলটি অবশ্যই "app" — "email" হলে দুই পথের key এক হয়ে যেত, আর
    // অ্যাপ-বেল পেলে email আর যেত না (একই unique key)।
    expect(block.slice(claimedAt, guardAt)).toMatch(/channel:\s*"app"/);
  });

  it("🔴 এক run-এ একটির বেশি মেয়াদ-শেষের email যায় না", () => {
    // ⚠️ `break`-টাই একমাত্র রক্ষা। না থাকলে ৩ দিন বাকি থাকা merchant
    //    "৭ দিন বাকি" লেখা email পেতেন — লেখাটি ছাপার মুহূর্তেই মিথ্যা।
    const loopStart = renewal.indexOf("for (const threshold of window.crossed)");
    const appStart = renewal.indexOf("if (wantsApp", loopStart);

    expect(loopStart).toBeGreaterThan(-1);
    expect(appStart).toBeGreaterThan(loopStart);

    const loop = renewal.slice(loopStart, appStart);
    expect(loop).toContain("break;");
    // একটি email = একটি `sendMail` — লুপে থাকলেও প্রথম অদাবিকৃতটিতেই ভাঙে
    expect(loop.match(/sendMail\(/g)?.length).toBe(1);
  });

  it("reminder-এর `cycleStart` = `planExpiresAt`, credit-চক্র নয়", () => {
    // ⚠️ ভুল key হলে একই মেয়াদের reminder বারবার খুলত (creditsResetDate মাসে
    //    মাসে সরে), আর `UsageAlert`-এর unique constraint অর্থহীন হয়ে যেত।
    expect(renewal).toMatch(/const cycleStart = user\.planExpiresAt/);
  });

  it("দুটি scan আলাদা — নইলে বার্ষিক merchant বাদ পড়েন", () => {
    const thresholds = bodyOf("scanUsageThresholds");
    const reminders = bodyOf("scanRenewalReminders");

    expect(reminders).toMatch(/planExpiresAt:\s*\{\s*not:\s*null\s*\}/);
    // credit-ছাঁকনটি reminder-scan-এ ঢুকে গেলে যিনি credit ফুর করান না তিনি
    // (অর্থাৎ মেয়াদ-শেষের reminder-এর মূল লক্ষ্য) কখনো ধরা পড়তেন না
    expect(reminders).not.toContain("creditsBalance");

    // আর উল্টো দিক: credit-scan-এ planExpiresAt ঢুকলে দুটিই এক তালিকা হয়ে যেত
    expect(thresholds).toContain("creditsBalance");
    expect(thresholds).not.toContain("planExpiresAt");
  });

  it("🔴 cron route `scanRenewalReminders` ডাকে", () => {
    const cronSource = readFileSync(
      fileURLToPath(
        new URL("../../app/api/cron/usage-alerts/route.ts", import.meta.url)
      ),
      "utf8"
    );

    expect(cronSource).toContain("scanRenewalReminders");
    expect(cronSource).toMatch(/await scanRenewalReminders\(/);
    // ✅ scan + reminder আলাদা নামে গোনা হয় — "৩টি alert" বললে বোঝা যেত না
    //    কতটি credit-শেষের আর কতটি মেয়াদ-শেষের
    expect(cronSource).toContain("renewalReminders: renewal.sent");
  });

  it("🔴 `/api/usage` hook অটুট — cron ছাড়া এটিই একমাত্র পথ", () => {
    // ⚠️ TASK-22: `/api/cron/*` Clerk middleware-এ আটকায়। hook-টি সরালে
    //    reminder প্রোডাকশনে কখনো যেত না, আর কোনো টেস্ট তা ধরত না।
    const usageRoute = readFileSync(
      fileURLToPath(new URL("../../app/api/usage/route.ts", import.meta.url)),
      "utf8"
    );

    expect(usageRoute).toContain("checkRenewalReminder");
    expect(usageRoute).toMatch(/checkRenewalReminder\(user\.userId\)/);
  });
});
