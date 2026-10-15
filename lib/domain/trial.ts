import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/core/db";
import { getPlanIfDefined, planAllowsPlatform } from "@/lib/domain/plan-config";
import { PAID_STATUSES } from "@/lib/domain/payment-status";
import { getRegionConfig, type Region } from "@/lib/core/region";

/**
 * Free Trial — DRIPLARE AI (১৫.৬)
 * ─────────────────────────────────────────────────────────────────────────────
 * ক্যাটালগে `trialDays` (BD Starter ৩ দিন, Global Starter ১৪ দিন) আগে থেকেই লেখা
 * ছিল, কিন্তু **কোথাও কার্যকর ছিল না** — অর্থাৎ trial বলে কিছু ছিল না। এই ফাইলটি
 * সেই ঘোষণাটিকে সত্য করে।
 *
 * ── কেন কোনো DDL লাগল না ────────────────────────────────────────────────────
 * `User.planExpiresAt` কলামটি **আগেই আছে** (`prisma/schema/auth.prisma:13`),
 * payment grant-এ লেখা হয় (`admin-credits.ts`), আর merchant-কে দেখানোও হয়
 * ("Renews on …")। একটি trial তো ঠিক সেটাই: **একটি plan period যা শেষ হয়, আর
 * নবায়ন হয় না**। তাই নতুন `trialEndsAt` কলামের দরকার নেই — এবং তার একটি
 * উপকারও আছে: trial আর paid cycle একই ঘড়ি ব্যবহার করে, তাই "আমার মেয়াদ কত"
 * প্রশ্নের একটাই উত্তর সবসময়।
 *
 * "এক account = একবার" শর্তটিও স্বাভাবিকভাবেই আসে: `planExpiresAt` কেবল
 * `NULL` থাকলে বসে, আর trial শেষে সেটি **মুছে ফেলা হয় না** (মুছলে trial
 * আবার arm হত)। অর্থাৎ ওই একটি কলামই একইসাথে ঘড়ি আর দলিল।
 *
 * ── কখন শুরু হয় ────────────────────────────────────────────────────────────
 * প্রথম **সত্যিকারের channel** connect করলে — sign-up-এ নয়। ডকের গ্রহণযোগ্যতা:
 * "আসল channel connect না করিলে activate হয় না"। কেবল অ্যাকাউন্ট খুলে ফেলে রাখা
 * দল trial credit পাবে না, কারণ ওদের সেবা দেওয়াই হয়নি।
 *
 * ── Allowance-এর নিয়ম, দুই ফাইলে মিলে সম্পূর্ণ ──────────────────────────────
 *   ১. allowance **একবার**, channel connect-এ (এই ফাইল)।
 *   ২. তারপর কেবল **টাকায়** (`app/api/cron/reset-credits` → `isResetEligible`)।
 *   দুটোর একটি ছাড়া অন্যটি অর্থহীন: ১৫.৯ না থাকলে trial-এর ১৫,০০০ credit
 *   প্রতি মাসে নীরবে নবায়ন হত, আর এই ফাইল না থাকলে payment-হীন user কখনোই
 *   allowance পেত না (default `creditsBalance` ৫০০, BD Starter-এর ১৫,০০০ নয়)।
 */

/**
 * যে slug গুলো **channel নয়**, তাই trial শুরু করে না।
 *
 * `n8n_source` হলো ingest-rail — n8n থেকে ডেটা ঢোকার পথ, গ্রাহকের চ্যানেল নয়।
 * এর কোনো গ্রাহক নেই যাকে সেবা দেওয়া হচ্ছে, তাই "channel connect" শর্তটি এতে
 * পূরণ হয় না। ১৫.৩-এ `canAddIntegration`-এও একই যুক্তিতে এটি ছাড় দেওয়া হয়েছিল।
 */
const NON_CHANNEL_PLATFORMS = new Set(["n8n_source"]);

/**
 * এই plan + region-এ trial কত দিন, বা `null` যদি trial-ই না থাকে।
 *
 * ⚠️ কেবল যাদের ক্যাটালগে `trialDays` লেখা আছে — অর্থাৎ Starter। Business ও
 *    Enterprise-এ `trialDays` নেই, কারণ তাদের বিক্রি হয় চুক্তি/আপগ্রেডে, আর
 *    নতুন user কখনোই ওই plan-এ জন্মায় না (`User.plan` ডিফল্ট `starter`)।
 *    ব্যবসায়িক দিকটাও প্রত্যক্ষ: যিনি Starter-এ ৩ দিন দেখে সিদ্ধান্ত নেন, তিনিই
 *    উপরের tier কেনেন।
 */
export function trialDaysFor(plan: string, region: Region): number | null {
  const config = getPlanIfDefined(region, plan);
  const days = config?.trialDays;
  return typeof days === "number" && days > 0 ? days : null;
}

/** Trial-এর শেষ মুহূর্ত — `now` থেকে `days` দিন পরে। */
export function computeTrialEnd(now: Date, days: number): Date {
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  return end;
}

/** কেন trial শুরু হলো না (হলে `null`)। */
export type TrialSkipReason =
  | "user_not_found"
  | "already_used"
  | "region_has_no_gateway"
  | "no_trial_for_plan"
  | "not_a_channel"
  | "platform_not_allowed";

export type TrialStartResult =
  | { started: true; endsAt: Date; days: number }
  | { started: false; reason: TrialSkipReason };

/**
 * প্রথম সত্যিকারের channel connect-এ trial শুরু করে — **একবারের বেশি নয়**।
 *
 * সব gate একটিই নিরাপদ দিকে ঝোঁকে: সন্দেহ হলে trial **দেওয়া হয় না**, কারণ
 * ভুল করে দেওয়া মানে বিনা টাকায় ব্যবহারের সীমা বাড়ানো।
 */
export async function startTrialIfEligible(
  userId: string,
  platform: string
): Promise<TrialStartResult> {
  const user = await db.user.findUnique({
    where: { userId },
    select: { plan: true, region: true },
  });

  if (!user) return { started: false, reason: "user_not_found" };

  const region = (user.region || "bd") as Region;

  // ── কেন Global-এ trial নেই (১৫.৬-এর সিদ্ধান্ত, লিখিত) ─────────────────────
  // Global-এ plan-এর দামই $০ (Starter) আর **gateway-ই নেই**। trial-এর একমাত্র
  // উদ্দেশ্য রূপান্তর, আর সেখানে টাকা নেওয়ার কোনো পথ নেই — অর্থাৎ মেয়াদ শেষে
  // merchant-এর অবস্থা হত: chatbot paused, credit নেই, আর কেনারও উপায় নেই।
  // ওই পরিণতি trial না দেওয়ার চেয়ে খারাপ, তাই অঞ্চলটি বাদ। (ওখানে `free_plan`
  // নিয়মে Starter-এর ৫০০ credit প্রতি cycle-এ নবায়নও হয় — স্থায়ী free tier,
  // trial-এর দরকারই নেই।)
  if (getRegionConfig(region).paymentGateway === null) {
    return { started: false, reason: "region_has_no_gateway" };
  }

  const days = trialDaysFor(user.plan, region);
  if (!days) return { started: false, reason: "no_trial_for_plan" };

  const slug = String(platform ?? "").trim().toLowerCase();
  if (!slug || NON_CHANNEL_PLATFORMS.has(slug)) {
    return { started: false, reason: "not_a_channel" };
  }

  // plan-এর `allowedPlatforms`-ই এখানে নিয়ম, নকল নয় — যে channel তিনি
  // connect করতে পারছেন না, তার জন্য allowance নেওয়ার প্রশ্নই ওঠে না।
  if (!planAllowsPlatform(user.plan, region, slug)) {
    return { started: false, reason: "platform_not_allowed" };
  }

  const config = getPlanIfDefined(region, user.plan);
  if (!config) return { started: false, reason: "no_trial_for_plan" };

  const now = new Date();
  const endsAt = computeTrialEnd(now, days);

  // ── Atomic compare-and-set ────────────────────────────────────────────────
  //
  // দুটি tab একসাথে connect করলে দুটোই `planExpiresAt == null` পড়তে পারে,
  // ফলে ঘড়িটা দুইবার বসত (এবং allowance-ও)। `updateMany`-এর `where`-এ শর্তটি
  // রাখায় কেবল একটি caller জেতে — ঠিক যে প্যাটার্নে `applyPaymentGrant`
  // নিজের duplicate webhook আটকায়।
  const claimed = await db.user.updateMany({
    where: { userId, planExpiresAt: null },
    data: {
      planExpiresAt: endsAt,
      includedCredits: config.includedCredits,
      creditsBalance: config.includedCredits,
      creditsUsedThisCycle: 0,
      // ঘড়ি দুটো একসাথে: trial শেষ হওয়ার দিনেই পরের cycle-এর কথা ভাবা হবে।
      // (১৪.৯ এখানে দ্বিতীয়বার allowance দেয় না — `isResetEligible` দেখুন।)
      creditsResetDate: endsAt,
    },
  });

  if (claimed.count === 0) {
    return { started: false, reason: "already_used" };
  }

  return { started: true, endsAt, days };
}

// ─────────────────────────────────────────────────────────────────────────────
// "তিনি কি plan-এর জন্য টাকা দিয়েছেন?" — একটিই সংজ্ঞা
// ─────────────────────────────────────────────────────────────────────────────

/**
 * "plan কেনার একটি জীবিত payment" — এই round-এ তিনটি প্রশ্নেরই একমাত্র সূত্র:
 * trial মেয়াদ শেষ হয়েছে কি (`listExpiredUnpaidTrials`), trial পরিণত হয়েছে কি
 * (`buildTrialReport`), আর dashboard-এ `planExpiresAt` কি trial-এর নাকি paid
 * cycle-এর (`isTrialAccount`)। তিন জায়গায় কপি করলে একদিন একটি বদলাত আর
 * দুটি থাকত — ঠিক যে রোগে `growth`-এর ভূত জন্মেছিল।
 *
 * ⚠️ `refundStatus !== "refunded"` — refund "চেয়েছে" (requested/approved/rejected)
 *    আর refund "হয়ে গেছে" এক নয়; আগেরগুলোতে টাকা এখনো আমাদের কাছে।
 *
 * ⚠️ **`OR`-টি ইচ্ছাকৃত, বাহুল্য নয়।** `refundStatus` একটি **nullable** কলাম
 *    (`billing.prisma:43`), আর স্বাভাবিক অবস্থায় প্রতিটি payment-এ এর মান
 *    `NULL` — refund কেবল ব্যতিক্রমী ঘটনায় লেখা হয়। কিন্তু Prisma-র
 *    `{ not: "refunded" }` একটি nullable কলামে NULL row-গুলো ফেরত দেয় কি না,
 *    সেটি SQL-এর তিন-মান-যুক্তির উপর নির্ভরশীল প্রশ্ন (SQL-এ
 *    `NULL <> 'refunded'` → `NULL`, অর্থাৎ row বাদ) — আর এই সেশনে চালিয়ে
 *    মিলিয়ে দেখার উপায় ছিল না। দুই পড়ার মধ্যে যেটিই সত্যি হোক, ফলাফল যেন
 *    একটাই হয়, সেজন্যই `OR: [null, not "refunded"]` লেখা হলো।
 *
 *    ⚠️ **কেন এতটা সতর্কতা:** যদি `{ not: "refunded" }` NULL বাদ দিত, তবে
 *    `hasPaidForPlan` প্রতিটি **সাধারণ** payment-এ `false` ফেরত দিত — অর্থাৎ
 *    `listExpiredUnpaidTrials` প্রত্যেক পরিশোধকারীকেও "non-paying trial" বলে
 *    ধরত, আর `processExpiredTrials` তাঁদের chatbot **বন্ধ করে দিত**। একটি
 *    অপ্রমাণিত ধারণার উপর নির্ভর করে টাকা-দেওয়া merchant-এর সেবা বন্ধ করা
 *    এই ফাইলের সবচেয়ে খারাপ সম্ভাব্য ব্যর্থতা।
 */
const PAID_PLAN_PAYMENT_WHERE: Prisma.PaymentTransactionWhereInput = {
  paymentStatus: { in: PAID_STATUSES },
  kind: { in: ["plan", "invoice_plan"] },
  OR: [{ refundStatus: null }, { refundStatus: { not: "refunded" } }],
};

/**
 * এই user কি কখনোই কোনো plan-এর জন্য টাকা দিয়েছেন?
 *
 * `planExpiresAt` দুটি ভিন্ন জিনিস বোঝাতে পারে — একটি paid cycle-এর মেয়াদ,
 * অথবা একটি trial-এর মেয়াদ (`startTrialIfEligible` ঠিক একই কলাম ব্যবহার করে,
 * কারণ trial-ও একটি plan period যা শেষ হয়)। পার্থক্যটি কেবল টাকায়, তাই
 * পার্থক্যটি এখানেই জিজ্ঞেস করতে হয়।
 */
export async function hasPaidForPlan(userId: string): Promise<boolean> {
  const count = await db.paymentTransaction.count({
    where: { userId, ...PAID_PLAN_PAYMENT_WHERE },
  });

  return count > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trial-এর মেয়াদ শেষ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * যে trial-গুলো মেয়াদোত্তীর্ণ কিন্তু এখনো **পরিণতি ভোগ করেনি**।
 *
 * ⚠️ কেবল `planExpiresAt <= now` দেখাই যথেষ্ট নয় — যিনি ইতিমধ্যে টাকা দিয়েছেন
 *    (এবং সেই টাকায় নতুন `planExpiresAt` আছে) তিনি কোনো trial-expiry নন।
 *    তাই paid payment থাকলে বাদ দেওয়া হয়। এটি `isResetEligible`-এর মূল নীতির
 *    সাথে একই: পরিণতি ঘটে **টাকার অভাবে**, কেবল সময় পার হয়ে গেলে নয়।
 */
export async function listExpiredUnpaidTrials(): Promise<
  Array<{ userId: string; planExpiresAt: Date }>
> {
  const now = new Date();

  const candidates = await db.user.findMany({
    where: { planExpiresAt: { lte: now } },
    select: { userId: true, planExpiresAt: true },
  });

  if (candidates.length === 0) return [];

  const paidRows = await db.paymentTransaction.groupBy({
    by: ["userId"],
    where: {
      userId: { in: candidates.map((user) => user.userId) },
      ...PAID_PLAN_PAYMENT_WHERE,
    },
  });

  const paid = new Set(paidRows.map((row) => row.userId));

  return candidates
    .filter((user) => !paid.has(user.userId))
    .map((user) => ({ userId: user.userId, planExpiresAt: user.planExpiresAt! }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin-এর চোখ — abuse-এর জানা সীমা
// ─────────────────────────────────────────────────────────────────────────────

/**
 * যে domain থেকে একাধিক trial এসেছে — abuse-এর একমাত্র চোখে-দেখার-মতো সংকেত।
 *
 * ⚠️ **জানা সীমা, অর্জন নয়:** IP বা ফোন সংরক্ষিতই নেই (কোনো কলাম নেই), আর
 *    সেটি ধরতে নতুন কলাম মানে DDL — যা এই round-এ নেই। তাই একই ব্যক্তি
 *    একাধিক account খুললে এখানে ধরা পড়বে কেবল তখনই, যখন তিনি corporate
 *    domain ব্যবহার করেন। gmail/yahoo-র মতো পাবলিক provider-এ ওই সংকেত
 *    অর্থহীন (একটি cluster-এ হাজার লোক), তাই ওগুলো আলাদা গোনা হয় —
 *    নইলে admin একটি অর্থহীন "gmail.com × 40" দেখে সময় নষ্ট করতেন।
 */
const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
]);

export interface TrialAccount {
  userId: string;
  name: string;
  email: string;
  emailDomain: string;
  plan: string;
  region: Region;
  planExpiresAt: Date;
  status: "active" | "expired";
  creditsBalance: number;
  /** টাকা দিয়ে পরিণত হয়েছেন কি — trial-এর সাফল্যের একমাত্র সংজ্ঞা। */
  converted: boolean;
}

export interface TrialReport {
  accounts: TrialAccount[];
  /** একই corporate domain-এ একাধিক trial (count ≥ 2)। */
  domainClusters: Array<{ domain: string; count: number }>;
  /** পাবলিক provider-এ কতগুলো trial — এদের clustering অর্থহীন (উপরের মন্তব্য)। */
  publicProviderCount: number;
  activeCount: number;
  expiredCount: number;
  convertedCount: number;
}

/** `GET /api/admin/trials`-এর ডেটা — read-only, কোনো লেখা নেই। */
export async function buildTrialReport(): Promise<TrialReport> {
  const now = new Date();

  const users = await db.user.findMany({
    where: { planExpiresAt: { not: null } },
    orderBy: { planExpiresAt: "desc" },
    select: {
      userId: true,
      name: true,
      email: true,
      plan: true,
      region: true,
      planExpiresAt: true,
      creditsBalance: true,
    },
  });

  if (users.length === 0) {
    return {
      accounts: [],
      domainClusters: [],
      publicProviderCount: 0,
      activeCount: 0,
      expiredCount: 0,
      convertedCount: 0,
    };
  }

  const paidRows = await db.paymentTransaction.groupBy({
    by: ["userId"],
    where: {
      userId: { in: users.map((user) => user.userId) },
      ...PAID_PLAN_PAYMENT_WHERE,
    },
  });

  const paid = new Set(paidRows.map((row) => row.userId));

  const accounts: TrialAccount[] = users.map((user) => ({
    userId: user.userId,
    name: user.name,
    email: user.email,
    emailDomain: user.email.split("@")[1]?.toLowerCase() ?? "",
    plan: user.plan,
    region: (user.region || "bd") as Region,
    planExpiresAt: user.planExpiresAt!,
    status: user.planExpiresAt! > now ? "active" : "expired",
    creditsBalance: user.creditsBalance,
    converted: paid.has(user.userId),
  }));

  const domainCounts = new Map<string, number>();
  let publicProviderCount = 0;

  for (const account of accounts) {
    if (PUBLIC_EMAIL_DOMAINS.has(account.emailDomain)) {
      publicProviderCount++;
      continue;
    }
    if (!account.emailDomain) continue;
    domainCounts.set(account.emailDomain, (domainCounts.get(account.emailDomain) ?? 0) + 1);
  }

  return {
    accounts,
    domainClusters: [...domainCounts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count),
    publicProviderCount,
    activeCount: accounts.filter((account) => account.status === "active").length,
    expiredCount: accounts.filter((account) => account.status === "expired").length,
    convertedCount: accounts.filter((account) => account.converted).length,
  };
}
