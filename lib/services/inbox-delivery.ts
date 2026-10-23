import "server-only";

import { db } from "@/lib/core/db";
import { parseQuickReplyButtons } from "@/lib/ai/button-parser";
import {
  deliverOutbound,
  isOutboundPlatform,
  type OutboundMessage,
  type OutboundPlatform,
  type OutboundSkipReason,
  type OutboundQuickReply,
} from "@/lib/services/outbound";

/**
 * Human-agent delivery for the Live Inbox.
 *
 * Two route files used to carry their own copy of a Facebook-only Graph call
 * (`api/inbox/send-message` and `api/chatbots/[chatbotId]/messages`). Both
 * wrote the reply to `ChatMessage` and then silently delivered it on Facebook
 * and nowhere else — an Instagram or WhatsApp customer saw nothing, and the
 * merchant saw their own message in the inbox as if it had been sent.
 *
 * The channel work already exists in `lib/services/outbound.ts`, so this module
 * only answers the two questions that are specific to the inbox:
 *
 *   - which integration belongs to this session, and
 *   - when did the customer last write (Meta's 24-hour messaging window).
 *
 * Everything else — recipient id, payload shape, portal quirks — is delegated,
 * which is what keeps the inbox and the automation broadcaster on one code path.
 */

export interface DeliverInboxMessageInput {
  /** Every id the chatbot is known by (`Chatbot.id` and `Chatbot.chatbotId`). */
  botIds: string[];
  sessionId: string;
  text: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  quickReplies?: OutboundQuickReply[];
}

export interface DeliverInboxMessageResult {
  delivered: boolean;
  platform: OutboundPlatform;
  platformMessageId?: string;
  skipReason?: OutboundSkipReason;
  error?: string;
}

/**
 * `ChatSession.platform` is a plain string column. When a session row is
 * missing — a brand-new conversation, or one imported by a workflow before the
 * session upsert ran — the session id prefix is still an honest answer.
 */
function resolvePlatform(sessionId: string, persisted: string | null | undefined): OutboundPlatform {
  if (persisted && isOutboundPlatform(persisted)) return persisted;

  if (sessionId.startsWith("ig_")) return "instagram";
  if (sessionId.startsWith("wa_")) return "whatsapp";
  if (sessionId.startsWith("fbc_") || sessionId.startsWith("fb_")) return "facebook";
  // Everything else — `web_…` included — is served by the widget, which reads
  // its replies from `ChatMessage` rather than from a push channel.
  return "web";
}

/** The attachment kinds Meta accepts; anything else is sent as an image. */
function resolveMediaKind(mediaType: string | null | undefined): OutboundMessage["mediaType"] {
  if (mediaType === "audio" || mediaType === "video" || mediaType === "file") {
    return mediaType;
  }
  // The inbox uploader only produces images and audio, so a missing or
  // unrecognised label is far more likely to be an image than a file.
  return "image";
}

export async function deliverInboxMessage(
  input: DeliverInboxMessageInput
): Promise<DeliverInboxMessageResult> {
  const session = await db.chatSession.findFirst({
    where: {
      chatbotId: { in: input.botIds },
      sessionId: input.sessionId,
    },
    include: { integration: true },
  });

  const platform = resolvePlatform(input.sessionId, session?.platform);

  // The widget reads `ChatMessage`; there is no push channel to fail. Reporting
  // `web_channel` keeps the caller from warning the merchant about a message
  // that is, in fact, visible.
  if (platform === "web") {
    return { delivered: true, platform, skipReason: "web_channel" };
  }

  // A session's own integration is authoritative, but older rows can point at a
  // different platform's integration after a reconnect. Fall back to whichever
  // integration this chatbot actually has for the channel in question.
  let integration =
    session?.integration && session.integration.platform === platform
      ? session.integration
      : null;

  if (!integration) {
    integration = await db.integration.findFirst({
      where: {
        chatbotId: { in: input.botIds },
        platform,
      },
    });
  }

  // Meta only allows free-form replies for a while after the customer's own
  // last message. Reading the fact from the ledger beats guessing from
  // `updatedAt`, which moves on every state change we make ourselves.
  const lastInbound = await db.chatMessage.findFirst({
    where: {
      chatbotId: { in: input.botIds },
      sessionId: input.sessionId,
      role: "user",
    },
    orderBy: { timestamp: "desc" },
    select: { timestamp: true },
  });

  const target = {
    platform,
    sessionId: input.sessionId,
    config: (integration?.config ?? {}) as Record<string, unknown>,
    lastInboundAt: lastInbound?.timestamp ?? null,
  };

  // A caption is not an attachment. Messenger has no captioned attachment, so
  // text and media are two sends there; using the same two sends on every
  // channel keeps WhatsApp's outcome identical rather than subtly different.
  const outgoing: OutboundMessage[] = [];

  // Parse quick-reply buttons if present in text
  const parsedButtons = parseQuickReplyButtons(input.text);
  const text = parsedButtons.cleanText.trim();
  const quickReplies =
    input.quickReplies ??
    (parsedButtons.buttons.length > 0
      ? parsedButtons.buttons.map((b) => ({ label: b, payload: b }))
      : undefined);

  if (text) {
    outgoing.push({
      text,
      quickReplies,
    });
  }

  if (input.mediaUrl) {
    outgoing.push({ mediaUrl: input.mediaUrl, mediaType: resolveMediaKind(input.mediaType) });
  }

  if (outgoing.length === 0) {
    return { delivered: false, platform, skipReason: "empty_message" };
  }

  let delivered = false;
  let platformMessageId: string | undefined;
  let skipReason: OutboundSkipReason | undefined;
  let error: string | undefined;

  for (const message of outgoing) {
    const result = await deliverOutbound(target, message);

    if (result.delivered) {
      delivered = true;
      platformMessageId ??= result.platformMessageId;
      continue;
    }

    // Both attempts usually fail the same way (no token, closed window), so the
    // first reason is the one worth reporting; a later one only fills the gap.
    skipReason ??= result.skipReason;
    if (result.error) error = result.error;
  }

  return {
    delivered,
    platform,
    ...(platformMessageId && { platformMessageId }),
    ...(skipReason && { skipReason }),
    ...(error && { error }),
  };
}
