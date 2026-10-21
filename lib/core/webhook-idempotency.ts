import { db } from "@/lib/core/db";

/**
 * Inbound webhook de-duplication and forwarding.
 *
 * Meta retries deliveries it did not get a 2xx for — the same event can arrive
 * again immediately (a network glitch) or days later (Meta retries with
 * exponential backoff for up to ~7 days). Without a ledger, every retry costs
 * another full AI reply, so the customer is answered twice and we are billed
 * twice.
 *
 * The ledger is `chatbot.WebhookDelivery`: a unique row per
 * (provider, externalId). The unique constraint — not application logic — is
 * what makes the check safe, because it also holds when two deliveries arrive
 * concurrently.
 */

export type WebhookProvider = "whatsapp" | "instagram" | "facebook";

/** How long a claimed delivery id is remembered. Matches Meta's retry window. */
export const RETENTION_DAYS = 7;

/** Ceiling for the forward call. Meta retries if we do not answer in time. */
const FORWARD_TIMEOUT_MS = 10_000;

export type ClaimResult = {
  /** Ids this call actually claimed — i.e. that had not been seen before. */
  claimedIds: string[];
  /** True when every id in the payload had already been claimed. */
  isDuplicate: boolean;
};

// ── Payload inspection ──────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function collectId(target: Set<string>, value: unknown) {
  if (typeof value === "string" && value.length > 0) {
    target.add(value);
  }
}

/**
 * Pull every stable Meta message id out of a webhook payload.
 *
 * Handles both shapes Meta actually sends:
 *   - WhatsApp — `entry[].changes[].value.messages[].id` (the `wamid.…` id)
 *   - Instagram / Messenger — `entry[].messaging[].message.mid`, plus the
 *     alternate `entry[].changes[].value.message.mid` used by some events
 *
 * Deliberately ignored: `statuses[]`. Those are delivery receipts for messages
 * *we* sent, not inbound messages. Claiming them would de-duplicate a different
 * event class and could suppress a genuine receipt.
 *
 * Returns an empty array for any payload it does not recognise — including a
 * bare status callback. Callers treat that as "nothing to de-duplicate" and
 * forward as before, because a duplicate is far cheaper than a lost message.
 */
export function extractMessageIds(payload: unknown): string[] {
  const ids = new Set<string>();
  const root = asRecord(payload);

  if (!root) {
    return [];
  }

  for (const rawEntry of asArray(root.entry)) {
    const entry = asRecord(rawEntry);

    if (!entry) {
      continue;
    }

    // Instagram / Messenger: entry[].messaging[].message.mid
    for (const rawEvent of asArray(entry.messaging)) {
      const message = asRecord(asRecord(rawEvent)?.message);
      collectId(ids, message?.mid);
    }

    // WhatsApp: entry[].changes[].value.messages[].id
    for (const rawChange of asArray(entry.changes)) {
      const value = asRecord(asRecord(rawChange)?.value);

      if (!value) {
        continue;
      }

      for (const rawMessage of asArray(value.messages)) {
        collectId(ids, asRecord(rawMessage)?.id);
      }

      // Alternate Instagram shape: entry[].changes[].value.message.mid
      collectId(ids, asRecord(value.message)?.mid);
    }
  }

  return [...ids];
}


export interface QuotedMessageContext {
  messageId: string;
  replyToMessageId: string;
}

/**
 * Extracts reply-to / quoted message relations from incoming Meta webhook payloads.
 * Supports WhatsApp context.id and Messenger/Instagram reply_to.mid.
 */
export function extractQuotedMessageContext(payload: unknown): QuotedMessageContext[] {
  const pairs: QuotedMessageContext[] = [];
  const root = asRecord(payload);
  if (!root) return pairs;

  for (const rawEntry of asArray(root.entry)) {
    const entry = asRecord(rawEntry);
    if (!entry) continue;

    // Messenger / Instagram
    for (const rawEvent of asArray(entry.messaging)) {
      const message = asRecord(asRecord(rawEvent)?.message);
      const mid = message?.mid;
      const replyToMid = asRecord(message?.reply_to)?.mid;
      if (typeof mid === "string" && typeof replyToMid === "string") {
        pairs.push({ messageId: mid, replyToMessageId: replyToMid });
      }
    }

    // WhatsApp
    for (const rawChange of asArray(entry.changes)) {
      const value = asRecord(asRecord(rawChange)?.value);
      if (!value) continue;

      for (const rawMessage of asArray(value.messages)) {
        const msg = asRecord(rawMessage);
        const id = msg?.id;
        const contextId = asRecord(msg?.context)?.id;
        if (typeof id === "string" && typeof contextId === "string") {
          pairs.push({ messageId: id, replyToMessageId: contextId });
        }
      }
    }
  }

  return pairs;
}

// ── Ledger ──────────────────────────────────────────────────────────────────

/**
 * Claim delivery ids before forwarding them to n8n.
 *
 * `createManyAndReturn` + `skipDuplicates` does the whole check in one atomic
 * statement: rows that already exist are skipped and simply not returned, so
 * the returned rows are exactly the ids this request won. Concurrent deliveries
 * of the same message therefore cannot both win.
 */
export async function claimDeliveries(
  provider: WebhookProvider,
  ids: string[]
): Promise<ClaimResult> {
  if (ids.length === 0) {
    return { claimedIds: [], isDuplicate: false };
  }

  const claimed = await db.webhookDelivery.createManyAndReturn({
    data: ids.map((externalId) => ({ provider, externalId })),
    skipDuplicates: true,
    select: { externalId: true },
  });

  const claimedIds = claimed.map((row) => row.externalId);

  return { claimedIds, isDuplicate: claimedIds.length === 0 };
}

/**
 * Give back ids that were claimed but never successfully forwarded.
 *
 * This is what makes a failed forward *retryable*. Without it the claim would
 * survive the failure, Meta's retry would be classified as a duplicate, and the
 * message would be dropped for good — the exact silent loss this module exists
 * to prevent. Claiming first (rather than after a successful forward) is what
 * keeps the concurrent case safe; releasing is only ever needed on the failure
 * path, where a brief window of non-protection is harmless.
 */
export async function releaseDeliveries(
  provider: WebhookProvider,
  ids: string[]
): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }

  const { count } = await db.webhookDelivery.deleteMany({
    where: { provider, externalId: { in: ids } },
  });

  return count;
}

// ── Orchestration ───────────────────────────────────────────────────────────

export type ForwardResult = {
  /** Status code to return to Meta. */
  status: number;
  /** Response body for Meta (and for log triage). */
  body: Record<string, unknown>;
  /** Every message id in this payload had already been processed. */
  duplicate: boolean;
  /** n8n accepted the payload. */
  forwarded: boolean;
};

type ForwardOptions = {
  provider: WebhookProvider;
  payload: unknown;
  webhookUrl: string;
  /** Log tag, e.g. "[WHATSAPP_WEBHOOK]". */
  logPrefix: string;
};

/**
 * De-duplicate an inbound Meta payload, then forward it to n8n.
 *
 * Order matters, and each step exists for a reason:
 *   1. claim  — atomic, so a concurrent duplicate cannot also pass
 *   2. forward — to n8n
 *   3. release on failure — so Meta's retry is treated as new, not duplicate
 *
 * Status codes returned to Meta:
 *   200 — processed (or already processed; a retry of a delivered message)
 *   502 — n8n rejected or was unreachable; Meta should retry
 */
export async function dedupeAndForward({
  provider,
  payload,
  webhookUrl,
  logPrefix,
}: ForwardOptions): Promise<ForwardResult> {
  const messageIds = extractMessageIds(payload);

  let claimedIds: string[] = [];

  if (messageIds.length > 0) {
    try {
      const claim = await claimDeliveries(provider, messageIds);

      if (claim.isDuplicate) {
        // Every message here was already handled. Answering 200 stops Meta from
        // retrying, and we never reach n8n — so no second AI reply, no cost.
        console.log(`${logPrefix} Duplicate delivery ignored (${messageIds.length} id(s)).`);
        return {
          status: 200,
          body: { received: true, forwarded: false, duplicate: true },
          duplicate: true,
          forwarded: false,
        };
      }

      claimedIds = claim.claimedIds;
    } catch (error) {
      // De-duplication is a cost optimisation, not a delivery guarantee: if the
      // ledger is unavailable (DB outage) the correct trade is to forward and
      // risk a duplicate, never to drop a customer's message.
      console.error(`${logPrefix} Idempotency ledger unavailable — forwarding unguarded.`, error);
    }
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`${logPrefix} n8n forward failed:`, response.status, detail);

      // Hand the ids back so Meta's retry is processed as a new delivery.
      await safeRelease(provider, claimedIds, logPrefix);

      return {
        status: 502,
        body: { received: true, forwarded: false, error: "n8n_unavailable" },
        duplicate: false,
        forwarded: false,
      };
    }

    return {
      status: 200,
      body: { received: true, forwarded: true, duplicate: false },
      duplicate: false,
      forwarded: true,
    };
  } catch (error) {
    // Covers a network error and the abort above (n8n accepted the connection
    // but never answered) — both are transient, so let Meta retry.
    console.error(`${logPrefix} n8n forward threw:`, error);

    await safeRelease(provider, claimedIds, logPrefix);

    return {
      status: 502,
      body: { received: true, forwarded: false, error: "n8n_unreachable" },
      duplicate: false,
      forwarded: false,
    };
  }
}

/**
 * Best-effort claim release. A failure here must never replace the 502 the
 * caller is about to return — the message is then lost, but Meta's retry will
 * still be forwarded, which is the outcome that matters. Logged loudly because
 * it means the ledger is drifting from reality.
 */
async function safeRelease(provider: WebhookProvider, ids: string[], logPrefix: string) {
  if (ids.length === 0) {
    return;
  }

  try {
    await releaseDeliveries(provider, ids);
  } catch (error) {
    console.error(
      `${logPrefix} Could not release ${ids.length} claimed delivery id(s) — ` +
        `a Meta retry may be skipped as a duplicate.`,
      error
    );
  }
}
