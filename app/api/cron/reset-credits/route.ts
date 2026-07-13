import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getPlanCredits } from "@/lib/domain/credit-config";

/**
 * Cron Job: Monthly Credit Reset
 *
 * এই endpoint টি Vercel Cron দ্বারা প্রতিদিন midnight-এ call হয়।
 * যে users-দের creditsResetDate আজকের আগে/সমান, তাদের credits reset হবে।
 *
 * Vercel Cron config (vercel.json):
 * { "crons": [{ "path": "/api/cron/reset-credits", "schedule": "0 0 * * *" }] }
 */
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
    const usersToReset = await db.user.findMany({
      where: {
        creditsResetDate: { lte: now },
      },
      select: { userId: true, plan: true, includedCredits: true, creditsBalance: true, creditsUsedThisCycle: true },
    });

    console.log(`[CreditReset] ${usersToReset.length} users to reset`);

    let successCount = 0;
    let failCount = 0;

    for (const user of usersToReset) {
      try {
        // Plan credits
        const planCredits = getPlanCredits(user.plan);
        const creditsUsed = user.creditsUsedThisCycle || 0;
        const basePlanRemaining = Math.max(0, planCredits - creditsUsed);
        const topUpRemaining = Math.max(0, user.creditsBalance - basePlanRemaining);
        const newBalance = planCredits + topUpRemaining;

        // Next reset date — ঠিক 30 দিন পরে
        const nextResetDate = new Date(now);
        nextResetDate.setDate(nextResetDate.getDate() + 30);

        await db.user.update({
          where: { userId: user.userId },
          data: {
            // Unused regular credits roll over না, কিন্তু non-expiring top-up credits Roll Over হবে
            creditsBalance:       newBalance,
            includedCredits:      planCredits,
            creditsUsedThisCycle: 0,
            creditsResetDate:     nextResetDate,
          },
        });

        successCount++;
      } catch (err) {
        console.error(`[CreditReset] Failed for user ${user.userId}:`, err);
        failCount++;
      }
    }

    console.log(`[CreditReset] Done: ${successCount} success, ${failCount} failed`);

    return NextResponse.json({
      processed:  usersToReset.length,
      success:    successCount,
      failed:     failCount,
      resetAt:    now.toISOString(),
    });
  } catch (error) {
    console.error("[CreditReset] Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
