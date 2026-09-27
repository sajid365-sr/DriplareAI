import { NextResponse } from "next/server";
import { scanUsageThresholds } from "@/lib/services/usage-alerts";
import { db } from "@/lib/core/db";
import { Prisma } from "@prisma/client";

/**
 * GET /api/cron/usage-alerts
 * ─────────────────────────────────────────────────────────────────────────────
 * দৈনিক safety net। `check-and-deduct`-এর real-time hook মূল পথ, কিন্তু সেটি
 * কখনো fire নাও করতে পারে — যেমন balance ঠিক শেষ হয়ে গেলে deduction-ই
 * `402 insufficient_credits` দিয়ে **আগেই** থেমে যায়, তাই ১০০% ছোঁয়ার ঠিক
 * পরে আর কোনো reply process হয় না এবং alert-টিও পাঠানো হয় না।
 *
 * এই cron সেই ফাঁক পূরণ করে (এবং ব্যর্থ email-ও পরের দিন আবার চেষ্টা করে)।
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` — বাকি cron-গুলোর মতোই।
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await scanUsageThresholds();
    const pruned = await pruneOldAlerts();

    return NextResponse.json({
      success: true,
      ...result,
      prunedAlerts: pruned,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON_USAGE_ALERTS]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

/**
 * ৬ মাসের পুরনো alert record মুছে ফেলা হয়।
 *
 * কেন: `UsageAlert`-এর unique key `cycleStart`-নির্ভর, তাই পুরনো row আর
 * দরকার হয় না — শুধু table বাড়তে থাকে।
 */
async function pruneOldAlerts(): Promise<number> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 6);

  try {
    const result = await db.usageAlert.deleteMany({
      where: { sentAt: { lt: cutoff } },
    });
    return result.count;
  } catch (err) {
    // Pruning ব্যর্থ হলেও alert পাঠানো সফল থাকবে
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[CRON_USAGE_ALERTS_PRUNE]", err.code);
    } else {
      console.error("[CRON_USAGE_ALERTS_PRUNE]", err);
    }
    return 0;
  }
}
