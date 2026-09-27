import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/core/auth";
import { feedbackActionSchema } from "@/lib/domain/feedback-schema";
import { FeedbackError, getFeedbackThread, markFeedbackRead } from "@/lib/services/feedback";

/**
 * /api/feedback/[id]
 * ─────────────────────────────────────────────────────────────────────────────
 *   GET   — the full conversation for one of this merchant's own tickets.
 *   PATCH — `{ action: "mark_read" }`, clears the unread dot after the
 *           merchant opens the thread.
 *
 * Ownership is enforced inside the service, which answers 404 (not 403) for
 * someone else's ticket so ids cannot be probed.
 */

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const thread = await getFeedbackThread({ feedbackId: id, userId: user.userId });

    return NextResponse.json({ thread });
  } catch (error) {
    if (error instanceof FeedbackError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("[FEEDBACK_DETAIL_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = feedbackActionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    const { id } = await params;

    if (parsed.data.action === "mark_read") {
      await markFeedbackRead({ userId: user.userId, feedbackId: id });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof FeedbackError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("[FEEDBACK_DETAIL_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
