import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";
import { getUsdToBdtRate } from "@/lib/ai/credit-resolver";
import { computeUnitEconomics } from "@/lib/domain/unit-economics";

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
          // ⚠️ `costBdt` এখানে যোগ করা হয় না — প্রতিটি লগে সেটা reply হওয়ার
          //    মুহূর্তের রেটে জমা হয়ে যায়। পুরনো লগ ১২০-এ আর নতুন লগ ১৩০-এ
          //    থাকলে MRR/লাভের হিসাব মিশ্র রেটে ভুল দেখাত। তাই কেবল USD যোগ
          //    করে নিচে **এখনকার** রেটে একবার রূপান্তর করা হয়।
        },
        _count: {
          id: true,
        },
      }),
    ]);

    const usdToBdtRate = await getUsdToBdtRate();

    // Map usage statistics by workspaceId only.
    //
    // ⚠️ There used to be a second map keyed by `userId`, used as a fallback when
    //    a workspace had no rows of its own. That fallback was wrong: a usage row
    //    carries *both* the owner and the workspace, so the per-user total already
    //    contains every one of that owner's workspaces — and a second workspace of
    //    the same owner was therefore shown the first one's spend as well. It also
    //    inflated the platform KPIs, which are the sum of the rows on this page.
    //    Rows with no `workspaceId` at all are spend that cannot be charged to any
    //    workspace, and understating nothing is better than charging it to all of
    //    them; `/admin/observability` lists that spend separately as unattributed.
    const usageMapByWorkspace = new Map<string, { totalTokens: number; costUsd: number; messages: number }>();

    for (const item of usageAggregates) {
      const stats = {
        totalTokens: item._sum.totalTokens ?? 0,
        costUsd: item._sum.costUsd ?? 0,
        messages: item._count.id ?? 0,
      };

      if (item.workspaceId) {
        const existing = usageMapByWorkspace.get(item.workspaceId) || { totalTokens: 0, costUsd: 0, messages: 0 };
        usageMapByWorkspace.set(item.workspaceId, {
          totalTokens: existing.totalTokens + stats.totalTokens,
          costUsd: existing.costUsd + stats.costUsd,
          messages: existing.messages + stats.messages,
        });
      }
    }

    // Process each workspace unit economics
    const items = workspaces.map((ws) => {
      const wsUsage = usageMapByWorkspace.get(ws.workspaceId) || {
        totalTokens: 0,
        costUsd: 0,
        messages: 0,
      };

      // ⚠️ Revenue, cost, profit and margin all come from one shared helper
      //    (`lib/domain/unit-economics.ts`). This route used to carry its own
      //    hardcoded revenue table — with keys and prices that matched no real
      //    plan — which is why every figure below used to be wrong.
      const economics = computeUnitEconomics({
        plan: ws.user.plan,
        region: ws.user.region,
        usdToBdtRate,
        costUsd: wsUsage.costUsd,
      });

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
          apiCostUsd: economics.costUsd,
          apiCostBdt: economics.costBdt,
          revenueBdt: economics.revenueBdt,
          // `plan` | `custom` | `unknown` — the UI needs this to explain why a
          // margin is missing instead of showing a made-up one.
          revenueBasis: economics.revenueBasis,
          netProfitBdt: economics.netProfitBdt,
          netMarginPercent: economics.netMarginPercent,
          isHighCostAlert: economics.isHighCostAlert,
        },
      };
    });

    // Global Financial Summary KPIs across all items
    const summary = items.reduce(
      (acc, item) => {
        acc.totalApiCostUsd += item.stats.apiCostUsd;
        acc.totalApiCostBdt += item.stats.apiCostBdt;
        if (item.stats.isHighCostAlert) acc.highCostAlertCount += 1;

        // Only a workspace whose revenue is a real price may contribute to the
        // platform MRR total or to total profit. A negotiated deal has no number
        // to add, and counting it as 0 would pull the total down with a figure
        // we never measured — so those workspaces are counted and disclosed
        // separately instead of being silently averaged in.
        if (item.stats.revenueBasis === "plan") {
          acc.totalMrrBdt += item.stats.revenueBdt;
          if (item.stats.netProfitBdt !== null) acc.totalNetProfitBdt += item.stats.netProfitBdt;
        } else {
          acc.revenueUnknownCount += 1;
        }

        return acc;
      },
      {
        totalMrrBdt: 0,
        totalApiCostUsd: 0,
        totalApiCostBdt: 0,
        totalNetProfitBdt: 0,
        highCostAlertCount: 0,
        revenueUnknownCount: 0,
      }
    );

    summary.totalMrrBdt = Math.round(summary.totalMrrBdt * 100) / 100;
    summary.totalApiCostUsd = Math.round(summary.totalApiCostUsd * 100) / 100;
    summary.totalApiCostBdt = Math.round(summary.totalApiCostBdt * 100) / 100;
    summary.totalNetProfitBdt = Math.round(summary.totalNetProfitBdt * 100) / 100;

    // `null` when no workspace had a knowable revenue: a platform-wide margin
    // over an empty revenue base is undefined, and printing `-100%` there would
    // claim a certainty we do not have.
    const overallMarginPercent = summary.totalMrrBdt > 0
      ? Math.round((summary.totalNetProfitBdt / summary.totalMrrBdt) * 100)
      : null;

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
        // How many workspaces on this page were excluded from MRR because their
        // pricing is negotiated or unrecognised — the UI states this plainly.
        revenueUnknownCount: summary.revenueUnknownCount,
      },
    });
  } catch (error) {
    console.error("[ADMIN_WORKSPACES_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
