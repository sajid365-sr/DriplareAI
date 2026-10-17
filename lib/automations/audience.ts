import "server-only";

import { db } from "@/lib/core/db";
import { isOutboundPlatform, recipientIdFor } from "@/lib/services/outbound";
import type { BroadcastAudience } from "./schema";

/**
 * Turn a broadcast's audience filter into the concrete conversations it will
 * reach.
 *
 * Resolved at send time, never stored as a fixed list. Two reasons, and the
 * second is the important one:
 *
 *   - a broadcast scheduled for tomorrow reaches customers who write in today;
 *   - a customer archived or who opted out between scheduling and sending is
 *     *not* messaged. Storing a frozen list would deliver to them anyway.
 */

export interface AudienceMember {
  chatbotId: string;
  sessionId: string;
  platform: string;
  /** The platform-side recipient id, or null when the session is unreachable. */
  recipientId: string | null;
}

export interface AudienceResolution {
  members: AudienceMember[];
  /** Archived conversations the filters otherwise matched, for the UI to explain. */
  archivedExcluded: number;
}

/**
 * Build the session filter the audience describes.
 *
 * Archived conversations are excluded unconditionally: archiving is the
 * merchant's own "do not contact" signal, nothing else in the product can
 * override it, and a broadcast certainly must not. It is counted separately so
 * the composer can say "12 more matched but are archived" rather than silently
 * reporting a smaller number.
 */
function buildWhere(
  chatbotIds: string[],
  audience: BroadcastAudience,
  isArchived: boolean
) {
  const since =
    audience.lastSeenDays !== null ? new Date(Date.now() - audience.lastSeenDays * 86_400_000) : null;

  return {
    chatbotId: { in: chatbotIds },
    isArchived,
    ...(audience.platform.length > 0 ? { platform: { in: audience.platform } } : {}),
    ...(audience.leadStatus.length > 0 ? { leadStatus: { in: audience.leadStatus } } : {}),
    ...(since ? { updatedAt: { gte: since } } : {}),
    // `some` rather than `every`: a tag filter means "has any of these tags",
    // which is what a merchant means by selecting three of them.
    ...(audience.tags.length > 0 ? { tags: { some: { tagId: { in: audience.tags } } } } : {}),
  };
}

/** The workspace's agents, narrowed to one when the broadcast names one. */
async function resolveChatbotIds(workspaceId: string, chatbotId?: string | null) {
  const bots = await db.chatbot.findMany({
    where: { workspaceId, ...(chatbotId ? { chatbotId } : {}) },
    select: { chatbotId: true },
  });
  return bots.map((bot) => bot.chatbotId);
}

/**
 * Resolve the audience.
 *
 * Every filter is applied in the database rather than in memory: a workspace
 * with tens of thousands of sessions cannot afford to load them all to filter
 * four fields in JavaScript.
 */
export async function resolveAudience(input: {
  workspaceId: string;
  /** `null` or omitted = every agent in the workspace. */
  chatbotId?: string | null;
  audience: BroadcastAudience;
}): Promise<AudienceResolution> {
  const chatbotIds = await resolveChatbotIds(input.workspaceId, input.chatbotId);
  if (chatbotIds.length === 0) return { members: [], archivedExcluded: 0 };

  const [sessions, archivedExcluded] = await Promise.all([
    db.chatSession.findMany({
      where: buildWhere(chatbotIds, input.audience, false),
      select: { chatbotId: true, sessionId: true, platform: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.chatSession.count({
      where: buildWhere(chatbotIds, input.audience, true),
    }),
  ]);

  return {
    members: sessions.map((session) => ({
      chatbotId: session.chatbotId,
      sessionId: session.sessionId,
      platform: session.platform,
      // Resolved now rather than at delivery so the composer can flag
      // unreachable contacts before the merchant commits to a send.
      recipientId: isOutboundPlatform(session.platform)
        ? recipientIdFor(session.platform, session.sessionId)
        : null,
    })),
    archivedExcluded,
  };
}

/**
 * How many contacts a broadcast would reach, without building the list.
 *
 * The composer calls this on every audience edit, so it stays a `count` —
 * running `resolveAudience` here would materialise every session just to read
 * `members.length`.
 */
export async function countAudience(input: {
  workspaceId: string;
  chatbotId?: string | null;
  audience: BroadcastAudience;
}): Promise<{ reachable: number; archivedExcluded: number }> {
  const chatbotIds = await resolveChatbotIds(input.workspaceId, input.chatbotId);
  if (chatbotIds.length === 0) return { reachable: 0, archivedExcluded: 0 };

  const [reachable, archivedExcluded] = await Promise.all([
    db.chatSession.count({ where: buildWhere(chatbotIds, input.audience, false) }),
    db.chatSession.count({ where: buildWhere(chatbotIds, input.audience, true) }),
  ]);

  return { reachable, archivedExcluded };
}
