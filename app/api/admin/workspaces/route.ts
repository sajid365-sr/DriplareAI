import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";

// Estimated Monthly Plan Revenue in BDT for unit economics
const PLAN_MONTHLY_REVENUE_BDT: Record<string, number> = {
  starter: 0,
  growth: 2990,
  pro: 7990,
  agency: 14990,
  enterprise: 19900,
};

export async function GET(req: Request) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { user: { email: { contains: search, mode: "insensitive" as const } } },
            { user: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {};

    const [workspaces, totalCount, usageAggregates] = await Promise.all([
      db.workspace.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              userId: true,
              email: true,
              name: true,
              picture: true,
              plan: true,
              region: true,
              creditsBalance: true,
              creditsUsedThisCycle: true,
              createdAt: true,
            },
          },
          _count: {
            select: { chatbots: true },
          },
        },
      }),
      db.workspace.count({ where }),
      db.aIUsageLog.groupBy({
        by: ["workspaceId", "userId"],
        _sum: {
          totalTokens: true,
          promptTokens: true,
          completionTokens: true,
          costUsd: true,
          costBdt: true,
        },
        _count: {
          id: true,
        },
      }),
    ]);

    // Map usage statistics by workspaceId and userId
    const usageMapByWorkspace = new Map<string, { totalTokens: number; costUsd: number; costBdt: number; messages: number }>();
    const usageMapByUser = new Map<string, { totalTokens: number; costUsd: number; costBdt: number; messages: number }>();

    for (const item of usageAggregates) {
      const stats = {
        totalTokens: item._sum.totalTokens ?? 0,
        costUsd: item._sum.costUsd ?? 0,
        costBdt: item._sum.costBdt ?? 0,
        messages: item._count.id ?? 0,
      };

      if (item.workspaceId) {
        const existing = usageMapByWorkspace.get(item.workspaceId) || { totalTokens: 0, costUsd: 0, costBdt: 0, messages: 0 };
        usageMapByWorkspace.set(item.workspaceId, {
          totalTokens: existing.totalTokens + stats.totalTokens,
          costUsd: existing.costUsd + stats.costUsd,
          costBdt: existing.costBdt + stats.costBdt,
          messages: existing.messages + stats.messages,
        });
      }

      if (item.userId) {
        const existing = usageMapByUser.get(item.userId) || { totalTokens: 0, costUsd: 0, costBdt: 0, messages: 0 };
        usageMapByUser.set(item.userId, {
          totalTokens: existing.totalTokens + stats.totalTokens,
          costUsd: existing.costUsd + stats.costUsd,
          costBdt: existing.costBdt + stats.costBdt,
          messages: existing.messages + stats.messages,
        });
      }
    }

    // Process each workspace unit economics
    const items = workspaces.map((ws) => {
      const wsUsage = usageMapByWorkspace.get(ws.workspaceId) || usageMapByUser.get(ws.userId) || {
        totalTokens: 0,
        costUsd: 0,
        costBdt: 0,
        messages: 0,
      };

      const planKey = (ws.user.plan || "starter").toLowerCase();
      const revenueBdt = PLAN_MONTHLY_REVENUE_BDT[planKey] ?? 0;
      const apiCostBdt = Math.round(wsUsage.costBdt * 100) / 100;
      const apiCostUsd = Math.round(wsUsage.costUsd * 10000) / 10000;
      const netProfitBdt = Math.round((revenueBdt - apiCostBdt) * 100) / 100;

      let netMarginPercent = 100;
      if (revenueBdt > 0) {
        netMarginPercent = Math.round((netProfitBdt / revenueBdt) * 100);
      } else if (apiCostBdt > 0) {
        netMarginPercent = -100;
      }

      const isHighCostAlert = apiCostBdt > (revenueBdt > 0 ? revenueBdt * 0.8 : 50);

      return {
        id: ws.id,
        workspaceId: ws.workspaceId,
        name: ws.name,
        logoUrl: ws.logoUrl,
        status: (ws as any).status || "active",
        createdAt: ws.createdAt,
        owner: {
          userId: ws.user.userId,
          name: ws.user.name,
          email: ws.user.email,
          picture: ws.user.picture,
          plan: ws.user.plan,
          region: ws.user.region,
          creditsBalance: ws.user.creditsBalance,
          creditsUsedThisCycle: ws.user.creditsUsedThisCycle,
        },
        stats: {
          activeChatbots: ws._count.chatbots,
          totalMessages: wsUsage.messages,
          totalTokens: wsUsage.totalTokens,
          apiCostUsd,
          apiCostBdt,
          revenueBdt,
          netProfitBdt,
          netMarginPercent,
          isHighCostAlert,
        },
      };
    });

    // Global Financial Summary KPIs across all items
    const summary = items.reduce(
      (acc, item) => {
        acc.totalMrrBdt += item.stats.revenueBdt;
        acc.totalApiCostUsd += item.stats.apiCostUsd;
        acc.totalApiCostBdt += item.stats.apiCostBdt;
        acc.totalNetProfitBdt += item.stats.netProfitBdt;
        if (item.stats.isHighCostAlert) acc.highCostAlertCount += 1;
        return acc;
      },
      {
        totalMrrBdt: 0,
        totalApiCostUsd: 0,
        totalApiCostBdt: 0,
        totalNetProfitBdt: 0,
        highCostAlertCount: 0,
      }
    );

    summary.totalApiCostUsd = Math.round(summary.totalApiCostUsd * 100) / 100;
    summary.totalApiCostBdt = Math.round(summary.totalApiCostBdt * 100) / 100;
    summary.totalNetProfitBdt = Math.round(summary.totalNetProfitBdt * 100) / 100;

    const overallMarginPercent = summary.totalMrrBdt > 0
      ? Math.round((summary.totalNetProfitBdt / summary.totalMrrBdt) * 100)
      : summary.totalApiCostBdt > 0 ? -100 : 100;

    return NextResponse.json({
      workspaces: items,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      kpiSummary: {
        totalWorkspaces: totalCount,
        totalMrrBdt: summary.totalMrrBdt,
        totalApiCostUsd: summary.totalApiCostUsd,
        totalApiCostBdt: summary.totalApiCostBdt,
        totalNetProfitBdt: summary.totalNetProfitBdt,
        overallMarginPercent,
        highCostAlertCount: summary.highCostAlertCount,
      },
    });
  } catch (error) {
    console.error("[ADMIN_WORKSPACES_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
