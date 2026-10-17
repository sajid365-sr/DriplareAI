import { NextResponse } from "next/server";
import { processAllDueDowngrades, processExpiredTrials } from "@/lib/domain/plan-downgrade";

/**
 * Cron Job: Process all due scheduled downgrades **এবং** মেয়াদোত্তীর্ণ trial
 *
 * Vercel Cron (vercel.json): `0 0 * * *` → `/api/cron/process-downgrades`
 *
 * ⚠️ **দুটি selector, একটি cron (১৫.৬)।** দুটোই একই প্রশ্নের উত্তর দেয় —
 *    "একটি plan period শেষ হয়েছে, আর নবায়ন হয়নি" — তাই আলাদা cron বানানো
 *    মানে একই ঘড়িতে দুইবার জেগে ওঠা, আর দুটো schedule আলাদা হয়ে যাওয়ার ঝুঁকি।
 *    তবে দুটোর **পরিণতি ভিন্ন**, তাই ফাংশনও ভিন্ন (`processAllDueDowngrades`
 *    plan বদলায় ও allowance বসায়; `processExpiredTrials` কেবল bot বন্ধ করে
 *    এবং allowance **স্পর্শ করে না**)। এক ফাংশনে জোড়া লাগালে সেটি এমন একটি
 *    নাম পেত যা একটির কথাই বলে, আর দ্বিতীয়টির নিয়ম লুকিয়ে যেত।
 */
export async function GET(req: Request) {
  // Authorization check
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET environment variable is not set!");
    return NextResponse.json(
      { error: "Cron secret not configured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[Cron] Starting scheduled downgrade processing...");
    const results = await processAllDueDowngrades();

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(
      `[Cron] Processed ${results.length} downgrades: ${successCount} success, ${failCount} failed`
    );

    // মেয়াদোত্তীর্ণ trial — দ্বিতীয় selector (১৫.৬)। একটির ব্যর্থতা
    // অন্যটিকে থামায় না, তাই আলাদা try/catch-এ।
    let expiredTrials: Awaited<ReturnType<typeof processExpiredTrials>> = [];
    try {
      expiredTrials = await processExpiredTrials();
      console.log(`[Cron] Processed ${expiredTrials.length} expired trials`);
    } catch (trialError) {
      console.error("[Cron] processExpiredTrials error:", trialError);
    }

    return NextResponse.json({
      processed: results.length,
      success: successCount,
      failed: failCount,
      results,
      trials: {
        processed: expiredTrials.length,
        pausedChatbots: expiredTrials.reduce((sum, trial) => sum + trial.pausedChatbots, 0),
        results: expiredTrials,
      },
    });
  } catch (error) {
    console.error("[Cron] processAllDueDowngrades error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
