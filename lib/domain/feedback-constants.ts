/**
 * Feedback constants and MIME mapping.
 * ─────────────────────────────────────────────────────────────────────────────
 * Deliberately free of `zod`, so client components (the attachment picker, the
 * uploader) can import the limits and the MIME map without pulling the whole
 * validation library into the browser bundle. The schemas live in
 * `feedback-schema.ts` and build on these values.
 */

/** Maximum number of files a merchant may attach to one feedback. */
export const MAX_ATTACHMENTS = 5;

/** Per-file ceiling. Matches the client-side check in the attachment picker. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** How many feedbacks one merchant may open per hour — a cheap spam guard. */
export const FEEDBACK_RATE_LIMIT_PER_HOUR = 5;

export const FEEDBACK_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_ATTACHMENT_KINDS = ["image", "audio", "video"] as const;
export type FeedbackAttachmentKind = (typeof FEEDBACK_ATTACHMENT_KINDS)[number];

/** Which side of the conversation a reply came from. */
export const FEEDBACK_AUTHOR_TYPES = ["merchant", "admin"] as const;
export type FeedbackAuthorType = (typeof FEEDBACK_AUTHOR_TYPES)[number];

/**
 * MIME → attachment kind. Used by the client picker *and* re-checked server
 * side, because a MIME type is trivially spoofed by a malicious client.
 * An unknown MIME type resolves to `null` and is rejected — never guessed at.
 */
export const FEEDBACK_MIME_KINDS: Record<string, FeedbackAttachmentKind> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
  "audio/mp4": "audio",
  "audio/x-m4a": "audio",
  "audio/m4a": "audio",
  "audio/ogg": "audio",
  "audio/webm": "audio",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "video/x-matroska": "video",
};

/** Resolve the attachment kind for a MIME type, or `null` when unsupported. */
export function resolveAttachmentKind(mimeType: string): FeedbackAttachmentKind | null {
  return FEEDBACK_MIME_KINDS[mimeType] ?? null;
}
