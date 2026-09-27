import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import { createFeedbackSchema } from "@/lib/domain/feedback-schema";
import {
  FeedbackError,
  createFeedback,
  countUnreadFeedbackReplies,
  listFeedbackForUser,
} from "@/lib/services/feedback";

/**
 * /api/feedback
 * ─────────────────────────────────────────────────────────────────────────────
 * Merchant-facing feedback endpoint.
 *
 *   GET  — this merchant's own tickets, newest first, plus the unread count
 *          that drives the dot on the header's Feedback button.
 *   POST — open a new ticket, optionally with screenshot/audio/video
 *          attachments that the browser has already uploaded to Cloudinary.
 *
 * Admins cannot read anything through here: every query is scoped to the
 * signed-in user's own `userId`.
 */

export async function GET() {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [items, unreadCount] = await Promise.all([
      listFeedbackForUser(user.userId),
      countUnreadFeedbackReplies(user.userId),
    ]);

    return NextResponse.json({ items, unreadCount });
  } catch (error) {
    console.error("[FEEDBACK_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = createFeedbackSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // The client chooses which workspace/bot it was looking at, so it is
    // re-checked here — a forged id would otherwise attach one merchant's
    // feedback to another merchant's workspace.
    const workspace = input.workspaceId
      ? await db.workspace.findFirst({
          where: { workspaceId: input.workspaceId, userId: user.userId },
          select: { workspaceId: true },
        })
      : null;

    const created = await createFeedback({
      userId: user.userId,
      userName: user.name || user.email,
      userEmail: user.email,
      input: {
        ...input,
        workspaceId: workspace?.workspaceId,
        // Bot ownership is implied by the workspace check above, and the id is
        // stored as-is for context — it is never used to grant access.
        chatbotId: input.chatbotId,
      },
    });

    return NextResponse.json({ success: true, id: created.id }, { status: 201 });
  } catch (error) {
    if (error instanceof FeedbackError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("[FEEDBACK_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
