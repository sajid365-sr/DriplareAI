import { describe, expect, it } from "vitest";

import {
  CYCLE_DAYS,
  YEARLY_DAYS,
  cycleDays,
  normalizeCycle,
  resolvePlanExpiry,
} from "./billing-cycle";

/**
 * ১৫.৭ — মেয়াদের গণিত।
 *
 * ⚠️ এই ফাইলের প্রতিটি test একটি টাকার প্রশ্নের উত্তর দেয়: "এই merchant কত দিন
 *    সেবা পাবেন?" একটি ভুল উত্তর দুই দিকেই ক্ষতিকর — বেশি দিলে আমরা বিনা পয়সায়
 *    চলে যাই, কম দিলে টাকা নিয়ে কম দিন দিই।
 */

/** একটি নির্দিষ্ট দিনের দুপুর — তারিখ-সীমার ঝামেলা এড়াতে। */
function date(y: number, m: number, d: number, h = 12): Date {
  return new Date(y, m, d, h, 0, 0, 0);
}

function plusDays(from: Date, days: number): Date {
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
}

describe("চক্রের দৈর্ঘ্য", () => {
  it("মাসিক ৩০, বার্ষিক ৩৬৫ — ৩৬০ নয়", () => {
    // ⚠️ ৩৬০ হলে প্রতি বছর ৫ দিন কুঁচকে যেত — ৭২ বছরে একটি পুরো মাস।
    expect(CYCLE_DAYS).toBe(30);
    expect(YEARLY_DAYS).toBe(365);
    expect(cycleDays("monthly")).toBe(30);
    expect(cycleDays("yearly")).toBe(365);
  });
});

describe("resolvePlanExpiry — মেয়াদ জমে, জ্বলে না", () => {
  const now = date(2026, 9, 15); // ২০২৬-১০-১৫

  it("মেয়াদ না থাকলে এখন থেকে গোনে", () => {
    expect(resolvePlanExpiry(now, "monthly", null)).toEqual(plusDays(now, 30));
    expect(resolvePlanExpiry(now, "yearly", null)).toEqual(plusDays(now, 365));
  });

  it("আগেভাগে নবায়ন করলে বাকি দিনগুলো জমে", () => {
    // ⚠️ **এই test-টিই এই ফাংশনের কারণ।** আগের নিয়মে (`now + 30`) ২৫তম দিনে
    //    টাকা দিলে ৫ দিন জ্বলে যেত। এখানে ২৫ + ৩০ = ৫৫তম দিন।
    const current = plusDays(now, 25);

    expect(resolvePlanExpiry(now, "monthly", current)).toEqual(plusDays(current, 30));
    // এখন থেকে ৩০ নয় — অর্থাৎ businessman-এর হিসাবে ঠিক ৩০ দিন এসেছে
    expect(resolvePlanExpiry(now, "monthly", current)).not.toEqual(plusDays(now, 30));
  });

  it("বার্ষিক নবায়নও একইভাবে জমে", () => {
    const current = plusDays(now, 10);

    expect(resolvePlanExpiry(now, "yearly", current)).toEqual(plusDays(current, 365));
  });

  it("দেরিতে নবায়ন করলে অতীত থেকে জমে না", () => {
    // ⚠️ নইলে ৬ মাস আগে মেয়াদ শেষ হওয়া একজন ফিরে এসে অতীত থেকে জমে থাকা দিন
    //    পেতেন — এমনকি ১ বছর পরে ফিরলে ১ বছর মেয়াদ।
    const past = plusDays(now, -180);

    expect(resolvePlanExpiry(now, "monthly", past)).toEqual(plusDays(now, 30));
  });

  it("মেয়াদ ঠিক এই মুহূর্তে শেষ হলে এখন থেকেই গোনে", () => {
    // সীমাটি `>` — `>=` হলে শেষ মুহূর্তে নবায়নকারীর ৩০ দিন হতো, অথচ তার
    // আগের মেয়াদও ওই মুহূর্তেই শেষ — অর্থাৎ সে একটি দিনও হারাত না। কিন্তু
    // সমান-মুহূর্তে পুরনো মেয়াদ ধরলে ৩০ দিন হতো শূন্য থেকে, যা ভুল নয় —
    // তবু সীমাটি স্পষ্ট করে লেখা থাকুক।
    const current = new Date(now);

    expect(resolvePlanExpiry(now, "monthly", current)).toEqual(plusDays(now, 30));
  });

  it("ভাঙা তারিখকে 'মেয়াদ নেই' ধরে, নীরবে ভুল মেয়াদ বানায় না", () => {
    // ⚠️ `Invalid Date`-এর getTime() NaN, আর NaN-এর সাথে যেকোনো তুলনা false।
    //    সেটি চুপচাপ `now`-তে নেমে আসে — অর্থাৎ বাগটি একটি ভুল মেয়াদ বানাত
    //    আকারে, ক্র্যাশে নয়। তাই স্পষ্টভাবে বাদ দেওয়া হয়।
    const broken = new Date(Number.NaN);

    expect(resolvePlanExpiry(now, "monthly", broken)).toEqual(plusDays(now, 30));
  });

  it("মূল Date অবজেক্টটি বদলায় না", () => {
    // ⚠️ `setDate` in-place বদলায়, তাই ভিতরে `new Date(current)` করা হয়। না হলে
    //    caller-এর হাতে থাকা মেয়াদ নীরবে সরে যেত।
    const current = plusDays(now, 10);
    const original = new Date(current);

    resolvePlanExpiry(now, "monthly", current);

    expect(current).toEqual(original);
  });

  it("৩৬৫ দিন পরে ঠিক একই তারিখে ফেরে (লিপ ইয়ারেও কম-বেশি নয়)", () => {
    // ২০২৮ একটি লিপ ইয়ার — ১ মার্চ ২০২৭ থেকে ৩৬৫ দিন = ১ মার্চ ২০২৮ নয়,
    // ২৯ ফেব্রুয়ারি ২০২৮ ধরে ৩৬৫ দিন = ২৮ ফেব্রুয়ারি ২০২৮ … অর্থাৎ একটি
    // নিয়ম আছে, আর সেটি এখানে পেরে রাখা হয় যাতে ভবিষ্যতে কেউ মিলিসেকেন্ড
    // যোগ করে ভেঙে না ফেলে।
    const start = date(2027, 2, 1); // ২০২৭-০৩-০১
    const expiry = resolvePlanExpiry(start, "yearly", null);

    expect(expiry.getTime() - start.getTime()).toBe(365 * 24 * 60 * 60 * 1000);
  });
});

describe("normalizeCycle — অজানা মান নিরাপদ দিকে", () => {
  it("শুধু 'yearly' বার্ষিক; বাকি সব মাসিক", () => {
    expect(normalizeCycle("yearly")).toBe("yearly");
    expect(normalizeCycle("monthly")).toBe("monthly");
  });

  it("একটি টাইপোকে বার্ষিক ধরে না — ১২ মাসের সেবা এক মাসের দামে বিক্রি এড়ায়", () => {
    // ⚠️ `"Yearly"` (বড় হাতের Y), `"annual"`, `true`, `1` — কোনোটি বার্ষিক ধরা
    //    হলে ৳৯৯৯-এর একটি মাসিক পেমেন্ট ৩৬৫ দিনের মেয়াদ দিত।
    for (const value of ["Yearly", "YEARLY", "annual", "annualy", true, 1, null, undefined, {}]) {
      expect(normalizeCycle(value)).toBe("monthly");
    }
  });
});
