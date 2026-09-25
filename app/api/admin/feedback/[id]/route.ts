import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/core/admin-auth";
import { adminFeedbackActionSchema } from "@/lib/domain/feedback-schema";
import {
  FeedbackError,
  applyAdminFeedbackAction,
  getFeedbackThread,
} from "@/lib/services/feedback";

/**
 * /api/admin/feedback/[id]
 * ─────────────────────────────────────────────────────────────────────────────
 *   GET   — the full ticket: merchant context, attachments and the whole thread.
 *   PATCH — `{ action: "reply", body, status? }` or `{ action: "set_status" }`.
 *
 * Replying (or resolving) notifies the merchant by email and in-app
 * notification — both are handled inside the service.
 */

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    // No userId is passed, so ownership is not enforced — this is the admin view.
    const thread = await getFeedbackThread({ feedbackId: id });

    return NextResponse.json({ thread });
  } catch (error) {
    if (error instanceof FeedbackError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("[ADMIN_FEEDBACK_DETAIL_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const parsed = adminFeedbackActionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id } = await params;

    const result = await applyAdminFeedbackAction({
      admin: {
        userId: authResult.userId,
        // Shown in the thread as the reply's author, so use a human label.
        name: authResult.user.name || authResult.user.email,
      },
      feedbackId: id,
      action: parsed.data,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof FeedbackError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("[ADMIN_FEEDBACK_DETAIL_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
