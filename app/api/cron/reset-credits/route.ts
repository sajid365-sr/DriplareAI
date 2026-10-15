import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { CYCLE_DAYS } from "@/lib/domain/billing-cycle";
import { getPlanCredits } from "@/lib/domain/credit-config";
import { PAID_STATUSES } from "@/lib/domain/payment-status";
import { isResetEligible, type ResetReason } from "@/lib/domain/reset-eligibility";
import type { Region } from "@/lib/core/region";

/**
 * Cron Job: Monthly Credit Reset
 *
 * Vercel Cron (vercel.json): `0 1 * * *` → `/api/cron/reset-credits`
 *
 * যে users-দের `creditsResetDate` আজ বা তার আগে, তাদের নতুন cycle শুরু হয়:
 * plan-এর allowance নতুন করে বসে, কিন্তু **top-up credit roll over করে**
 * (ওগুলো টাকায় কেনা, মেয়াদোত্তীর্ণ হওয়া উচিত নয়)।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ১৫.৯ — আগে এই endpoint **একটি payment-ও দেখত না**। একমাত্র শর্ত ছিল
 *    `creditsResetDate <= now`, আর নতুন user-এর `creditsResetDate` ডিফল্টই
 *    `now()`। অর্থাৎ sign-up করা মাত্রই যে কেউ — এক টাকাও না দিয়ে — প্রতি
 *    ৩০ দিনে BD Starter-এর ১৫,০০০ credit পেত, চিরকাল (derivation-এ ≈ ৳৯০০
 *    খরচ প্রতি cycle; ১০০ non-converting trial = মাসে ৳৯০,০০০)।
 *
 *    এখন যোগ্যতা যাচাই হয় `isResetEligible` দিয়ে, অর্থাৎ decision-নিয়মটি
 *    `lib/domain/reset-eligibility.ts`-এ — pure, test-এ চলে, কারণ এখানে
 *    (route-এ) সেটি লেখা থাকলে কোনো test কখনো তাকে ধরতে পারত না।
 *
 *    ⚠️ **skip হলে credit স্পর্শ করা হয় না** — কেবল ঘড়িটি এগোয়। ব্যালান্স
 *    শূন্য করা ধ্বংসাত্মক ও অপ্রয়োজনীয় দুটোই: সেবা বন্ধ করা যায় paused bot
 *    দিয়ে (১৫.৬), আর পুনরায় গ্রাহক হওয়ার দিনে টাকা দিয়ে নতুন cycle-ই শুরু হয়।
 *
 *    ⚠️ ঘড়ি **সবার** জন্য এগোয়, যোগ্য হোক বা না হোক — নইলে বাদ-পড়া
 *    user-রা প্রতিদিন পুনরায় স্ক্যান হত, আর `processed` সংখ্যাটা অর্থহীন
 *    হয়ে যেত (প্রতিদিন ১০০ জন, অথচ কেউ কখনো "granted" নয়)।
 *
 *    ⚠️ **সৎ সীমা:** TASK-22 এখনো বাকি (Clerk `/api/cron/*` আটকায়), অর্থাৎ
 *    এই cron আজ প্রোডাকশনে চলে না। তাই এটিই land করার নিরাপদ সময় — ছিদ্রটি
 *    সক্রিয় হওয়ার আগেই ঢাকনাটি বসছে, আর যাচাই হয় unit test দিয়ে।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ১৫.৭ — 🔴 **মেয়াদ-ভিত্তিক reset** (এটিই এই cron-এর সবচেয়ে বড় পরিবর্তন)
 *
 * ১৫.৯-এর "ever-paid" নিয়মে একটি ফাঁক রয়ে গিয়েছিল: যে একবার ৳৯৯৯ দিয়েছেন তিনি
 * প্রতি ৩০ দিনে পূর্ণ allowance পেতেন **চিরকাল**, আর `planExpiresAt` কেউ পড়তই না।
 * ফলে credit কখনো সত্যিই শেষ হয় না, "বট বন্ধ হয়ে যাবে" নীতির কোনো দাঁত থাকে না,
 * আর বার্ষিক plan-এর কোনো অর্থই থাকে না।
 *
 * এখন `isResetEligible`-এ `planExpiresAt` পাঠানো হয়, আর মেয়াদ পার হলে কারণটি
 * `plan_expired` — অর্থাৎ **নবায়ন হয় না**। ⚠️ এর ফল শূন্য নয়, **স্থবিরতা**:
 * ব্যালান্স অপরিবর্তিত থাকে, আর মেয়াদোত্তীর্ণ merchant-এর credit যদি শূন্য হয়
 * তবে বিদ্যমান quota-guard নিজেই AI থামিয়ে দেয়। তাই নতুন কোনো "pause" যুক্তি
 * বা নতুন cron শাখা লাগে না — সবচেয়ে ছোট ও সবচেয়ে সৎ রূপ এটিই।
 *
 * ⚠️ **ট্রিপওয়্যার:** এই route-এ যেন `planExpiresAt` **সবসময় select করা হয়**।
 *    একটি তৃতীয় reset-path জন্মালে (নতুন কোনো route বা নতুন এমন query যা
 *    `creditsResetDate` দেখে) সেটি এই নিয়মটি বাদ দিয়ে যাবে, আর কোনো test ধরবে
 *    না — কারণ প্রোডাকশনে cron চলে না (TASK-22)। তাই নিয়মটি একটিই জায়গায়
 *    (`lib/domain/reset-eligibility.ts`) থাকবে, আর প্রতিটি caller সেটিই ডাকবে।
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * ⚠️ চক্রের দৈর্ঘ্য এখন `lib/domain/billing-cycle.ts`-এ — এখানে স্থানীয় `30`
 *    রাখা হয় না। কারণটি ১৫.৭-এ স্পষ্ট হলো: বার্ষিক plan যোগ করার মুহূর্তে দুই
 *    জায়গায় দুই সংখ্যা থাকলে একটিতে ৩৬৫ লেখা হয়ে যেত, আর একটি merchant-এর
 *    credit মাসের বদলে বছরে একবার নবায়ন হত।
 *
 * ⚠️ এই cron **মাসিক** চক্রই চালায়, বার্ষিক নয়। বার্ষিক plan-এও credit মাসে
 *    মাসে আসে (ব্যবহারকারীর সিদ্ধান্ত) — কেবল সেবার **মেয়াদ** (`planExpiresAt`)
 *    ৩৬৫ দিন টেকে, আর সেটি `isResetEligible` (নিচে) দেখে।
 */

/**
 * যে `kind`-গুলো একটি **plan কেনা** — allowance নবায়নের দাবি কেবল এদের থেকেই আসে।
 * `topup`/`invoice_credits` আগে থেকেই roll over করে (নিচে), তাই তারা এখানে নয়।
 */
const PLAN_KINDS = ["plan", "invoice_plan"];

export async function GET(req: Request) {
  // Authorization check
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[CreditReset] CRON_SECRET environment variable is not set!");
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // যে users-দের creditsResetDate আজ বা তার আগে
    const usersDue = await db.user.findMany({
      where: {
        creditsResetDate: { lte: now },
      },
      select: {
        userId: true,
        plan: true,
        region: true,
        includedCredits: true,
        creditsBalance: true,
        creditsUsedThisCycle: true,
        // ⚠️ ১৫.৭ — মেয়াদ-ভিত্তিক যোগ্যতার জন্য **আবশ্যক**। এই select-এ না
        //    থাকলে `plan_expired` নিয়মটি কখনোই চলত: সবাইকে `planExpiresAt: null`
        //    পাঠানো হত, অর্থাৎ "মেয়াদ নেই" — অথচ মেয়াদ আছে। এই ধরনের নীরব
        //    অনুপস্থিতিই সবচেয়ে খারাপ বাগ, কারণ ফলটি সঠিক দেখায়।
        planExpiresAt: true,
      },
    });

    console.log(`[CreditReset] ${usersDue.length} users due`);

    // ── Payment-প্রমাণ: একটি query-তেই সব ────────────────────────────────────
    //
    // ⚠️ per-user query করলে N+1 (১০০ user = ১০০ round-trip)। `groupBy` একটি
    //    কলেই পুরো সেটটি দেয়, আর `refundStatus`-কে দ্বিতীয় key রাখায়
    //    paid-ও-refunded আর refunded — দুটোই একসাথে আসে, তাই দ্বিতীয় query লাগে না।
    //
    // ⚠️ `refundStatus !== "refunded"` (requested/approved/rejected) মানে paymentটি
    //    এখনো আমাদের কাছে — refund "চেয়েছে" আর "ফেরত গেছে" এক নয়।
    const paymentRows =
      usersDue.length === 0
        ? []
        : await db.paymentTransaction.groupBy({
            by: ["userId", "refundStatus"],
            where: {
              userId: { in: usersDue.map((user) => user.userId) },
              paymentStatus: { in: PAID_STATUSES },
              kind: { in: PLAN_KINDS },
            },
          });

    const paidUsers = new Set<string>();
    const refundedUsers = new Set<string>();

    for (const row of paymentRows) {
      if (row.refundStatus === "refunded") refundedUsers.add(row.userId);
      else paidUsers.add(row.userId);
    }

    let granted = 0;
    let skipped = 0;
    let failed = 0;
    const skippedByReason: Partial<Record<ResetReason, number>> = {};

    for (const user of usersDue) {
      const region = (user.region || "bd") as Region;

      const { eligible, reason } = isResetEligible({
        plan: user.plan,
        region,
        hasPaidPlanPayment: paidUsers.has(user.userId),
        hasRefundedPayment: refundedUsers.has(user.userId),
        planExpiresAt: user.planExpiresAt,
        now,
      });

      // Next reset date — ঠিক CYCLE_DAYS দিন পরে (যোগ্য হোক বা না হোক)
      const nextResetDate = new Date(now);
      nextResetDate.setDate(nextResetDate.getDate() + CYCLE_DAYS);

      try {
        if (!eligible) {
          // ⛔ ব্যালান্স, includedCredits, creditsUsedThisCycle — কিছুই বদলায় না।
          //    কেবল ঘড়িটা এগোয়, যাতে আগামীকাল আবার একই লোক স্ক্যান না হয়।
          await db.user.update({
            where: { userId: user.userId },
            data: { creditsResetDate: nextResetDate },
          });

          skipped++;
          skippedByReason[reason] = (skippedByReason[reason] ?? 0) + 1;
          continue;
        }

        // Plan credits — region-aware (BD starter = 15,000 কিন্তু Global starter = 500)
        const planCredits = getPlanCredits(user.plan, region);
        const creditsUsed = user.creditsUsedThisCycle || 0;
        const basePlanRemaining = Math.max(0, planCredits - creditsUsed);
        const topUpRemaining = Math.max(0, user.creditsBalance - basePlanRemaining);
        const newBalance = planCredits + topUpRemaining;

        await db.user.update({
          where: { userId: user.userId },
          data: {
            // Unused regular credits roll over না, কিন্তু non-expiring top-up credits Roll Over হবে
            creditsBalance: newBalance,
            includedCredits: planCredits,
            creditsUsedThisCycle: 0,
            creditsResetDate: nextResetDate,
          },
        });

        granted++;
      } catch (err) {
        console.error(`[CreditReset] Failed for user ${user.userId}:`, err);
        failed++;
      }
    }

    console.log(
      `[CreditReset] Done: ${granted} granted, ${skipped} skipped, ${failed} failed`
    );

    // ⚠️ `skippedByReason` ইচ্ছাকৃতভাবে response-এ — নীরব skip মানে নীরব leak।
    //    admin চোখে না দেখলে "never_paid" (প্রত্যাশিত) আর "refunded"
    //    (তদন্তের বিষয়) আলাদা করা যায় না।
    return NextResponse.json({
      processed: usersDue.length,
      granted,
      skipped,
      failed,
      skippedByReason,
      resetAt: now.toISOString(),
    });
  } catch (error) {
    console.error("[CreditReset] Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
