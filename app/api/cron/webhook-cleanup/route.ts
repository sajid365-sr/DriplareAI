import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { RETENTION_DAYS } from "@/lib/core/webhook-idempotency";

/**
 * Cron Job: Webhook Delivery Ledger Cleanup
 *
 * `chatbot.WebhookDelivery` grows by one row per inbound platform message and
 * only exists to absorb Meta's retries. Meta gives up after roughly 7 days, so
 * anything older than that can never be useful again — it is pure table bloat
 * that would eventually slow the de-duplication index down.
 *
 * Runs daily. Deleting one day's worth of rows per run keeps the statement
 * small; if volume ever grows enough for that to matter, batch it with a loop
 * rather than widening the interval, or the sweep stops fitting in one
 * transaction (and in the cron's execution budget).
 *
 * Vercel Cron config (vercel.json):
 * { "crons": [{ "path": "/api/cron/webhook-cleanup", "schedule": "0 3 * * *" }] }
 */
export async function GET(req: Request) {
  // Authorization check
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[WebhookCleanup] CRON_SECRET environment variable is not set!");
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const { count } = await db.webhookDelivery.deleteMany({
      where: { receivedAt: { lt: cutoff } },
    });

    console.log(`[WebhookCleanup] Deleted ${count} row(s) older than ${cutoff.toISOString()}`);

    return NextResponse.json({
      deleted: count,
      retentionDays: RETENTION_DAYS,
      cutoff: cutoff.toISOString(),
    });
  } catch (error) {
    console.error("[WebhookCleanup] Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
