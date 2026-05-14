import { NextResponse } from "next/server";
import { processAllDueDowngrades } from "@/lib/plan-downgrade";

/**
 * Cron Job: Process all due scheduled downgrades
 *
 * এই endpoint টি Vercel Cron দ্বারা প্রতিদিন midnight-এ call হয়।
 * Authorization header-এ CRON_SECRET দিয়ে protect করা।
 *
 * Vercel Cron config (vercel.json):
 * { "crons": [{ "path": "/api/cron/process-downgrades", "schedule": "0 0 * * *" }] }
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

    return NextResponse.json({
      processed: results.length,
      success: successCount,
      failed: failCount,
      results,
    });
  } catch (error) {
    console.error("[Cron] processAllDueDowngrades error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
