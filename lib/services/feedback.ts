import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/core/db";
import { appUrl } from "@/lib/services/mail";
import {
  FEEDBACK_RATE_LIMIT_PER_HOUR,
  type FeedbackStatus,
} from "@/lib/domain/feedback-constants";
import type { AdminFeedbackAction, CreateFeedbackInput } from "@/lib/domain/feedback-schema";

/**
 * Feedback service
 * ─────────────────────────────────────────────────────────────────────────────
 * All business logic for merchant feedback lives here; the API routes only
 * authenticate and dispatch. Same split as `RefundRequest`, so the merchant API
 * and the admin API cannot drift apart in how they read or write a ticket.
 */

// ── Errors ────────────────────────────────────────────────────────────────────

/**
 * A failure the caller can translate into a useful HTTP response. Anything
 * else that escapes this module is an unexpected bug and should surface as 500.
 */
export class FeedbackError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
    this.name = "FeedbackError";
  }
}

// ── Shared shapes ─────────────────────────────────────────────────────────────

const ATTACHMENT_SELECT = {
  id: true,
  kind: true,
  url: true,
  mimeType: true,
  sizeBytes: true,
  fileName: true,
  label: true,
} satisfies Prisma.FeedbackAttachmentSelect;

const REPLY_SELECT = {
  id: true,
  authorType: true,
  authorName: true,
  body: true,
  createdAt: true,
} satisfies Prisma.FeedbackReplySelect;

export type FeedbackAttachmentView = Prisma.FeedbackAttachmentGetPayload<{
  select: typeof ATTACHMENT_SELECT;
}>;

export type FeedbackReplyView = Prisma.FeedbackReplyGetPayload<{ select: typeof REPLY_SELECT }>;

/** One row in the merchant's "My Feedback" list. */
export type MerchantFeedbackSummary = {
  id: string;
  subject: string;
  status: FeedbackStatus;
  createdAt: Date;
  hasUnreadReply: boolean;
  lastReplyAt: Date | null;
  replyCount: number;
  attachmentCount: number;
  /** The newest message in the thread, whichever side wrote it. */
  lastMessage: string;
  lastMessageFrom: "merchant" | "admin";
};

/** Full ticket as shown in either thread view. */
export type FeedbackThreadView = {
  id: string;
  subject: string;
  message: string;
  status: FeedbackStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  pageUrl: string | null;
  userAgent: string | null;
  clientContext: Prisma.JsonValue;
  consoleErrors: Prisma.JsonValue;
  workspaceId: string | null;
  chatbotId: string | null;
  hasUnreadReply: boolean;
  /** Who reported it — only the admin view displays this. */
  merchantName: string;
  merchantEmail: string;
  attachments: FeedbackAttachmentView[];
  replies: FeedbackReplyView[];
};

// ── Merchant: create ──────────────────────────────────────────────────────────

/**
 * Stores a new feedback ticket together with its attachments.
 *
 * The rate limit is checked here rather than in the route so that every caller
 * — including any future server-side one — is bound by it.
 */
export async function createFeedback(args: {
  userId: string;
  userName: string;
  userEmail: string;
  input: CreateFeedbackInput;
}): Promise<{ id: string }> {
  const { userId, input } = args;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await db.feedback.count({
    where: { userId, createdAt: { gte: oneHourAgo } },
  });

  if (recentCount >= FEEDBACK_RATE_LIMIT_PER_HOUR) {
    throw new FeedbackError(
      `You can submit at most ${FEEDBACK_RATE_LIMIT_PER_HOUR} feedbacks per hour. Please try again later.`,
      429,
      "RATE_LIMITED"
    );
  }

  const created = await db.feedback.create({
    data: {
      userId,
      workspaceId: input.workspaceId ?? null,
      chatbotId: input.chatbotId ?? null,
      subject: input.subject,
      message: input.message,
      pageUrl: input.pageUrl ?? null,
      userAgent: input.userAgent ?? null,
      clientContext: (input.clientContext ?? {}) as Prisma.InputJsonObject,
      consoleErrors: (input.consoleErrors ?? []) as Prisma.InputJsonArray,
      status: "open",
      attachments: input.attachments?.length
        ? {
            create: input.attachments.map((a) => ({
              kind: a.kind,
              url: a.url,
              publicId: a.publicId ?? null,
              mimeType: a.mimeType ?? null,
              sizeBytes: a.sizeBytes,
              fileName: a.fileName ?? null,
              label: a.label ?? a.fileName ?? null,
            })),
          }
        : undefined,
    },
    select: { id: true, subject: true, pageUrl: true, workspaceId: true, chatbotId: true },
  });

  // Notifications are best-effort: the ticket is already saved, so a mail or
  // notification failure must not turn a successful submission into a 500.
  await notifyAdminsOfFeedback({
    id: created.id,
    subject: created.subject,
    message: input.message,
    pageUrl: created.pageUrl,
    workspaceId: created.workspaceId,
    chatbotId: created.chatbotId,
    merchantName: args.userName,
    merchantEmail: args.userEmail,
    attachments: (input.attachments ?? []).map((a) => ({
      kind: a.kind,
      label: a.label ?? a.fileName ?? a.kind,
    })),
  });

  return { id: created.id };
}

// ── Merchant: read ────────────────────────────────────────────────────────────

/**
 * The merchant's own list, newest first. Each row carries only its newest
 * message so the list stays a single query — the full thread is fetched on
 * demand by `getFeedbackThread`.
 */
export async function listFeedbackForUser(userId: string): Promise<MerchantFeedbackSummary[]> {
  const rows = await db.feedback.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      subject: true,
      message: true,
      status: true,
      createdAt: true,
      hasUnreadReply: true,
      lastReplyAt: true,
      replyCount: true,
      _count: { select: { attachments: true } },
      replies: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, authorType: true },
      },
    },
  });

  return rows.map((row) => {
    const newest = row.replies[0];
    return {
      id: row.id,
      subject: row.subject,
      status: row.status as FeedbackStatus,
      createdAt: row.createdAt,
      hasUnreadReply: row.hasUnreadReply,
      lastReplyAt: row.lastReplyAt,
      replyCount: row.replyCount,
      attachmentCount: row._count.attachments,
      // With no replies yet, the opening message is the newest thing said.
      lastMessage: newest?.body ?? row.message,
      lastMessageFrom: (newest?.authorType ?? "merchant") as "merchant" | "admin",
    };
  });
}

/** Full ticket + conversation. Throws 404 if it is not this merchant's. */
export async function getFeedbackThread(args: {
  feedbackId: string;
  /** Omit for an admin read — ownership is then not enforced. */
  userId?: string;
}): Promise<FeedbackThreadView> {
  const row = await db.feedback.findUnique({
    where: { id: args.feedbackId },
    select: {
      id: true,
      userId: true,
      subject: true,
      message: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
      pageUrl: true,
      userAgent: true,
      clientContext: true,
      consoleErrors: true,
      workspaceId: true,
      chatbotId: true,
      hasUnreadReply: true,
      user: { select: { name: true, email: true } },
      attachments: { select: ATTACHMENT_SELECT, orderBy: { createdAt: "asc" } },
      replies: { select: REPLY_SELECT, orderBy: { createdAt: "asc" } },
    },
  });

  if (!row) {
    throw new FeedbackError("Feedback not found", 404, "NOT_FOUND");
  }

  if (args.userId && row.userId !== args.userId) {
    // Same 404 as "missing" — a merchant must not be able to probe which ids exist.
    throw new FeedbackError("Feedback not found", 404, "NOT_FOUND");
  }

  const { userId: _owner, user, ...view } = row;
  return {
    ...view,
    status: view.status as FeedbackStatus,
    merchantName: user.name,
    merchantEmail: user.email,
  };
}

/** Unread admin replies — drives the dot on the header's Feedback button. */
export async function countUnreadFeedbackReplies(userId: string): Promise<number> {
  return db.feedback.count({ where: { userId, hasUnreadReply: true } });
}

// ── Merchant: act ─────────────────────────────────────────────────────────────

/**
 * The merchant answers back. Replying to a ticket that was already resolved
 * reopens it, because the merchant clearly still has something to say.
 */
export async function addMerchantReply(args: {
  userId: string;
  authorName: string;
  feedbackId: string;
  body: string;
}): Promise<FeedbackReplyView> {
  const ticket = await db.feedback.findUnique({
    where: { id: args.feedbackId },
    select: { id: true, userId: true, status: true },
  });

  if (!ticket || ticket.userId !== args.userId) {
    throw new FeedbackError("Feedback not found", 404, "NOT_FOUND");
  }

  const reopen = ticket.status === "resolved" || ticket.status === "closed";

  const [reply] = await db.$transaction([
    db.feedbackReply.create({
      data: {
        feedbackId: ticket.id,
        authorType: "merchant",
        authorId: args.userId,
        authorName: args.authorName,
        body: args.body,
      },
      select: REPLY_SELECT,
    }),
    db.feedback.update({
      where: { id: ticket.id },
      data: {
        replyCount: { increment: 1 },
        lastReplyAt: new Date(),
        // The merchant has now read whatever the admin wrote.
        hasUnreadReply: false,
        ...(reopen ? { status: "open", resolvedAt: null, resolvedBy: null } : {}),
      },
    }),
  ]);

  return reply;
}

/** Clears the unread dot once the merchant opens the thread. */
export async function markFeedbackRead(args: {
  userId: string;
  feedbackId: string;
}): Promise<void> {
  const result = await db.feedback.updateMany({
    where: { id: args.feedbackId, userId: args.userId },
    data: { hasUnreadReply: false },
  });

  if (result.count === 0) {
    throw new FeedbackError("Feedback not found", 404, "NOT_FOUND");
  }
}

// ── Admin: read ───────────────────────────────────────────────────────────────

export type AdminFeedbackRow = {
  id: string;
  subject: string;
  status: FeedbackStatus;
  createdAt: Date;
  updatedAt: Date;
  lastReplyAt: Date | null;
  replyCount: number;
  pageUrl: string | null;
  merchant: { name: string; email: string };
  attachmentCount: number;
  messagePreview: string;
};

export type AdminFeedbackStats = Record<FeedbackStatus, number> & { total: number };

/**
 * Paginated admin queue. `q` searches subject, message and the merchant's
 * name/email — the three things an admin actually has to go on when a merchant
 * says "my bot broke yesterday".
 */
export async function listFeedbackForAdmin(filter: {
  status: FeedbackStatus | "all";
  q?: string;
  page: number;
  limit: number;
}): Promise<{ items: AdminFeedbackRow[]; total: number; stats: AdminFeedbackStats }> {
  const where: Prisma.FeedbackWhereInput = {
    ...(filter.status !== "all" ? { status: filter.status } : {}),
    ...(filter.q
      ? {
          OR: [
            { subject: { contains: filter.q, mode: "insensitive" } },
            { message: { contains: filter.q, mode: "insensitive" } },
            { user: { is: { name: { contains: filter.q, mode: "insensitive" } } } },
            { user: { is: { email: { contains: filter.q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [rows, total, grouped] = await Promise.all([
    db.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
      select: {
        id: true,
        subject: true,
        message: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastReplyAt: true,
        replyCount: true,
        pageUrl: true,
        user: { select: { name: true, email: true } },
        _count: { select: { attachments: true } },
      },
    }),
    db.feedback.count({ where }),
    // Counted over the whole table, not the filtered page — the status tabs
    // must keep showing totals while a search is active.
    db.feedback.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const stats = { open: 0, in_progress: 0, resolved: 0, closed: 0, total: 0 } as AdminFeedbackStats;
  for (const group of grouped) {
    const key = group.status as FeedbackStatus;
    if (key in stats) stats[key] = group._count._all;
    stats.total += group._count._all;
  }

  return {
    items: rows.map((row) => ({
      id: row.id,
      subject: row.subject,
      status: row.status as FeedbackStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastReplyAt: row.lastReplyAt,
      replyCount: row.replyCount,
      pageUrl: row.pageUrl,
      merchant: row.user,
      attachmentCount: row._count.attachments,
      messagePreview: row.message.slice(0, 160),
    })),
    total,
    stats,
  };
}

// ── Admin: act ────────────────────────────────────────────────────────────────

/**
 * Applies an admin action to a ticket.
 *
 * Replying always flags the ticket for the merchant; the optional `status` on a
 * reply is how an admin says "here is the fix, and this is done" in one step.
 */
export async function applyAdminFeedbackAction(args: {
  admin: { userId: string; name: string };
  feedbackId: string;
  action: AdminFeedbackAction;
}): Promise<{ status: FeedbackStatus; reply?: FeedbackReplyView }> {
  const ticket = await db.feedback.findUnique({
    where: { id: args.feedbackId },
    select: { id: true, userId: true, subject: true, status: true },
  });

  if (!ticket) {
    throw new FeedbackError("Feedback not found", 404, "NOT_FOUND");
  }

  if (args.action.action === "set_status") {
    await setFeedbackStatus({
      admin: args.admin,
      feedbackId: ticket.id,
      userId: ticket.userId,
      subject: ticket.subject,
      previousStatus: ticket.status as FeedbackStatus,
      status: args.action.status,
    });
    return { status: args.action.status };
  }

  const nextStatus = args.action.status;
  const reply = await addAdminReply({
    admin: args.admin,
    feedbackId: ticket.id,
    userId: ticket.userId,
    subject: ticket.subject,
    body: args.action.body,
    status: nextStatus,
  });

  return { status: nextStatus ?? (ticket.status as FeedbackStatus), reply };
}

/** Admin answer. Returns the stored reply; the merchant is notified. */
export async function addAdminReply(args: {
  admin: { userId: string; name: string };
  feedbackId: string;
  userId: string;
  subject: string;
  body: string;
  status?: FeedbackStatus;
}): Promise<FeedbackReplyView> {
  const resolvedNow = args.status === "resolved";

  const [reply] = await db.$transaction([
    db.feedbackReply.create({
      data: {
        feedbackId: args.feedbackId,
        authorType: "admin",
        authorId: args.admin.userId,
        authorName: args.admin.name,
        body: args.body,
      },
      select: REPLY_SELECT,
    }),
    db.feedback.update({
      where: { id: args.feedbackId },
      data: {
        replyCount: { increment: 1 },
        lastReplyAt: new Date(),
        hasUnreadReply: true,
        ...(args.status
          ? {
              status: args.status,
              resolvedAt: resolvedNow ? new Date() : null,
              resolvedBy: resolvedNow ? args.admin.userId : null,
            }
          : {}),
      },
    }),
  ]);

  await notifyMerchantOfFeedbackReply({
    userId: args.userId,
    feedbackId: args.feedbackId,
    subject: args.subject,
    replyBody: args.body,
    statusLabel: args.status ?? null,
  });

  return reply;
}

/** Status-only change. The merchant is told when the ticket is resolved. */
async function setFeedbackStatus(args: {
  admin: { userId: string; name: string };
  feedbackId: string;
  userId: string;
  subject: string;
  previousStatus: FeedbackStatus;
  status: FeedbackStatus;
}): Promise<void> {
  if (args.previousStatus === args.status) return;

  const resolvedNow = args.status === "resolved";

  await db.feedback.update({
    where: { id: args.feedbackId },
    data: {
      status: args.status,
      resolvedAt: resolvedNow ? new Date() : null,
      resolvedBy: resolvedNow ? args.admin.userId : null,
    },
  });

  await notifyMerchantOfFeedbackReply({
    userId: args.userId,
    feedbackId: args.feedbackId,
    subject: args.subject,
    replyBody: null,
    statusLabel: args.status,
  });
}

// ── Notifications ─────────────────────────────────────────────────────────────

/** Admin-দের in-app notification, যাতে নতুন ticket দ্রুত চোখে পড়ে। */
async function notifyAdminsOfFeedback(args: {
  id: string;
  subject: string;
  message: string;
  pageUrl: string | null;
  workspaceId: string | null;
  chatbotId: string | null;
  merchantName: string;
  merchantEmail: string;
  attachments: { kind: string; label: string }[];
}): Promise<void> {
  const feedbackUrl = appUrl(`/admin/feedback?id=${args.id}`);

  try {
    const admins = await db.user.findMany({
      where: { role: { in: ["admin", "super_admin"] } },
      select: { userId: true },
    });

    if (admins.length > 0) {
      await db.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.userId,
          type: "system",
          title: "New Merchant Feedback",
          message: `${args.merchantName} (${args.merchantEmail}): ${args.subject}`,
        })),
      });
    }
  } catch (err) {
    console.error("[FEEDBACK_ADMIN_NOTIFY_ERROR]", err);
  }

  const adminEmail = process.env.ADMIN_CONTACT_EMAIL;
  if (!adminEmail) return;

  try {
    const { sendMail, MailTemplates } = await import("@/lib/services/mail");
    await sendMail({
      to: adminEmail,
      subject: `[Driplare] Feedback — ${args.subject}`,
      html: MailTemplates.feedbackReceived({
        merchantName: args.merchantName,
        merchantEmail: args.merchantEmail,
        subject: args.subject,
        message: args.message,
        pageUrl: args.pageUrl,
        workspaceId: args.workspaceId,
        chatbotId: args.chatbotId,
        attachments: args.attachments,
        feedbackUrl,
      }),
    });
  } catch (err) {
    console.error("[FEEDBACK_ADMIN_EMAIL_ERROR]", err);
  }
}

/**
 * Merchant-কে admin-এর উত্তর বা status পরিবর্তনের খবর।
 *
 * ⚠️ এখানে `notificationSettings`-এর billing switch চেক করা হয় না — এটি
 * merchant নিজে শুরু করা একটি কথোপকথনের সরাসরি উত্তর, তাই চুপ করে থাকলে তিনি
 * উত্তর পাবেন না বলে ভাববেন। Billing/marketing mail-এর নিয়ম এখানে প্রযোজ্য নয়।
 */
async function notifyMerchantOfFeedbackReply(args: {
  userId: string;
  feedbackId: string;
  subject: string;
  replyBody: string | null;
  statusLabel: string | null;
}): Promise<void> {
  const feedbackUrl = appUrl("/dashboard");

  try {
    await db.notification.create({
      data: {
        userId: args.userId,
        type: "system",
        title: args.statusLabel === "resolved" ? "Feedback Resolved" : "New Reply on Your Feedback",
        message: args.replyBody
          ? `Our team replied to "${args.subject}": ${args.replyBody.slice(0, 140)}`
          : `Your feedback "${args.subject}" is now ${args.statusLabel}.`,
      },
    });
  } catch (err) {
    console.error("[FEEDBACK_MERCHANT_NOTIFY_ERROR]", err);
  }

  try {
    const user = await db.user.findUnique({
      where: { userId: args.userId },
      select: { name: true, email: true },
    });

    if (!user) return;

    const { sendMail, MailTemplates } = await import("@/lib/services/mail");
    await sendMail({
      to: user.email,
      subject: `Update on your feedback — ${args.subject}`,
      html: MailTemplates.feedbackReply({
        name: user.name,
        subject: args.subject,
        replyBody: args.replyBody,
        statusLabel: args.statusLabel,
        feedbackUrl,
      }),
    });
  } catch (err) {
    console.error("[FEEDBACK_MERCHANT_EMAIL_ERROR]", err);
  }
}
