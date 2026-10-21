/**
 * Reset Eligibility — কোন user-এর plan allowance প্রতি cycle-এ নবায়ন হবে
 * ─────────────────────────────────────────────────────────────────────────────
 * ১৫.৯ — 🔴 যে জায়গায় ছিল মাসে ৳৯০,০০০ leak।
 *
 * আগে `app/api/cron/reset-credits/route.ts` **একটি payment-ও দেখত না**; একমাত্র
 * শর্ত ছিল `creditsResetDate <= now`, আর নতুন user-এর `creditsResetDate`
 * ডিফল্টই `now()` (`prisma/schema/auth.prisma`)। অর্থাৎ যে কেউ sign-up করে
 * একটি channel connect করলেই — এক টাকাও না দিয়ে — প্রতি ৩০ দিনে BD Starter-এর
 * ১৫,০০০ credit পেত, চিরকাল। derivation-এ (১৫.২) ১৫,০০০ credit ≈ ৳৯০০ খরচ,
 * তাই ১০০ non-converting trial = মাসে ৳৯০,০০০, কোনো revenue ছাড়াই।
 *
 * সিদ্ধান্ত (২০২৬-১০-১৫, ইউজারের অনুমোদিত): **ever-paid** — যার ইতিহাসে একটি
 * paid ও refund-না-হওয়া plan payment আছে সে-ই যোগ্য; যে কখনো টাকা দেয়নি সে নয়।
 *
 * ⚠️ কেন "এই cycle-এ টাকা দিয়েছে" (৩০-দিনের উইন্ডো) নয়: এই প্ল্যাটফর্মে
 *    **recurring billing বলে কিছু নেই** — প্রতিটি plan কেনাকাটা এক-বারের
 *    `PaymentTransaction` আর নবায়নের কোনো রেল নেই। উইন্ডোভিত্তিক নিয়ম দিলে
 *    প্রথম মাসের পর **প্রতিটি পরিশোধকারী merchant** skip হয়ে যেতেন, অর্থাৎ
 *    leak বন্ধ করতে গিয়ে প্রোডাক্টটাই ভাঙত।
 *
 * ⚠️ unknown/legacy plan key → **যোগ্য** (fail-safe)। `isPaidPlan`-এর মতো একই
 *    দিক ও একই কারণ: দ্বিধাটি অসম — ভুল করে একজন পরিশোধকারীর credit বন্ধ করা,
 *    ভুল করে একজন free user-কে একটু বেশি দেওয়ার চেয়ে অনেক খারাপ।
 */

import { getPlanIfDefined } from "@/lib/domain/plan-config";
import type { Region } from "@/lib/core/region";

/**
 * কেন reset হলো / হলো না — admin-এর response payload-এ এই কারণটাই দেখানো হয়।
 *
 * ⚠️ কারণ এতগুলি আলাদা কেন: `processed` আর `granted`-এর ফারাক দেখিয়ে কিছু
 *    না বললে admin জানতেন না **কেন** কেউ বাদ পড়ল। TASK-06-এর নীতি: যে panel
 *    সত্যি বলতে পারে না, সেটি না থাকার চেয়ে খারাপ — কারণ একটি নীরব skip
 *    সমান ফারাক (নীরব leak) নতুন করে জন্ম দেয়।
 */
export type ResetReason =
  | "ever_paid" //            ✅ paid plan payment আছে (refund হয়নি)
  | "free_plan" //            ✅ এই region-এ plan-এরই দাম ০ (Global Starter)
  | "unknown_plan" //         ✅ plan key এই region-এর ক্যাটালগেই নেই (legacy)
  | "refunded" //             ⛔ টাকা ফেরত গেছে, আর জীবিত payment নেই
  | "plan_expired" //         ⛔ কেনা মেয়াদ শেষ, নবায়ন হয়নি (১৫.৭)
  | "negotiated_unpaid" //    ⛔ নেগোসিয়েটেড tier, কোনো payment নেই
  | "never_paid"; //          ⛔ কখনো টাকা দেননি — এটিই একমাত্র আসল ছিদ্র

export interface ResetEligibility {
  eligible: boolean;
  reason: ResetReason;
}

export interface ResetEligibilityInput {
  /** `User.plan` — কাঁচা মান, resolve করা নয় (resolve এখানেই হয়)। */
  plan: string;
  region: Region;
  /** paid **এবং** refund হয়নি, এমন `plan`/`invoice_plan` payment আছে কি। */
  hasPaidPlanPayment: boolean;
  /** কোনো plan payment refund হয়ে গেছে কি (`refundStatus === "refunded"`)। */
  hasRefundedPayment: boolean;
  /**
   * `User.planExpiresAt` — কেনা মেয়াদের শেষ (১৫.৭)।
   *
   * ⚠️ `null` মানে **মেয়াদ নেই**, "মেয়াদ শেষ" নয়। Schema-তে এই কলামের কোনো
   *    default নেই (`DateTime?`, `prisma/schema/auth.prisma`), অর্থাৎ প্রতিটি
   *    নতুন user NULL নিয়ে জন্মায়। NULL-কে অতীত ধরে নিলে প্রতিটি নতুন free
   *    user সাথে সাথে অযোগ্য হয়ে যেত, আর Global-এর free tier (যার নবায়নের
   *    আর কোনো পথ নেই — সেখানে gateway-ই নেই) চিরকাল ৫০০ credit-এ আটকে যেত।
   */
  planExpiresAt: Date | null;
  /** এখনকার মুহূর্ত — পরীক্ষায় বসানোর জন্য প্যারামিটার। */
  now: Date;
}

/**
 * এই user-এর credit allowance এই cycle-এ নবায়ন করা হবে কি না।
 *
 * ক্রমটাই নিয়ম, এবং প্রতিটি ধাপের একটি কারণ আছে:
 *
 *  ১. **refund হয়েছে আর নতুন payment নেই** → অযোগ্য। টাকা আমাদের কাছে নেই। ⚠️
 *     পাশের `!hasPaidPlanPayment` শর্তটি অপরিহার্য: যিনি টাকা দিয়ে refund নিয়ে
 *     **আবার** টাকা দিয়েছেন, তিনি একজন পরিশোধকারী — "একবার refund হয়েছিল"
 *     দেখে তাঁকে skip করা ভুল হত। (১৫.৯-এ এই অর্থটি ধাপ ২ ও ৩-এর **ক্রম** দিয়ে
 *     রক্ষা করা হত; এখন তত্ত্বটি স্পষ্ট শর্তে লেখা।)
 *  ২. **কেনা মেয়াদ শেষ, নবায়ন হয়নি** (১৫.৭) → অযোগ্য। নিচে আলাদা করে ব্যাখ্যা।
 *     ⚠️ `ever_paid`-এর **আগে**, কারণ উল্টো হলে এই নিয়মটি কখনোই চলত না — যে
 *     merchant-এর মেয়াদ শেষ হয়েছে তিনি নিশ্চিতভাবেই অনেক দিন আগে টাকা দিয়েছিলেন,
 *     অর্থাৎ `hasPaidPlanPayment` তাঁর জন্য সবসময় true। নিয়মটি শেষে বসালে ঠিক
 *     সেই merchant-দের জন্যই সেটি নিষ্ক্রিয় থাকত, যাঁদের জন্য লেখা হলো।
 *  ৩. **জীবিত payment** → যোগ্য (`ever_paid`)।
 *  ৪. **plan key অজানা/legacy** → যোগ্য (fail-safe, উপরের মন্তব্য)।
 *  ৫. **এই region-এ plan-এর দাম ০** → যোগ্য (`free_plan`)। আকর্ষণীয়ভাবে এটি
 *     **আবশ্যক**: Global Starter-এর দামই ০ আর Global-এ gateway-ই নেই — অর্থাৎ
 *     "টাকা দেননি" বলে আটকালে ওই free tier চিরকালের জন্য ৫০০ credit-এ আটকে যেত,
 *     নবায়নের কোনো পথ ছাড়াই।
 *  ৬. **নেগোসিয়েটেড tier, payment নেই** → অযোগ্য। ⚠️ `contact: true` মানে দাম
 *     **জানা নেই**, শূন্য নয় — `plan-revenue.ts`-এর "unknown ≠ 0" নীতিই এখানে।
 *     ভুল করে শূন্য ধরে নিলে (ধাপ ৫-এর আগে না থামলে) একজন চুক্তিভিত্তিক
 *     Enterprise, যাঁকে admin invoice ছাড়া plan দিয়েছেন, প্রতি মাসে ১,৫০,০০০
 *     credit পেতেন — একটিই অ্যাকাউন্টে মাসে ≈ ৳৯,০০০, চিরকাল।
 *  ৭. নাহলে → অযোগ্য। দাম আছে, টাকা নেই — এটিই আসল ছিদ্রটি।
 *
 * ─── ধাপ ২ আলাদা করে: কেন এটি ছিল দরকার (১৫.৭-এর কেন্দ্র) ────────────────────
 * এই ফাইলটি ১৫.৯-এ **ever-paid** নিয়মে জন্মেছিল: যে একবার ৳৯৯৯ দিয়েছেন তিনি
 * **প্রতি ৩০ দিনে ১৫,০০০ credit চিরকাল** পান, আর `planExpiresAt` কেউ পড়ত না।
 * ফল: credit কখনো সত্যিই শেষ হয় না, "বট বন্ধ হয়ে যাবে" নীতির কোনো দাঁত থাকে না,
 * আর বার্ষিক plan-এর কোনো অর্থই থাকে না (১২ মাসের credit একবারে নিলেও মেয়াদ
 * শেষে কিছুই বদলায় না)।
 *
 * ⚠️ **কেন `planExpiresAt` কেবল "টাকার গন্ধ আছে" এমন plan-এ খাটে** (`paidShape`)।
 *    নিয়মটি এক বাক্যে: **যে টাকা দেওয়া হয়েছে, সেটিই শেষ হতে পারে — যেখানে টাকা
 *    নেই, সেখানে ফুরানোর কিছু নেই।** তিনটি ফল, আর তিনটিই দরকার:
 *      • Global free Starter (দাম ০): admin কোনোদিন `setUserPlan` চালালে তার
 *        `planExpiresAt` বসে যেত — আর তখন মেয়াদ শেষ হলে ওই free tier চিরকালের
 *        জন্য বন্ধ হয়ে যেত, অথচ ধাপ ৫ ঠিক সেটি আটকাতেই লেখা।
 *      • legacy `growth`/`pro` (এই region-এ অজানা): ওদের মেয়াদও বসানো আছে,
 *        কিন্তু আমরা ওদের cycle-ই জানি না — fail-safe নীতিতে ছেড়ে দেওয়া হয়।
 *      • নেগোসিয়েটেড (`contact`) tier: ধাপ ৬ যেভাবেই হোক আটকায়।
 *
 * ⚠️ **জানা সীমা (ইচ্ছাকৃত, লুকানো নয়):** ধাপ ৬ একজন comp-করা অ্যাকাউন্টকেও
 *    ধরে (admin `setUserPlan` দিয়ে যাঁকে ভালোবেসে plan দিয়েছেন, কোনো
 *    `PaymentTransaction` ছাড়া)। তাঁর ব্যালান্স **শূন্য হয় না** — skip মানে
 *    balance অপরিবর্তিত, আর `creditsResetDate` কেবল এগোয়। তাই তিনি মাঝ-সাইকেলে
 *    হারান না; কেবল নবায়ন পান না, আর admin response-এর `skippedByReason`-এ
 *    সেটি দেখতে পান। প্রতিকারও আছে, এবং admin-এর হাতেই: আরেকবার `setUserPlan`
 *    (নতুন cycle) বা admin top-up। বিকল্পটি ছিল "admin-এর দেওয়া plan-ও যোগ্য
 *    ধরা" — কিন্তু তাহলে trial user-কে admin plan "দিলে" ছিদ্রটি আবার খুলত,
 *    অর্থাৎ bypass-টি গ্রাহকের অনুরোধে খোলা যেত। অর্থ সবসময় ledger-এ থাকবে।
 */
export function isResetEligible(input: ResetEligibilityInput): ResetEligibility {
  const config = getPlanIfDefined(input.region, input.plan);

  // "এই plan-এ সত্যিই টাকা লাগে" — ধাপ ০ কেবল তখনই খাটবে।
  const paidShape = config !== null && config.contact !== true && config.price > 0;

  // ── আমি ও আমার টাকা — ক্রমটাই এই ফাইলের মূল নিয়ম ───────────────────────────
  //
  // তিনটি প্রশ্ন, তিনটি নির্দিষ্টতা: (১) টাকা কি ফেরত গেছে? (২) কেনা মেয়াদ কি
  // শেষ? (৩) জীবিত payment আছে কি? ধাপ ১ সবার আগে কারণ সেটিই সবচেয়ে নির্দিষ্ট
  // ও সবচেয়ে তদন্তযোগ্য কারণ — "টাকা ফেরত গেছে" জানলে admin ঠিক কী ঘটেছে
  // বুঝতে পারেন, "মেয়াদ শেষ" বললে শুধু ফলের কথা জানেন।
  //
  // ⚠️ `!hasPaidPlanPayment` শর্তটি **বাদ দেওয়া যাবে না**, আর এটি `ever_paid`-এর
  //    ক্রম-নিয়মেরই রূপ: যিনি টাকা দিয়ে refund নিয়ে **আবার** টাকা দিয়েছেন,
  //    তিনি একজন পরিশোধকারী। এই শাখাটিকে উপরে তুলে সেই রক্ষাটি হারালে ঠিক
  //    সেই মানুষটিই বাদ পড়তেন — তিনিই সবচেয়ে কম বাদ-পড়ার যোগ্য।
  if (!input.hasPaidPlanPayment && input.hasRefundedPayment) {
    return { eligible: false, reason: "refunded" };
  }

  if (
    paidShape &&
    input.planExpiresAt !== null &&
    !Number.isNaN(input.planExpiresAt.getTime()) &&
    input.planExpiresAt.getTime() <= input.now.getTime()
  ) {
    return { eligible: false, reason: "plan_expired" };
  }

  if (input.hasPaidPlanPayment) {
    return { eligible: true, reason: "ever_paid" };
  }

  if (!config) {
    return { eligible: true, reason: "unknown_plan" };
  }

  // ⚠️ ধাপ ৪ ও ৫-এর ক্রম অপরিবর্তিত থাকতে হবে: `contact: true` plan-এর
  //    `price`-ও ০, তাই আগে নেগোসিয়েটেড কিনা দেখতে হয়।
  if (config.contact === true) {
    return { eligible: false, reason: "negotiated_unpaid" };
  }

  if (config.price === 0) {
    return { eligible: true, reason: "free_plan" };
  }

  return { eligible: false, reason: "never_paid" };
}
