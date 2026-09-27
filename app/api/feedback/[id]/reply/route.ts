import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/core/auth";
import { feedbackReplySchema } from "@/lib/domain/feedback-schema";
import { FeedbackError, addMerchantReply } from "@/lib/services/feedback";

/**
 * POST /api/feedback/[id]/reply
 * ─────────────────────────────────────────────────────────────────────────────
 * The merchant answers back inside an existing thread. Replying to a ticket
 * that was already resolved reopens it (handled in the service).
 */

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = feedbackReplySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id } = await params;

    const reply = await addMerchantReply({
      userId: user.userId,
      authorName: user.name || user.email,
      feedbackId: id,
      body: parsed.data.body,
    });

    return NextResponse.json({ success: true, reply }, { status: 201 });
  } catch (error) {
    if (error instanceof FeedbackError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("[FEEDBACK_REPLY_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
