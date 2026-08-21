import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";

export async function GET(req: Request) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;

    const where = status && status !== "all" ? { status } : {};

    const [submissions, total, stats] = await Promise.all([
      db.contactSubmission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.contactSubmission.count({ where }),
      db.contactSubmission.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
    ]);

    const statusCounts = Object.fromEntries(
      stats.map((s) => [s.status, s._count.status])
    );

    return NextResponse.json({
      submissions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        new: statusCounts.new ?? 0,
        read: statusCounts.read ?? 0,
        replied: statusCounts.replied ?? 0,
        archived: statusCounts.archived ?? 0,
        total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      },
    });
  } catch (error) {
    console.error("[ADMIN_CONTACTS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
