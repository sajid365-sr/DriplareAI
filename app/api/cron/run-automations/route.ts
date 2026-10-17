import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { drainBroadcast, enqueueBroadcast, queuedCount } from "@/lib/automations/broadcast-sender";
import { runEvent } from "@/lib/automations/run";
import { idleTriggerSchema } from "@/lib/automations/schema";

/**
 * POST|GET /api/cron/run-automations — the time-based half of the engine.
 *
 * Incoming messages reach the engine through n8n's `Automation Gate`. Nothing
 * calls back into Next.js when a conversation merely goes *quiet*, so those
 * triggers need a clock — this route is it.
 *
 * Three jobs run here, in order:
 *
 *   1. **Start due broadcasts.** A broadcast scheduled for 09:00 has to
 *      actually leave at 09:00.
 *   2. **Drain in-flight broadcasts.** Delivery is batched so a large audience
 *      cannot blow a request timeout mid-send; each run moves the queue on.
 *   3. **Fire `session.idle`.** The follow-up-when-they-go-quiet rule, which is
 *      the single most requested automation on every messaging platform.
 *
 * Auth deviates from the other crons deliberately. `usage-alerts` skips its
 * check when `CRON_SECRET` is unset, because a missed alert is harmless. This
 * route *sends messages to customers*, so it refuses to run unauthenticated —
 * an open endpoint here would be a spam cannon pointed at every contact in the
 * database.
 */

/** Sessions handled per rule per run — bounds the work in one request. */
const IDLE_BATCH_SIZE = 25;
/** Broadcasts advanced per run. */
const BROADCAST_BATCH_SIZE = 10;

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[CRON_RUN_AUTOMATIONS] CRON_SECRET is not set — refusing to run");
    return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();

  try {
    const broadcasts = await advanceBroadcasts(startedAt);
    const idle = await fireIdleTriggers(startedAt);

    return NextResponse.json({
      success: true,
      broadcasts,
      idle,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON_RUN_AUTOMATIONS]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// ── Broadcasts ────────────────────────────────────────────────────────────────

async function advanceBroadcasts(now: Date) {
  // Scheduled broadcasts whose time has come. Enqueuing resolves the audience
  // *now* rather than at schedule time, so contacts who wrote in since are
  // included and archived ones are not.
  const due = await db.broadcast.findMany({
    where: { status: "scheduled", scheduledAt: { lte: now } },
    select: { broadcastId: true },
    take: BROADCAST_BATCH_SIZE,
  });

  let started = 0;
  for (const broadcast of due) {
    try {
      const enqueued = await enqueueBroadcast(broadcast.broadcastId);
      if (enqueued.targeted === 0) {
        // Nothing matched. `failed` rather than `sent` — a scheduled broadcast
        // that quietly reached nobody is a configuration mistake the merchant
        // needs to see, not a success.
        await db.broadcast.update({
          where: { broadcastId: broadcast.broadcastId },
          data: { status: "failed" },
        });
      } else {
        started += 1;
      }
    } catch (error) {
      console.error("[CRON_BROADCAST_ENQUEUE]", broadcast.broadcastId, error);
      await db.broadcast
        .update({ where: { broadcastId: broadcast.broadcastId }, data: { status: "failed" } })
        .catch(() => undefined);
    }
  }

  const inFlight = await db.broadcast.findMany({
    where: { status: "sending" },
    select: { broadcastId: true },
    take: BROADCAST_BATCH_SIZE,
  });

  let sent = 0;
  let failed = 0;
  let completed = 0;

  for (const broadcast of inFlight) {
    try {
      const drained = await drainBroadcast(broadcast.broadcastId);
      sent += drained.sent;
      failed += drained.failed;
      if (drained.complete) completed += 1;
    } catch (error) {
      // One broken broadcast must not stop the others from finishing.
      console.error("[CRON_BROADCAST_DRAIN]", broadcast.broadcastId, error);
    }
  }

  const remaining = (
    await Promise.all(inFlight.map((row) => queuedCount(row.broadcastId)))
  ).reduce((sum, value) => sum + value, 0);

  return { started, sent, failed, completed, remaining };
}

// ── session.idle ──────────────────────────────────────────────────────────────

/**
 * Fire `session.idle` for conversations that have gone quiet.
 *
 * Candidates are gathered per rule, because a rule asking for 60 idle minutes
 * looks at a different set from one asking for 24 hours.
 *
 * They are then evaluated **once per conversation**, not once per (rule,
 * session) pair. That distinction is load-bearing: `runEvent` evaluates every
 * active rule, so a conversation that is a candidate for two idle rules would
 * otherwise be run twice and the customer would receive both nudges twice over.
 *
 * Re-firing is prevented by the ordinary guard rails rather than by a marker
 * column — a reply updates the session, which removes it from the candidate set
 * for the next run, and a rule that wants to nudge more than once sets a
 * frequency cap.
 */
async function fireIdleTriggers(now: Date) {
  const rules = await db.automation.findMany({
    where: { status: "active", triggerType: "session.idle" },
    select: {
      automationId: true,
      workspaceId: true,
      chatbotId: true,
      triggerConfig: true,
    },
  });

  if (rules.length === 0) {
    return { rules: 0, evaluated: 0, replied: 0 };
  }

  const chatbotIds = [...new Set(rules.map((rule) => rule.chatbotId).filter(Boolean))] as string[];
  const bots = await db.chatbot.findMany({
    where: { chatbotId: { in: chatbotIds } },
    select: { chatbotId: true, userId: true },
  });
  const ownerByBot = new Map(bots.map((bot) => [bot.chatbotId, bot.userId]));

  interface Candidate {
    workspaceId: string;
    chatbotId: string;
    sessionId: string;
    platform: string;
  }

  const candidates = new Map<string, Candidate>();

  for (const rule of rules) {
    const config = idleTriggerSchema.safeParse({
      type: "session.idle",
      ...(rule.triggerConfig as Record<string, unknown> | null),
    });
    if (!config.success) {
      console.warn(
        `[CRON_IDLE] Skipping ${rule.automationId}: invalid trigger — ${config.error.message}`
      );
      continue;
    }

    // A workspace-wide rule (`chatbotId = null`) belongs to no single agent, so
    // it has no sessions to scan here. It still fires normally on the message
    // path, where the incoming event names the agent.
    if (!rule.chatbotId) continue;
    if (!ownerByBot.has(rule.chatbotId)) continue;

    const cutoff = new Date(now.getTime() - config.data.idleMinutes * 60_000);

    const sessions = await db.chatSession.findMany({
      where: {
        chatbotId: rule.chatbotId,
        isArchived: false,
        ...(config.data.onlyActive ? { isActive: true } : {}),
        // `updatedAt` is the conversation's own clock and moves on every
        // message, which is exactly the "last activity" this trigger means.
        updatedAt: { lte: cutoff },
        // A session with no messages at all is an empty shell — a widget opened
        // and abandoned. Nudging it would message someone who never spoke.
        lastMessage: { not: null },
      },
      select: { sessionId: true, platform: true },
      take: IDLE_BATCH_SIZE,
      orderBy: { updatedAt: "asc" },
    });

    for (const session of sessions) {
      candidates.set(`${rule.chatbotId}\u0000${session.sessionId}`, {
        workspaceId: rule.workspaceId,
        chatbotId: rule.chatbotId,
        sessionId: session.sessionId,
        platform: session.platform,
      });
    }
  }

  let evaluated = 0;
  let replied = 0;

  for (const candidate of candidates.values()) {
    const ownerUserId = ownerByBot.get(candidate.chatbotId);
    if (!ownerUserId) continue;

    try {
      const run = await runEvent({
        workspaceId: candidate.workspaceId,
        chatbotId: candidate.chatbotId,
        ownerUserId,
        sessionId: candidate.sessionId,
        // An idle trigger has no incoming message. An empty string is the
        // honest value: a `keyword.match` condition on the text cannot pass,
        // which is correct, and no `message.received` rule can fire.
        messageText: "",
        channel: candidate.platform,
        triggerType: "session.idle",
        payload: {},
        deliver: true,
        now,
      });

      evaluated += 1;
      if (run.action === "reply") replied += 1;
    } catch (error) {
      console.error("[CRON_IDLE_SESSION]", candidate.chatbotId, candidate.sessionId, error);
    }
  }

  return { rules: rules.length, evaluated, replied };
}
