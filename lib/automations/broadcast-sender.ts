import "server-only";

import { db } from "@/lib/core/db";
import {
  deliverOutbound,
  isOutboundPlatform,
  type OutboundPlatform,
} from "@/lib/services/outbound";
import { resolveAudience } from "./audience";
import { parseBroadcastAudience } from "./schema";
import { renderTemplate, type TemplateVariables } from "./templates";

/**
 * Broadcast delivery.
 *
 * A broadcast is not a rule: it has no trigger and it runs once. What it shares
 * with the engine is the delivery layer — and the discipline that a failed send
 * is *recorded*, not thrown.
 *
 * Sending is split into two steps on purpose:
 *
 *   1. `enqueueBroadcast` resolves the audience and writes one
 *      `BroadcastRecipient` row per contact, inside a transaction.
 *   2. `drainBroadcast` delivers a bounded batch and marks each row.
 *
 * The split exists because delivery is HTTP calls to Meta. A workspace with
 * 4 000 contacts would blow through a serverless request timeout mid-way, with
 * no record of who had been messaged — so the queue is the durable artefact and
 * the drain is resumable.
 */

/** Recipients delivered per drain call — bounded so a drain fits in a request. */
export const DRAIN_BATCH_SIZE = 25;

interface ExtractionData {
  phone?: string | null;
  address?: string | null;
  district?: string | null;
}

export interface EnqueueResult {
  targeted: number;
  alreadyQueued: number;
}

/**
 * Resolve the audience and queue it.
 *
 * Idempotent: re-sending a broadcast tops up the queue rather than duplicating
 * it, because `BroadcastRecipient` is unique on `(broadcastId, sessionId)` and
 * `skipDuplicates` drops the rows that already exist. A merchant who hits Send
 * twice must not message anyone twice.
 */
export async function enqueueBroadcast(broadcastId: string): Promise<EnqueueResult> {
  const broadcast = await db.broadcast.findUnique({
    where: { broadcastId },
    select: { broadcastId: true, workspaceId: true, chatbotId: true, audience: true },
  });
  if (!broadcast) throw new Error("Broadcast not found");

  const audience = parseBroadcastAudience(broadcast.audience);

  const resolution = await resolveAudience({
    workspaceId: broadcast.workspaceId,
    chatbotId: broadcast.chatbotId,
    audience,
  });

  const existing = await db.broadcastRecipient.count({ where: { broadcastId } });

  if (resolution.members.length > 0) {
    await db.broadcastRecipient.createMany({
      data: resolution.members.map((member) => ({
        broadcastId,
        chatbotId: member.chatbotId,
        sessionId: member.sessionId,
      })),
      skipDuplicates: true,
    });
  }

  const targeted = await db.broadcastRecipient.count({ where: { broadcastId } });

  await db.broadcast.update({
    where: { broadcastId },
    data: {
      status: "sending",
      stats: {
        targeted,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
      },
    },
  });

  return { targeted, alreadyQueued: existing };
}

export interface DrainResult {
  processed: number;
  sent: number;
  failed: number;
  /** True when nothing is left queued — the broadcast is finished. */
  complete: boolean;
}

/**
 * Deliver the next batch of queued recipients.
 *
 * Credentials are loaded once per chatbot rather than once per recipient: a
 * broadcast to 4 000 contacts would otherwise issue 4 000 identical
 * `Integration` reads.
 */
export async function drainBroadcast(
  broadcastId: string,
  limit = DRAIN_BATCH_SIZE
): Promise<DrainResult> {
  const broadcast = await db.broadcast.findUnique({
    where: { broadcastId },
    select: {
      broadcastId: true,
      workspaceId: true,
      channel: true,
      body: true,
      status: true,
    },
  });
  if (!broadcast) throw new Error("Broadcast not found");

  const queued = await db.broadcastRecipient.findMany({
    where: { broadcastId, status: "queued" },
    take: limit,
    orderBy: { createdAt: "asc" },
    select: { id: true, chatbotId: true, sessionId: true },
  });

  if (queued.length === 0) {
    await finishIfDone(broadcastId);
    return { processed: 0, sent: 0, failed: 0, complete: true };
  }

  const chatbotIds = [...new Set(queued.map((row) => row.chatbotId))];
  const sessionIds = [...new Set(queued.map((row) => row.sessionId))];

  // A cross-product superset rather than a 25-branch `OR` of exact pairs: the
  // extra rows a session id shared between two agents could produce are
  // discarded by the `(chatbotId, sessionId)` map below, and the query stays a
  // two-index lookup instead of a chain of ORs.
  const batchFilter = { chatbotId: { in: chatbotIds }, sessionId: { in: sessionIds } };

  const [integrations, sessions] = await Promise.all([
    db.integration.findMany({
      where: { chatbotId: { in: chatbotIds } },
      select: { chatbotId: true, platform: true, config: true },
    }),
    db.chatSession.findMany({
      where: batchFilter,
      select: {
        chatbotId: true,
        sessionId: true,
        platform: true,
        guestName: true,
        aiExtractionData: true,
      },
    }),
  ]);

  const configByBot = new Map(integrations.map((row) => [row.chatbotId, row]));
  const sessionKey = (chatbotId: string, sessionId: string) => `${chatbotId}\u0000${sessionId}`;
  const sessionByKey = new Map(
    sessions.map((row) => [sessionKey(row.chatbotId, row.sessionId), row])
  );

  // The customer's most recent inbound message sets the messaging window. One
  // query for the whole batch rather than one per recipient.
  const lastInbound = await db.chatMessage.groupBy({
    by: ["chatbotId", "sessionId"],
    where: { ...batchFilter, role: "user" },
    _max: { timestamp: true },
  });
  const inboundByKey = new Map(
    lastInbound.map((row) => [sessionKey(row.chatbotId, row.sessionId), row._max.timestamp])
  );

  let sent = 0;
  let failed = 0;
  const now = new Date();

  for (const recipient of queued) {
    const key = sessionKey(recipient.chatbotId, recipient.sessionId);
    const session = sessionByKey.get(key);
    const integration = configByBot.get(recipient.chatbotId);

    const platform: OutboundPlatform | null =
      session && isOutboundPlatform(session.platform) ? session.platform : null;

    if (!platform || !integration) {
      await markRecipient(recipient.id, "failed", "No connected channel for this contact", now);
      failed += 1;
      continue;
    }

    const extraction = (session?.aiExtractionData ?? {}) as ExtractionData;
    const variables: TemplateVariables = {
      name: session?.guestName ?? null,
      phone: extraction.phone ?? null,
      address: extraction.address ?? null,
      district: extraction.district ?? null,
    };

    const result = await deliverOutbound(
      {
        platform,
        sessionId: recipient.sessionId,
        config: (integration.config ?? {}) as Record<string, unknown>,
        lastInboundAt: inboundByKey.get(key) ?? null,
      },
      { text: renderTemplate(broadcast.body, variables) },
      now
    );

    if (result.delivered) {
      // The web widget reads replies from `ChatMessage`, so a "delivered" web
      // recipient still needs the row written or the customer never sees it.
      if (platform === "web") {
        await persistWebReply(recipient.chatbotId, recipient.sessionId, broadcast.body, variables);
      }
      await markRecipient(recipient.id, "sent", null, now);
      sent += 1;
    } else {
      await markRecipient(
        recipient.id,
        "failed",
        result.error ?? result.skipReason ?? "Delivery failed",
        null
      );
      failed += 1;
    }
  }

  const complete = await finishIfDone(broadcastId);
  await refreshStats(broadcastId);

  return { processed: queued.length, sent, failed, complete };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function markRecipient(
  id: string,
  status: "sent" | "failed",
  error: string | null,
  sentAt: Date | null
): Promise<void> {
  await db.broadcastRecipient.update({
    where: { id },
    data: { status, error, sentAt },
  });
}

/**
 * Recompute the counters from the recipient rows rather than incrementing them.
 *
 * A drain can be retried, run concurrently, or interrupted; counters that are
 * derived from the rows are correct after any of those, and counters that are
 * incremented are not.
 */
async function refreshStats(broadcastId: string): Promise<void> {
  const grouped = await db.broadcastRecipient.groupBy({
    by: ["status"],
    where: { broadcastId },
    _count: { _all: true },
  });

  const counts: Record<string, number> = {};
  for (const row of grouped) counts[row.status] = row._count._all;

  await db.broadcast.update({
    where: { broadcastId },
    data: {
      stats: {
        targeted: Object.values(counts).reduce((sum, value) => sum + value, 0),
        sent: counts.sent ?? 0,
        delivered: counts.delivered ?? 0,
        read: counts.read ?? 0,
        failed: counts.failed ?? 0,
      },
    },
  });
}

/** Flip to `sent` once nothing is queued. Returns whether it did. */
async function finishIfDone(broadcastId: string): Promise<boolean> {
  const remaining = await db.broadcastRecipient.count({
    where: { broadcastId, status: "queued" },
  });
  if (remaining > 0) return false;

  await db.broadcast.update({
    where: { broadcastId },
    data: { status: "sent" },
  });
  return true;
}

/** Write a web-widget broadcast into the conversation it belongs to. */
async function persistWebReply(
  chatbotId: string,
  sessionId: string,
  body: string,
  variables: TemplateVariables
): Promise<void> {
  const bot = await db.chatbot.findUnique({
    where: { chatbotId },
    select: { userId: true },
  });
  if (!bot) return;

  await db.chatMessage.create({
    data: {
      chatbotId,
      userId: bot.userId,
      sessionId,
      role: "assistant",
      content: renderTemplate(body, variables),
      sentByHuman: false,
    },
  });
}

/** Exposed for the UI: how many recipients are still waiting. */
export async function queuedCount(broadcastId: string): Promise<number> {
  return db.broadcastRecipient.count({ where: { broadcastId, status: "queued" } });
}
