import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/core/admin-auth";
import { adminFeedbackFilterSchema } from "@/lib/domain/feedback-schema";
import { listFeedbackForAdmin } from "@/lib/services/feedback";

/**
 * GET /api/admin/feedback
 * ─────────────────────────────────────────────────────────────────────────────
 * The admin queue: status filter, free-text search and pagination, plus the
 * per-status totals the filter tabs display. Mirrors `/api/admin/contacts`.
 */

export async function GET(req: Request) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const url = new URL(req.url);

    const parsed = adminFeedbackFilterSchema.safeParse({
      status: url.searchParams.get("status") ?? "all",
      q: url.searchParams.get("q")?.trim() || undefined,
      page: Number(url.searchParams.get("page") ?? 1),
      limit: Number(url.searchParams.get("limit") ?? 20),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid filter", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { items, total, stats } = await listFeedbackForAdmin(parsed.data);

    return NextResponse.json({
      items,
      pagination: {
        page: parsed.data.page,
        limit: parsed.data.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / parsed.data.limit)),
      },
      stats,
    });
  } catch (error) {
    console.error("[ADMIN_FEEDBACK_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
