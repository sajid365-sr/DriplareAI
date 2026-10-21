import "server-only";

import { dedupeAndForward, type ForwardResult, type WebhookProvider } from "@/lib/core/webhook-idempotency";

/**
 * Multi-message Batching Utility (Feature #17)
 *
 * When a customer sends multiple messages in rapid succession (e.g. 3-second window),
 * this utility buffers the incoming messages by (provider, senderId/sessionId).
 * Instead of firing multiple independent LLM queries and sending multiple fragmented replies,
 * all messages received within the window are merged into a single consolidated turn.
 *
 * VideoScript: "Customer একসাথে অনেকগুলো message দিলে সবগুলো পড়ে, বুঝে এক messageই উত্তর দেয়।"
 */

export const DEFAULT_BATCH_WINDOW_MS = 3000; // 3 seconds sliding window
export const MAX_BATCH_WINDOW_MS = 8000; // 8 seconds maximum wait ceiling

export interface ExtractedMessageInfo {
  senderId: string | null;
  messageId: string | null;
  text: string | null;
  sessionId: string | null;
}

export interface BatchedMessageItem {
  id: string;
  text: string;
  timestamp: number;
  payload: unknown;
}

interface ActiveBatch {
  key: string;
  provider: WebhookProvider;
  senderId: string;
  sessionId: string;
  webhookUrl: string;
  logPrefix: string;
  firstSeen: number;
  timer: NodeJS.Timeout | null;
  messages: BatchedMessageItem[];
  lastPayload: unknown;
}

// In-memory registry of active message batches keyed by `${provider}:${senderId}`
const activeBatches = new Map<string, ActiveBatch>();

/**
 * Extracts sender ID, message ID, text content, and platform session ID from incoming Meta payloads.
 */
export function extractSenderAndMessage(
  provider: WebhookProvider,
  payload: unknown
): ExtractedMessageInfo {
  const root = payload as Record<string, unknown> | null;
  if (!root || typeof root !== "object") {
    return { senderId: null, messageId: null, text: null, sessionId: null };
  }

  const entries = Array.isArray(root.entry) ? root.entry : [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;

    // Messenger / Instagram
    if (provider === "facebook" || provider === "instagram") {
      const rawMessaging = (entry as Record<string, unknown>).messaging;
      const messaging: unknown[] = Array.isArray(rawMessaging) ? rawMessaging : [];

      for (const event of messaging) {
        if (!event || typeof event !== "object") continue;
        const ev = event as Record<string, unknown>;
        const sender = ev.sender as Record<string, unknown> | undefined;
        const message = ev.message as Record<string, unknown> | undefined;

        const senderId = typeof sender?.id === "string" ? sender.id : null;
        const messageId = typeof message?.mid === "string" ? message.mid : null;
        const text = typeof message?.text === "string" ? message.text : null;

        if (senderId) {
          const prefix = provider === "facebook" ? "fb_" : "ig_";
          return {
            senderId,
            messageId,
            text,
            sessionId: `${prefix}${senderId}`,
          };
        }
      }
    }

    // WhatsApp
    if (provider === "whatsapp") {
      const rawChanges = (entry as Record<string, unknown>).changes;
      const changes: unknown[] = Array.isArray(rawChanges) ? rawChanges : [];

      for (const change of changes) {
        if (!change || typeof change !== "object") continue;
        const value = (change as Record<string, unknown>).value as Record<string, unknown> | undefined;
        if (!value) continue;

        const messages = Array.isArray(value.messages) ? value.messages : [];
        for (const msg of messages) {
          if (!msg || typeof msg !== "object") continue;
          const m = msg as Record<string, unknown>;
          const from = typeof m.from === "string" ? m.from : null;
          const id = typeof m.id === "string" ? m.id : null;
          const textBody =
            m.text && typeof m.text === "object"
              ? typeof (m.text as Record<string, unknown>).body === "string"
                ? (m.text as Record<string, unknown>).body as string
                : null
              : null;

          if (from) {
            return {
              senderId: from,
              messageId: id,
              text: textBody,
              sessionId: `wa_${from}`,
            };
          }
        }
      }
    }
  }

  return { senderId: null, messageId: null, text: null, sessionId: null };
}

/**
 * Combines multiple message texts into a single coherent conversational prompt.
 */
export function combineMessages(messages: string[]): string {
  return messages
    .map((m) => m.trim())
    .filter((m) => m.length > 0)
    .join("\n");
}

/**
 * Merges consolidated text into the original Meta webhook payload structure.
 */
export function mergePayloadWithBatchedText(
  provider: WebhookProvider,
  originalPayload: unknown,
  combinedText: string,
  batchedCount: number
): unknown {
  try {
    const cloned = JSON.parse(JSON.stringify(originalPayload)) as Record<string, unknown>;
    const entries = Array.isArray(cloned.entry) ? cloned.entry : [];

    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;

      if (provider === "facebook" || provider === "instagram") {
        const rawMsgArr = (entry as Record<string, unknown>).messaging;
        const messaging: unknown[] = Array.isArray(rawMsgArr) ? rawMsgArr : [];
        for (const event of messaging) {
          const ev = event as Record<string, unknown>;
          if (ev?.message && typeof ev.message === "object") {
            const msgObj = ev.message as Record<string, unknown>;
            msgObj.text = combinedText;
            msgObj.isBatched = batchedCount > 1;
            msgObj.batchedCount = batchedCount;
            return cloned;
          }
        }
      }

      if (provider === "whatsapp") {
        const rawChangesArr = (entry as Record<string, unknown>).changes;
        const changes: unknown[] = Array.isArray(rawChangesArr) ? rawChangesArr : [];
        for (const change of changes) {
          const val = (change as Record<string, unknown>)?.value as Record<string, unknown> | undefined;
          const msgs = Array.isArray(val?.messages) ? val.messages : [];
          for (const msg of msgs) {
            const m = msg as Record<string, unknown>;
            if (m?.text && typeof m.text === "object") {
              const textObj = m.text as Record<string, unknown>;
              textObj.body = combinedText;
              textObj.isBatched = batchedCount > 1;
              textObj.batchedCount = batchedCount;
              m.isBatched = batchedCount > 1;
              m.batchedCount = batchedCount;
              return cloned;
            }
          }
        }
      }
    }

    return cloned;
  } catch {
    return originalPayload;
  }
}

export interface BufferOptions {
  provider: WebhookProvider;
  payload: unknown;
  webhookUrl: string;
  logPrefix: string;
  windowMs?: number;
  maxWindowMs?: number;
  onDispatch?: (result: ForwardResult) => void;
}

export interface BufferResult {
  batched: boolean;
  batchSize: number;
  immediate: boolean;
}

/**
 * Buffers incoming messages by sender/session within a sliding window.
 * If multiple messages arrive within windowMs, they are grouped and forwarded as one combined message.
 */
export async function bufferOrDispatchMessage({
  provider,
  payload,
  webhookUrl,
  logPrefix,
  windowMs = DEFAULT_BATCH_WINDOW_MS,
  maxWindowMs = MAX_BATCH_WINDOW_MS,
  onDispatch,
}: BufferOptions): Promise<BufferResult> {
  const { senderId, messageId, text, sessionId } = extractSenderAndMessage(provider, payload);

  // If there is no text or sender identified (e.g. delivery receipts, read receipts, reactions),
  // forward immediately without buffering.
  if (!senderId || !text || !messageId) {
    const res = await dedupeAndForward({
      provider,
      payload,
      webhookUrl,
      logPrefix,
    });
    onDispatch?.(res);
    return { batched: false, batchSize: 1, immediate: true };
  }

  const key = `${provider}:${senderId}`;
  let batch = activeBatches.get(key);
  const now = Date.now();

  if (!batch) {
    batch = {
      key,
      provider,
      senderId,
      sessionId: sessionId || senderId,
      webhookUrl,
      logPrefix,
      firstSeen: now,
      timer: null,
      messages: [],
      lastPayload: payload,
    };
    activeBatches.set(key, batch);
  }

  // Record this message in the batch
  batch.messages.push({
    id: messageId,
    text,
    timestamp: now,
    payload,
  });
  batch.lastPayload = payload;

  // Clear existing timer if any
  if (batch.timer) {
    clearTimeout(batch.timer);
  }

  // Calculate sliding timeout, strictly respecting maxWindowMs ceiling
  const elapsed = now - batch.firstSeen;
  const remainingUntilMax = Math.max(100, maxWindowMs - elapsed);
  const delay = Math.min(windowMs, remainingUntilMax);

  // Set timeout to dispatch batch
  batch.timer = setTimeout(async () => {
    activeBatches.delete(key);
    await dispatchBatch(batch!, onDispatch);
  }, delay);

  return {
    batched: true,
    batchSize: batch.messages.length,
    immediate: false,
  };
}

/**
 * Flushes and dispatches a batch to the n8n webhook.
 */
async function dispatchBatch(
  batch: ActiveBatch,
  onDispatch?: (result: ForwardResult) => void
): Promise<ForwardResult> {
  const { provider, messages, webhookUrl, logPrefix, lastPayload, senderId } = batch;

  if (messages.length === 0) {
    return { status: 200, body: { empty: true }, duplicate: false, forwarded: false };
  }

  if (messages.length === 1) {
    // Single message — forward original payload directly
    const res = await dedupeAndForward({
      provider,
      payload: messages[0].payload,
      webhookUrl,
      logPrefix,
    });
    onDispatch?.(res);
    return res;
  }

  // Multi-message batch: combine texts
  const allTexts = messages.map((m) => m.text);
  const combinedText = combineMessages(allTexts);

  console.log(
    `${logPrefix} Multi-message batch consolidated: ${messages.length} messages from ${senderId} -> "${combinedText.slice(0, 60)}..."`
  );

  const mergedPayload = mergePayloadWithBatchedText(
    provider,
    lastPayload,
    combinedText,
    messages.length
  );

  const res = await dedupeAndForward({
    provider,
    payload: mergedPayload,
    webhookUrl,
    logPrefix,
  });

  onDispatch?.(res);
  return res;
}

/**
 * Helper to clear all active batches (for testing).
 */
export function clearActiveBatches(): void {
  for (const batch of activeBatches.values()) {
    if (batch.timer) {
      clearTimeout(batch.timer);
    }
  }
  activeBatches.clear();
}

/**
 * Helper to get active batch count (for testing).
 */
export function getActiveBatchCount(): number {
  return activeBatches.size;
}
