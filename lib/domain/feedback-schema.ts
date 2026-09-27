import { z } from "zod";
import {
  FEEDBACK_ATTACHMENT_KINDS,
  FEEDBACK_STATUSES,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
} from "./feedback-constants";

/**
 * Feedback domain schemas
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared by the merchant-facing API (`/api/feedback`) and the admin API
 * (`/api/admin/feedback`). Keeping the limits here means the client picker and
 * the server agree on what is acceptable — the client-side check is a courtesy
 * to the user, these schemas are the actual gate.
 *
 * Limits, statuses, kinds and the MIME map live in `feedback-constants.ts` so
 * client components can use them without importing `zod`.
 */

// Re-exported so callers have one obvious import for anything feedback-domain.
export * from "./feedback-constants";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const feedbackStatusSchema = z.enum(FEEDBACK_STATUSES);

export const feedbackAttachmentKindSchema = z.enum(FEEDBACK_ATTACHMENT_KINDS);

// ── Create ────────────────────────────────────────────────────────────────────

export const feedbackAttachmentInputSchema = z.object({
  kind: feedbackAttachmentKindSchema,
  url: z.string().url().max(600),
  publicId: z.string().max(400).optional(),
  mimeType: z.string().max(120).optional(),
  sizeBytes: z.number().int().nonnegative().max(MAX_ATTACHMENT_BYTES),
  fileName: z.string().max(200).optional(),
  /** "Auto screenshot" for the captured one, otherwise the original file name. */
  label: z.string().max(120).optional(),
});

export const createFeedbackSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(5000),
  workspaceId: z.string().max(200).optional(),
  chatbotId: z.string().max(200).optional(),
  /** Pathname only — the client strips query strings before sending. */
  pageUrl: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
  clientContext: z.record(z.string(), z.unknown()).optional(),
  consoleErrors: z.array(z.string().max(500)).max(10).optional(),
  attachments: z.array(feedbackAttachmentInputSchema).max(MAX_ATTACHMENTS).optional(),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;

// ── Thread ────────────────────────────────────────────────────────────────────

export const feedbackReplySchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export type FeedbackReplyInput = z.infer<typeof feedbackReplySchema>;

// ── Merchant actions on their own feedback ────────────────────────────────────

export const feedbackActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_read") }),
]);

// ── Admin actions ─────────────────────────────────────────────────────────────

export const adminFeedbackActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reply"),
    body: z.string().trim().min(1).max(5000),
    /** Optionally move the ticket along while replying. */
    status: feedbackStatusSchema.optional(),
  }),
  z.object({
    action: z.literal("set_status"),
    status: feedbackStatusSchema,
  }),
]);

export type AdminFeedbackAction = z.infer<typeof adminFeedbackActionSchema>;

// ── Admin list filters ────────────────────────────────────────────────────────

export const adminFeedbackFilterSchema = z.object({
  status: z.union([feedbackStatusSchema, z.literal("all")]).default("all"),
  q: z.string().trim().max(120).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20),
});
