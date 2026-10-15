/**
 * মেয়াদ শেষের reminder — DRIPLARE AI (১৫.৭ · ধাপ D.২)
 * ─────────────────────────────────────────────────────────────────────────────
 * ── কেন এই ট্রিগারটি দরকার, শতাংশ-থ্রেশহোল্ড থাকা সত্ত্বেও ───────────────────
 * ৫০/৮০/৯০/১০০% alert মূলত credit-ভিত্তিক: "তোমার credit প্রায় শেষ"। কিন্তু
 * একজন merchant যিনি মাসে credit ফুর করান **না** (বা যিনি বার্ষিক কিনেছেন),
 * তিনি ওই চারটি থ্রেশহোল্ডের একটিও ছোঁন না — অথচ ৩০ বা ৩৬৫ দিন পরে তাঁর মেয়াদ
 * শেষ হবে এবং [`plan_expired`](reset-eligibility.ts) নিয়মে তাঁর credit নবায়ন
 * বন্ধ হয়ে যাবে, কেবল ব্যালান্স থাকলে AI চলতেই থাকবে।
 *
 * অর্থাৎ এই email-টিই নতুন নিয়মে **একমাত্র নবায়নের পথ** — যাঁরা credit-এ
 * আটকান না তাঁদের জন্য। না থাকলে "সেবা থেমে যাবে" নীতি তাঁদের কাছে হঠাৎ
 * নীরব চমক হয়ে আসত।
 *
 * ── ⚠️ এখানে একটি Int কলামে দুই রকম সংখ্যা রাখা হচ্ছে, এবং সেটি লুকানো নয় ──
 * [`UsageAlert`](../../prisma/schema/billing.prisma)-এর unique key
 * `[userId, cycleStart, threshold, channel]` — অর্থাৎ idempotency বিনামূল্যে
 * পাওয়া যায়, কিন্তু ওই কলামটি একটি `Int` ছাড়া আর কিছু নয়।
 *
 * এখানে থ্রেশহোল্ড **ঋণাত্মক** হিসেবে লেখা হয়: `-7` = "৭ দিন বাকি", `-1` =
 * "১ দিন বা তার কম"। কারণ:
 *   ১. শতাংশ থ্রেশহোল্ড কখনো ০ বা ঋণাত্মক নয় (`percent >= t`), তাই দুই অর্থ
 *      কখনো সংঘর্ষ করে না — একটি `%` আর একটি "দিন", এক কলামেই আলাদা থাকে।
 *   ২. চিহ্নটিই অর্থটি বলে দেয়: ধনাত্মক = "কত খরচ হলো", ঋণাত্মক = "কত সময় বাকি"।
 *   ৩. বিকল্প (একটি নতুন টেবিল বা কলাম) মানে **DDL**, এবং এই round-এ সেটি
 *      অনুমোদিত নয় — অথচ এখানে সংরক্ষণ করার দরকার কেবল "এটি পাঠানো হয়েছে"।
 *
 * ⚠️ এই ফাইলটি **pure** — কোনো DB নেই, তাই দিন-গণনা ও ক্রম test-যোগ্য। কারণ
 *    একটি ভুল দিন-গণনার ফল সরাসরি টাকা: merchant হয় আগেভাগে চাপে পড়েন, নয়
 *    না-জেনে সেবা হারান।
 */

/**
 * মেয়াদ শেষের কত দিন আগে জানানো হয় — **জরুরি ক্রমে** (১, ৩, ৭)।
 *
 * ⚠️ ক্রমটিই এর ব্যবহারের নিয়ম: নিচের `crossedThresholds` সবচেয়ে জরুরি দিনটি
 *    আগে দেয়। কারণ প্রতিটি মেসেজ সময়ের একটি **দাবি** — "৭ দিন বাকি" — আর
 *    সেটি ছাপার মুহূর্তে সত্য থাকতে হবে (নিচের নোট দেখুন)।
 */
export const RENEWAL_REMINDER_DAYS = [1, 3, 7] as const;

/**
 * মেয়াদ শেষ হওয়ার **পরে**ও এত দিন পর্যন্ত শেষ reminder-টি পাঠানো হয়।
 *
 * ⚠️ কারণ: cron একটি দিন বন্ধ থাকলেই যে merchant-এর মেয়াদ গতকাল শেষ
 *    হয়েছে তিনি একটি email-ও না পেয়ে সেবা হারাতেন। কিন্তু সীমাটি না থাকলে
 *    `planExpiresAt` অতীতে আটকে থাকা প্রতিটি পুরনো (বন্ধ হয়ে যাওয়া) অ্যাকাউন্টও
 *    প্রতি cycle-এ একটি email পেত — অর্থাৎ চিরকাল চলতে থাকা স্প্যাম, আর সেই
 *    সাথে একটি "আপনার সেবা শেষ" বার্তা যার কোনো মানে নেই।
 */
export const RENEWAL_GRACE_DAYS = 7;

/** একটি `UsageAlert` কী-র জন্য সংখ্যা: `-daysLeft`। */
export function reminderThreshold(days: number): number {
  return -Math.abs(days);
}

/**
 * এই threshold-টি একটি শতাংশ alert, নাকি একটি মেয়াদ-reminder?
 *
 * ⚠️ এই ফাংশনটি **অবশ্যই** প্রতিটি পড়ার জায়গায় ব্যবহার করতে হবে। একটি
 *    ঋণাত্মক threshold শতাংশ-পথে ঢুকে পড়লে `percent >= -7` সবসময় সত্য হত —
 *    অর্থাৎ প্রতিটি merchant প্রতিদিন একটি "credit শেষ" email পেতেন।
 */
export function isRenewalThreshold(threshold: number): boolean {
  return Number.isFinite(threshold) && threshold < 0;
}

/**
 * দুই সময়ের মাঝে **পুরো** দিন কত — নিচের দিকে গোল করা।
 *
 * ⚠️ **`floor`, `ceil` নয়** — এবং কারণটি দিক-নির্ভর: উপরে গোল করলে ৬.৫ দিন
 *    বাকি থাকা অবস্থায় "৭ দিন বাকি" লেখা যেত, অর্থাৎ merchant যে সময়টুকু
 *    আসলে নেই সেটুকু ধরে পরিকল্পনা করতেন এবং মেয়াদ শেষে হঠাৎ সেবা হারাতেন।
 *    নিচে গোল করলে লেখা হয় "৬ দিন বাকি", যা তিনি যে সময়টি সত্যিই পান তার
 *    চেয়ে কম নয় — ভুলটি সবসময় নিরাপদ দিকে।
 */
export function daysUntil(now: Date, target: Date): number {
  const ms = target.getTime() - now.getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/**
 * মেয়াদ কত দূর — সব নিয়ম মিলিয়ে। `null` = এই merchant-কে জানানোর কিছু নেই।
 *
 * `null` ফেরে যখন:
 *  - `planExpiresAt` নেই (এবং এটি একটি সাধারণ অবস্থা, ব্যতিক্রম নয়: এই কলামের
 *    কোনো default নেই, তাই প্রতিটি নতুন user-এর মান `NULL`)। **`NULL` মানে
 *    "মেয়াদ নেই", "মেয়াদ শেষ" নয়** — এই পার্থক্যটিই `plan_expired` নিয়মকে
 *    নিরাপদ করেছে, এবং এখানেও ঠিক সেই পার্থক্যের উপর ভরসা করা হলো। না হলে
 *    যে merchant কখনো কোনো মেয়াদ পাননি তিনি "আপনার মেয়াদ শেষ" email পেতেন।
 *  - মানটি অবৈধ (`Invalid Date`) — একটি ভাঙা তারিখ একটি বানানো তারিখ থেকে খারাপ।
 *  - মেয়াদ এখনো জানানোর মতো কাছে আসেনি (> ৭ দিন বাকি)।
 *  - জানালাটি পুরোপুরি পার হয়ে গেছে (> ৭ দিন আগে শেষ)।
 */
export function resolveRenewalWindow(
  now: Date,
  planExpiresAt: Date | null | undefined
): { daysLeft: number; crossed: number[] } | null {
  if (!planExpiresAt) return null;
  if (Number.isNaN(planExpiresAt.getTime())) return null;

  const daysLeft = daysUntil(now, planExpiresAt);
  const most = RENEWAL_REMINDER_DAYS[RENEWAL_REMINDER_DAYS.length - 1];

  // এখনো অনেক দূরে, অথবা জানালাটি বহু আগে পার — দুই ক্ষেত্রেই কিছু পাঠানো হয় না
  if (daysLeft > most || daysLeft < -RENEWAL_GRACE_DAYS) return null;

  return { daysLeft, crossed: crossedThresholds(daysLeft) };
}

/**
 * `daysLeft` থেকে ছোঁয়া-পড়া threshold-গুলো — **জরুরি আগে** (১, ৩, ৭ …)।
 *
 * ── ⚠️ শতাংশ-পথের সাথে এটি উল্টো দিকে যায়, এবং সেটি ইচ্ছাকৃত ────────────────
 * [usage-alerts.ts](lib/services/usage-alerts.ts)-এ শতাংশ থ্রেশহোল্ড **সবগুলোই**
 * পাঠানো হয়, ছোট থেকে বড় (৫০ → ৮০ → ৯০ → ১০০), যাতে merchant ধাপে ধাপে
 * বাড়তে থাকা চাপ দেখেন। কারণ ওখানে প্রতিটি বার্তা একটি **অবস্থা** — "তুমি ৮০%
 * খরচ করেছ" — যা ছাপার পরে বদলায় না, তাই তিনটি একসাথে সত্য।
 *
 * এখানে প্রতিটি বার্তা একটি **সময়ের দাবি** — "৭ দিন বাকি" — এবং সেটি পরের
 * দিনেই মিথ্যা হয়ে যায়। তাই তিনটি একসাথে পাঠানো মানে ৩ দিন বাকি থাকা
 * merchant-এর কাছে "৭ দিন বাকি" লেখা একটি email, অর্থাৎ সরাসরি মিথ্যা।
 * একারণে ক্রমটি জরুরি-আগে, আর caller কেবল **প্রথম অদাবিকৃত**টি পাঠায় —
 * ফলে cron এক সপ্তাহ বন্ধ থাকলে তিনি একটি সৎ বার্তা পান, তিনটি অসৎ নয়।
 */
export function crossedThresholds(daysLeft: number): number[] {
  return RENEWAL_REMINDER_DAYS.filter((days) => daysLeft <= days).map(reminderThreshold);
}

/**
 * reminder-এর জন্য একটি সৎ লেখা "কত দিন বাকি"।
 *
 * ⚠️ থ্রেশহোল্ড থেকে নয়, **আসল `daysLeft` থেকে** — নইলে উপরের পুরো যুক্তিটিই
 *    ব্যর্থ হয় (`-1` থ্রেশহোল্ড চার দিন বাকি থাকা অবস্থায়ও পাঠানো যেতে পারে
 *    যদি cron দেরি করে, আর তখন "১ দিন বাকি" লেখা মিথ্যা হত)।
 */
export type RenewalPhrase =
  | { kind: "expired"; daysAgo: number }
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "days"; days: number };

export function describeRenewal(daysLeft: number): RenewalPhrase {
  if (daysLeft < 0) return { kind: "expired", daysAgo: -daysLeft };
  if (daysLeft === 0) return { kind: "today" };
  if (daysLeft === 1) return { kind: "tomorrow" };
  return { kind: "days", days: daysLeft };
}
