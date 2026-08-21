import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";

export async function GET(req: Request) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [users, total, planStats, roleStats] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          email: true,
          name: true,
          picture: true,
          plan: true,
          role: true,
          region: true,
          creditsBalance: true,
          includedCredits: true,
          creditsUsedThisCycle: true,
          createdAt: true,
          _count: { select: { chatbots: true, workspaces: true } },
        },
      }),
      db.user.count({ where }),
      db.user.groupBy({ by: ["plan"], _count: { plan: true } }),
      db.user.groupBy({ by: ["role"], _count: { role: true } }),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total,
        byPlan: Object.fromEntries(planStats.map((p) => [p.plan, p._count.plan])),
        byRole: Object.fromEntries(roleStats.map((r) => [r.role, r._count.role])),
      },
      permissions: {
        canManageRoles: authResult.role === "super_admin",
      },
    });
  } catch (error) {
    console.error("[ADMIN_USERS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
