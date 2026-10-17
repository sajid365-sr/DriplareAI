/**
 * WhatsApp channel-এর নিজস্ব খরচ — বিশুদ্ধ নিয়ম (১৫.৮)
 * ─────────────────────────────────────────────────────────────────────────────
 * ২০২৬-১০-০১ থেকে Meta **service message**-ও billable করেছে — অর্থাৎ গ্রাহকের
 * প্রশ্নের জবাবে আপনার AI যা পাঠায়, সেটিও। প্রতি নাম্বারে মাসে ১,০০০ ফ্রি,
 * তারপর বিল। সুতরাং WhatsApp-এর একটি reply-এর খরচ দুই ভাগে: (১) LLM টোকেন,
 * (২) Meta-র service-message ফি। প্রথমটি আগেই credit-এ ধরা আছে; এই ফাইলটি
 * দ্বিতীয়টির হিসাব।
 *
 * ── কেন ফি-টি credit-এ ফোল্ড করা হচ্ছে (নতুন চার্জ নয়) ──────────────────────
 * merchant-এর সাথে ইতিমধ্যেই একটি নির্দিষ্ট plan-দামে চুক্তি হয়ে গেছে। তাই
 * "Meta-র জন্য আলাদা বিল" পাঠানো যেত না — সেটি চুক্তি ভাঙা, আর বাস্তবে কেউ
 * মেনে নিত না। বদলে surcharge-টি **credit-এ** বসে, কারণ credit-ই সেই একক
 * মুদ্রা যা merchant ইতিমধ্যেই কিনছেন এবং যা তাঁর ড্যাশবোর্ডে দেখতে পান।
 *
 * ── ⚠️ তিনটি ফাঁদ, যেগুলো এই ফাইলটি আটকায় ──────────────────────────────────
 *   ১. **`0 ÷ 0 = NaN`।** Global-এর free Starter-এর দাম ৳০, তাই `bdtPerCredit`
 *      শূন্য হতে পারে। তখন `fee / 0 = Infinity` বা `0/0 = NaN`, আর `Math.ceil`
 *      সেটিকে `NaN` করেই credit-এ পাঠিয়ে দিত — অর্থাৎ `creditsSpent: NaN`।
 *      তারপর `creditsBalance` থেকে `NaN` বিয়োগ হলে ব্যালেন্স **চিরতরে** নষ্ট
 *      হত (Prisma `decrement: NaN` throws, কিন্তু ভুল পথে গেলে মান বিষিয়ে যেত)।
 *   ২. **ভাগফল `ceil`, `round` নয়** — এবং সর্বনিম্ন ১। একটি reply-তে ০ credit
 *      নেওয়া মানে Meta-র পুরো খরচ আমাদের ঘাড়ে; অথচ এখানে হিসাবটি টাকার, তাই
 *      ছোট দিকে গোল করলে জমা হয়ে ঘাটতি তৈরি হত।
 *   ৩. **ফ্রি tier-টি গোনা হয় আগের বার্তাগুলো দিয়ে, বর্তমানটি দিয়ে নয়** —
 *      `whatsappSurchargeCredits`-এ `messagesBeforeThisOne` নামটিই সেটি মনে
 *      করিয়ে দেয়। বিস্তারিত কারণ কল-সাইটে (`charge-usage.ts`-এ) লেখা আছে।
 *
 * ⚠️ এই ফাইলে **কোনো `server-only` নেই, কোনো DB নেই** — এবং সেটাই ইচ্ছাকৃত।
 *    হিসাবের নিয়মটি ইতিমধ্যে তিনবার ভুল হওয়ার সুযোগ নিয়েছিল, তাই তার প্রতিটি
 *    সীমানা unit test দিয়ে ধরা আছে (`whatsapp-cost.test.ts`)।
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Meta-র ফ্রি tier — প্রতি **নাম্বরে**, প্রতি মাসে।
 *
 * ⚠️ "প্রতি user-এ" নয়, "প্রতি chatbot-এ"ও নয় — Meta E.164 ফোন নাম্বার ধরে
 *    গোনে। আমাদের কোডে একটি chatbot ≈ একটি integration ≈ একটি নাম্বার, তাই ডাকার
 *    সময় `chatbotId` ধরে গোনা হয়। একটি chatbot-এ দুটি নাম্বার যুক্ত থাকলে সে
 *    ২,০০০ ফ্রি পাবে — ইচ্ছাকৃতভাবে উদার দিকে ঝোঁকা, কারণ ভুলের দুই দিক সমান
 *    নয়: **বেশি নিলে merchant বিশ্বাস হারান, কম নিলে আমরা সামান্য খরচ বহন করি।**
 */
export const FREE_MESSAGES_PER_CYCLE = 1000;

// ─── Cycle window ─────────────────────────────────────────────────────────────

/**
 * WhatsApp-এর ফ্রি-tier জানালার শুরু = **ক্যালেন্ডার মাস**, credit-চক্র নয়।
 *
 * ⚠️ এখানে ইচ্ছে করে credit-চক্র (`creditsResetDate − ৩০ দিন`) নেওয়া হয়নি,
 *    যদিও বাকি সারা কোডবেসে সেটিই "চক্র"। কারণ ফ্রি tier-টি **Meta-র নিজের**
 *    নিয়ম, আর Meta তার মাস-ভিত্তিক জানালাতেই গোনে। আমাদের চক্র ধরে গুনলে এমন
 *    একটি জানালায় দুই মাসের বার্তা জমে যেত, আর তখন আমরা **বেশি** চার্জ করতাম —
 *    যেটি ভুলের খারাপ দিক।
 *
 * ⚠️ UTC-তে গোনা হয়। Meta-র মাস বাংলাদেশে (UTC+6) সরে যেতে পারে, তাই মাসের
 *    প্রথম কয়েক ঘণ্টায় হিসাব ±১ দিনের মতো নড়তে পারে। এর প্রভাব কেবল ১,০০০-এর
 *    সীমানার ঠিক আশেপাশে, অর্থাৎ কয়েকটি বার্তায় — আর সেটি সহনীয়।
 *
 * @example
 * currentWhatsappCycleStart(new Date("2026-10-16T05:00:00Z"))
 * // 2026-10-01T00:00:00.000Z
 */
export function currentWhatsappCycleStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

// ─── Surcharge ────────────────────────────────────────────────────────────────

export interface SurchargeInput {
  /**
   * ⚠️ এই বার্তাটি **বাদ দিয়ে**, তার আগে ওই chatbot থেকে যতটি WhatsApp বার্তা
   *    গেছে। নামটি এত লম্বা কারণ ঠিক এই একটিই জায়গায় off-by-one লুকিয়ে ছিল:
   *    গণনাটি `AIUsageLog` থেকে হয়, আর বর্তমান বার্তার row-টি তোলে তার **পরে**
   *    (একই লেনদেনের শেষ ধাপে) — তাই এখানে আসা সংখ্যাটি স্বাভাবিকভাবেই
   *    "নিজেকে বাদ দিয়ে"।
   */
  messagesBeforeThisOne: number;
  /**
   * Meta-র service-message ফি প্রতি বার্তায় (৳) — admin-নিয়ন্ত্রিত।
   * ⚠️ **`0` = surcharge বন্ধ**, এবং এটিই ডিফল্ট। কারণ হারটি যাচাই না করে
   *    চালু করলে নীরবে ভুল টাকা কাটা শুরু হত।
   */
  feePerMessageBdt: number;
  /**
   * plan-এর দাম ÷ তার credit — অর্থাৎ ওই merchant-এর কাছে এক credit-এর নগদ মূল্য (৳)।
   * ⚠️ **কখনো হার্ডকড নয়।** ক্যাটালগ থেকে আসে (`resolveListPrice`), নইলে admin
   *    দাম বদলালে এই সংখ্যাটি মিথ্যা হয়ে যেত আর হিসাবটি তখনো ঠিক দেখাত।
   */
  bdtPerCredit: number;
  /** না দিলে `FREE_MESSAGES_PER_CYCLE`। admin panel থেকে বদলানো যায়। */
  freeMessages?: number;
}

/**
 * একটি WhatsApp reply-এর জন্য বাড়তি credit — ফ্রি tier পার হওয়ার পর।
 *
 * @example
 * // BD Starter: ৳৯৯৯ ÷ ১৫,০০০ credit = ৳০.০৬৬ প্রতি credit,
 * // আর Meta-র ফি ৳০.৫৪ → ceil(০.৫৪ / ০.০৬৬) = ৯ credit
 * whatsappSurchargeCredits({
 *   messagesBeforeThisOne: 1200,
 *   feePerMessageBdt: 0.54,
 *   bdtPerCredit: 999 / 15000,
 * }); // 9
 *
 * // ফ্রি tier-এর ভেতরে — শূন্য
 * whatsappSurchargeCredits({
 *   messagesBeforeThisOne: 999,
 *   feePerMessageBdt: 0.54,
 *   bdtPerCredit: 0.0666,
 * }); // 0
 */
export function whatsappSurchargeCredits(input: SurchargeInput): number {
  // ── ফ্রি tier ──────────────────────────────────────────────────────────────
  // ⚠️ অগণিত বা **ঋণাত্মক** মানকে ডিফল্টে (১০০০) ফেরানো হয়, শূন্যে চাপানো হয়
  //    না। কারণ দুই ভুলের দিক সমান নয়:
  //      • শূন্যে চাপালে প্রতিটি merchant প্রথম বার্তা থেকেই চার্জ খেতেন —
  //        একটি ভাঙা config-এর দাম তাঁরা দিতেন।
  //      • ডিফল্টে ফিরলে বরং ফ্রি tier অটুট থাকে — খরচ কিছুটা আমাদের ঘাড়ে,
  //        যা এই নকশার ঘোষিত পক্ষপাত।
  //    আর `0` বৈধ: admin সচেতনভাবে "ফ্রি tier নেই" চাইতে পারেন, তাই শূন্য
  //    চাপা পড়ে না (এবং তখন প্রথম বার্তাটিই বিল-যোগ্য)।
  const configured = input.freeMessages;
  const freeMessages =
    typeof configured === "number" && Number.isFinite(configured) && configured >= 0
      ? Math.floor(configured)
      : FREE_MESSAGES_PER_CYCLE;

  const sent = Number.isFinite(input.messagesBeforeThisOne) ? input.messagesBeforeThisOne : 0;
  if (sent < freeMessages) return 0;

  // ── kill-switch ────────────────────────────────────────────────────────────
  // `0` মানে "এখনো চালু করা হয়নি" — ডিফল্টটিই এটি। `isFinite` গার্ডটি না থাকলে
  // `NaN` ফি হয়ে credit-এ ঢুকে ব্যালেন্স বিষিয়ে দিত।
  const fee = input.feePerMessageBdt;
  if (!Number.isFinite(fee) || fee <= 0) return 0;

  // ── ভাগ-নিরাপত্তা ──────────────────────────────────────────────────────────
  // Global-এর free Starter (৳০) বা `contact: true` plan-এ `bdtPerCredit` শূন্য।
  // এখানে থামা বাধ্যতামূলক, নইলে `Infinity`/`NaN` credit হয়ে যেত।
  const perCredit = input.bdtPerCredit;
  if (!Number.isFinite(perCredit) || perCredit <= 0) return 0;

  // ceil, round নয় — আর কখনো ০ নয়। কারণ দেখতে ফাইলের হেডারে (ফাঁদ ২)।
  const credits = Math.ceil(fee / perCredit);
  return credits > 0 ? credits : 0;
}

/**
 * plan-এর দাম ও তার credit থেকে "প্রতি credit-এর নগদ মূল্য"।
 *
 * ⚠️ কোনো একটা ইনপুট শূন্য বা অগণিত হলে `0` ফেরত যায় — এবং তারপর
 *    `whatsappSurchargeCredits` নিজেই থেমে যায়। অর্থাৎ **শূন্য-দামের plan-কে
 *    কখনো surcharge করা হয় না**, যা সঠিক: যে plan-এর জন্য merchant কিছুই দেন
 *   নি, সেখানে "খরচ ভাগ করে নেওয়ার" প্রশ্নই ওঠে না।
 */
export function bdtPerCreditFrom(planPriceBdt: number, includedCredits: number): number {
  if (!Number.isFinite(planPriceBdt) || planPriceBdt <= 0) return 0;
  if (!Number.isFinite(includedCredits) || includedCredits <= 0) return 0;
  return planPriceBdt / includedCredits;
}
