import "server-only";

/**
 * Channel-agnostic outbound delivery.
 *
 * The AI reply path does *not* use this module: n8n's Integration workflows
 * already own that (their `Send DM Text` / `Send Instagram Text` /
 * `Send WhatsApp …` nodes), and duplicating it here would give one customer
 * message two possible senders.
 *
 * This module exists for the paths that have no n8n workflow behind them:
 *
 *   - time-based automations (`session.idle`, `cart.abandoned`) fired by the
 *     cron route, which has no webhook to call back into;
 *   - human agent replies from the Live Inbox, which today are hardcoded to
 *     `graph.facebook.com/me/messages` in two separate route files and
 *     therefore silently fail to deliver on WhatsApp and Instagram.
 *
 * Every platform enforces a "messaging window": free-form text is only allowed
 * for a while after the customer's own last message (24h on Messenger, 24h on
 * WhatsApp Cloud API). Outside it the platform rejects the send and expects an
 * approved template instead. Rather than let that surface as an opaque Graph
 * error in the run log, `deliverOutbound` refuses up front and says why — a
 * merchant can act on "outside_messaging_window"; they cannot act on a 400.
 */

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v20.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** Meta's customer-service window, in hours, for Messenger and WhatsApp. */
export const MESSAGING_WINDOW_HOURS = 24;

export type OutboundPlatform = "facebook" | "instagram" | "whatsapp" | "web";

const OUTBOUND_PLATFORMS: readonly OutboundPlatform[] = [
  "facebook",
  "instagram",
  "whatsapp",
  "web",
];

/**
 * Narrow `ChatSession.platform`, which is a plain string column and therefore
 * carries no guarantee. Callers that read a session straight out of the
 * database need this before they can ask for a recipient id.
 */
export function isOutboundPlatform(value: string): value is OutboundPlatform {
  return (OUTBOUND_PLATFORMS as readonly string[]).includes(value);
}

export interface OutboundQuickReply {
  label: string;
  payload: string;
}

export interface OutboundMessage {
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "audio" | "video" | "file";
  quickReplies?: OutboundQuickReply[];
}

export interface OutboundTarget {
  platform: OutboundPlatform;
  /** `ChatSession.sessionId` — the platform-prefixed id (`fb_…`, `wa_…`). */
  sessionId: string;
  /** `Integration.config`, already decrypted/resolved by the caller. */
  config: Record<string, unknown>;
  /** When the customer last wrote. Drives the messaging-window check. */
  lastInboundAt?: Date | null;
}

export type OutboundSkipReason =
  | "web_channel"
  | "missing_credentials"
  | "missing_recipient"
  | "outside_messaging_window"
  | "comment_session"
  | "empty_message";

export interface OutboundResult {
  delivered: boolean;
  skipReason?: OutboundSkipReason;
  error?: string;
}

function str(config: Record<string, unknown>, key: string): string | null {
  const value = config[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Sessions created from a post comment (`fbc_…`) have no DM channel: the
 * commenter's PSID is only reachable through the comment API. Treating one as
 * a normal recipient would send the message to a nonexistent user.
 */
export function isCommentSession(sessionId: string): boolean {
  return sessionId.startsWith("fbc_");
}

/** Strip the platform prefix from a session id to get the platform's own id. */
export function recipientIdFor(platform: OutboundPlatform, sessionId: string): string | null {
  const prefixes: Record<OutboundPlatform, string[]> = {
    facebook: ["fb_"],
    instagram: ["ig_"],
    whatsapp: ["wa_"],
    web: ["web_"],
  };

  for (const prefix of prefixes[platform]) {
    if (sessionId.startsWith(prefix)) {
      const id = sessionId.slice(prefix.length);
      return id.length > 0 ? id : null;
    }
  }

  // Unprefixed ids are legacy rows written before the prefix convention landed;
  // the raw value is still the correct recipient.
  return sessionId.length > 0 ? sessionId : null;
}

/**
 * Is the customer's messaging window still open?
 *
 * An unknown `lastInboundAt` is treated as open: the caller that lacks the
 * timestamp is usually a first reply to a just-received message, and refusing
 * on missing data would break the common case to guard the rare one.
 */
export function isWithinMessagingWindow(lastInboundAt: Date | null | undefined, now = new Date()): boolean {
  if (!lastInboundAt) return true;
  const elapsedHours = (now.getTime() - lastInboundAt.getTime()) / 3_600_000;
  return elapsedHours <= MESSAGING_WINDOW_HOURS;
}

// ── Payload builders ──────────────────────────────────────────────────────────

/**
 * Messenger Platform payload. `messaging_type: "RESPONSE"` is what the
 * 24-hour window permits; `quick_replies` ride along on the same message
 * rather than being a separate send.
 */
function buildMessengerPayload(recipientId: string, message: OutboundMessage) {
  const payload: Record<string, unknown> = {
    recipient: { id: recipientId },
    messaging_type: "RESPONSE",
  };

  const attachment = buildAttachment(message);
  if (attachment) {
    payload.message = { attachment };
    return payload;
  }

  const textPayload: Record<string, unknown> = { text: message.text ?? "" };
  if (message.quickReplies?.length) {
    textPayload.quick_replies = message.quickReplies.slice(0, 3).map((reply) => ({
      content_type: "text",
      title: reply.label.slice(0, 20),
      payload: reply.payload,
    }));
  }
  payload.message = textPayload;
  return payload;
}

function buildAttachment(message: OutboundMessage) {
  if (!message.mediaUrl || !message.mediaType) return null;
  // Messenger's attachment types are image/audio/video/file; `file` is sent as
  // a generic attachment, which is what the platform expects.
  return {
    type: message.mediaType,
    payload: { url: message.mediaUrl, is_reusable: true },
  };
}

/** WhatsApp Cloud API payload. */
function buildWhatsAppPayload(recipientId: string, message: OutboundMessage) {
  const base = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipientId,
  };

  if (message.quickReplies?.length) {
    return {
      ...base,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: message.text ?? "" },
        action: {
          // WhatsApp caps interactive replies at three buttons, same as
          // Messenger — the schema already enforces this for authored rules.
          buttons: message.quickReplies.slice(0, 3).map((reply, index) => ({
            type: "reply",
            reply: { id: reply.payload || `btn_${index}`, title: reply.label.slice(0, 20) },
          })),
        },
      },
    };
  }

  if (message.mediaUrl && message.mediaType) {
    const key = message.mediaType === "file" ? "document" : message.mediaType;
    return {
      ...base,
      type: key,
      [key]: { link: message.mediaUrl, ...(message.text ? { caption: message.text } : {}) },
    };
  }

  return { ...base, type: "text", text: { preview_url: false, body: message.text ?? "" } };
}

// ── Delivery ──────────────────────────────────────────────────────────────────

async function postGraph(
  url: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (response.ok) return { ok: true };

    const raw = await response.text();
    // Meta returns a JSON error envelope; the message field is the only part
    // that helps a merchant, so unwrap it and fall back to the raw body.
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      return { ok: false, error: parsed.error?.message || raw.slice(0, 500) };
    } catch {
      return { ok: false, error: raw.slice(0, 500) };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network error" };
  }
}

/**
 * Deliver one message to one customer on one channel.
 *
 * Never throws: a delivery failure is data the caller records in the run log,
 * not an exception that should abort the rest of an automation.
 */
export async function deliverOutbound(
  target: OutboundTarget,
  message: OutboundMessage,
  now = new Date()
): Promise<OutboundResult> {
  if (!message.text?.trim() && !message.mediaUrl) {
    return { delivered: false, skipReason: "empty_message" };
  }

  // The web widget reads its replies from `ChatMessage`, so there is nothing
  // to push — the caller persists the row and the widget picks it up.
  if (target.platform === "web") {
    return { delivered: true, skipReason: "web_channel" };
  }

  if (isCommentSession(target.sessionId)) {
    return { delivered: false, skipReason: "comment_session" };
  }

  if (!isWithinMessagingWindow(target.lastInboundAt, now)) {
    return { delivered: false, skipReason: "outside_messaging_window" };
  }

  const recipientId = recipientIdFor(target.platform, target.sessionId);
  if (!recipientId) {
    return { delivered: false, skipReason: "missing_recipient" };
  }

  if (target.platform === "whatsapp") {
    const accessToken = str(target.config, "accessToken");
    const phoneNumberId = str(target.config, "phoneNumberId");
    if (!accessToken || !phoneNumberId) {
      return { delivered: false, skipReason: "missing_credentials" };
    }

    const result = await postGraph(
      `${GRAPH_BASE}/${phoneNumberId}/messages`,
      buildWhatsAppPayload(recipientId, message)
    );
    return result.ok ? { delivered: true } : { delivered: false, error: result.error };
  }

  // Facebook and Instagram DM both go through the page-scoped `me/messages`
  // endpoint. Instagram's own config carries `pageAccessToken`; Facebook's
  // carries `pageToken` — accept either so one lookup serves both.
  const pageToken =
    str(target.config, "pageToken") ?? str(target.config, "pageAccessToken");
  if (!pageToken) {
    return { delivered: false, skipReason: "missing_credentials" };
  }

  const result = await postGraph(
    `${GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(pageToken)}`,
    buildMessengerPayload(recipientId, message)
  );
  return result.ok ? { delivered: true } : { delivered: false, error: result.error };
}
