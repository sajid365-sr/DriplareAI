import { BROADCAST_STATUSES } from "@/lib/automations/schema";

/**
 * `BroadcastDto` — what `GET /api/automations/broadcasts` returns.
 *
 * `progress` is derived from the recipient rows rather than from the stored
 * `stats` blob, so a list rendered while a drain is running shows live numbers.
 * The UI therefore must not cache it: the same broadcast a minute later can
 * legitimately have different totals.
 */
export interface Broadcast {
  broadcastId: string;
  chatbotId: string | null;
  name: string;
  channel: string;
  templateId: string | null;
  body: string;
  audience: BroadcastAudience;
  scheduledAt: string | null;
  status: string;
  progress: BroadcastProgress;
  createdAt: string;
  updatedAt: string;
}

export interface BroadcastAudience {
  leadStatus: string[];
  tags: string[];
  platform: string[];
  /** `null` = no recency filter. */
  lastSeenDays: number | null;
}

export interface BroadcastProgress {
  targeted: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  queued: number;
}

/** The channels a broadcast can go out on — the web widget has no push. */
export const BROADCAST_PLATFORMS = ["facebook", "instagram", "whatsapp", "web"] as const;
export type BroadcastPlatform = (typeof BROADCAST_PLATFORMS)[number];

/**
 * `ChatSession.leadStatus` values.
 *
 * Mirrors the enum in `lib/automations/schema.ts` rather than importing it,
 * because the schema exports it inline inside a zod enum and this list is used
 * to render chips — a shape change there should be a visible break here, not a
 * silently different option list.
 */
export const LEAD_STATUSES = [
  "high_prospect",
  "priority",
  "risky",
  "successful",
  "none",
] as const;

/** Statuses a merchant can see, in lifecycle order. */
export const VISIBLE_BROADCAST_STATUSES = BROADCAST_STATUSES.filter(
  (status) => status !== "sending"
);

export function emptyAudience(): BroadcastAudience {
  return { leadStatus: [], tags: [], platform: [], lastSeenDays: null };
}

/**
 * How many filters are actually narrowing the audience.
 *
 * Used to warn when a broadcast will reach *everyone*, which is the single most
 * expensive mistake available in this product: it is irreversible, and the
 * count is the only thing that makes it obvious.
 */
export function audienceFilterCount(audience: BroadcastAudience): number {
  return (
    audience.leadStatus.length +
    audience.tags.length +
    audience.platform.length +
    (audience.lastSeenDays === null ? 0 : 1)
  );
}

/** A template is required for WhatsApp and meaningless elsewhere. */
export function requiresTemplate(channel: string): boolean {
  return channel === "whatsapp";
}
