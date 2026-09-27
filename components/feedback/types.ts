import type { FeedbackAttachmentKind, FeedbackStatus } from "@/lib/domain/feedback-constants";

/**
 * Shared client-side types for the feedback UI.
 * ─────────────────────────────────────────────────────────────────────────────
 * `StagedAttachment` is what the composer holds while composing: a local `File`
 * that has not been uploaded yet. Uploading happens at submit time (see
 * `FeedbackComposer`), so removing an attachment before sending costs nothing
 * and never leaves an orphaned asset in Cloudinary.
 */

export type AttachmentStatus = "staged" | "uploading" | "done" | "error";

export type StagedAttachment = {
  /** Local id — a file has no stable identity of its own before upload. */
  id: string;
  file: File;
  kind: FeedbackAttachmentKind;
  /** Object URL for image/video previews. `null` for audio. */
  previewUrl: string | null;
  label: string;
  status: AttachmentStatus;
  /** 0–100, only meaningful while `status === "uploading"`. */
  progress: number;
  error?: string;
};

/** One row in the merchant's feedback list, as returned by `GET /api/feedback`. */
export type MerchantFeedbackSummary = {
  id: string;
  subject: string;
  status: FeedbackStatus;
  createdAt: string;
  hasUnreadReply: boolean;
  lastReplyAt: string | null;
  replyCount: number;
  attachmentCount: number;
  lastMessage: string;
  lastMessageFrom: "merchant" | "admin";
};

/** A stored reply, as returned inside a thread. */
export type FeedbackReplyView = {
  id: string;
  authorType: "merchant" | "admin";
  authorName: string;
  body: string;
  createdAt: string;
};

/** A stored attachment. */
export type FeedbackAttachmentView = {
  id: string;
  kind: FeedbackAttachmentKind;
  url: string;
  mimeType: string | null;
  sizeBytes: number;
  fileName: string | null;
  label: string | null;
};

/** A full ticket — the shape both the merchant and the admin thread views use. */
export type FeedbackThreadView = {
  id: string;
  subject: string;
  message: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  pageUrl: string | null;
  userAgent: string | null;
  clientContext: Record<string, unknown>;
  consoleErrors: string[];
  workspaceId: string | null;
  chatbotId: string | null;
  hasUnreadReply: boolean;
  /** Who reported it — only the admin view displays this. */
  merchantName: string;
  merchantEmail: string;
  attachments: FeedbackAttachmentView[];
  replies: FeedbackReplyView[];
};
