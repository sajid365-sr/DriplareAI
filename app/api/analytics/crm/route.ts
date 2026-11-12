import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import { getActiveWorkspace } from "@/lib/core/workspace-server";

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics/crm
// CRM KPI analytics for the active workspace.
// ═══════════════════════════════════════════════════════════════
export async function GET(_req: NextRequest) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getActiveWorkspace(user.userId);
    const workspaceId = workspace.workspaceId;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Run all KPI queries in parallel
    const [
      totalContacts,
      totalDeals,
      openDealsData,
      wonDeals,
      lostDeals,
      overdueTasks,
      newContactsThisWeek,
      dealsByStageRaw,
      recentActivities,
    ] = await Promise.all([
      // Total contacts
      db.contact.count({ where: { workspaceId } }),

      // Total deals
      db.deal.count({ where: { workspaceId } }),

      // Open deals (not won or lost) — also compute pipeline value
      db.deal.aggregate({
        where: {
          workspaceId,
          stage: { notIn: ["won", "lost"] },
        },
        _count: { dealId: true },
        _sum: { amount: true },
      }),

      // Won deals
      db.deal.count({ where: { workspaceId, stage: "won" } }),

      // Lost deals
      db.deal.count({ where: { workspaceId, stage: "lost" } }),

      // Overdue tasks
      db.crmTask.count({
        where: {
          workspaceId,
          dueAt: { lt: now },
          status: { not: "done" },
        },
      }),

      // New contacts this week
      db.contact.count({
        where: {
          workspaceId,
          createdAt: { gte: sevenDaysAgo },
        },
      }),

      // Deals grouped by stage with count and total value
      db.deal.groupBy({
        by: ["stage"],
        where: { workspaceId },
        _count: { dealId: true },
        _sum: { amount: true },
      }),

      // Recent 10 CrmActivity rows
      db.crmActivity.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          contactId: true,
          dealId: true,
          eventType: true,
          summary: true,
          createdAt: true,
        },
      }),
    ]);

    const openDeals = openDealsData._count.dealId;
    const pipelineValue = openDealsData._sum.amount ?? 0;

    // Win rate: wonDeals / (wonDeals + lostDeals) * 100
    const closedDeals = wonDeals + lostDeals;
    const winRate = closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100) : 0;

    // Format dealsByStage
    const dealsByStage = dealsByStageRaw.map((row) => ({
      stage: row.stage,
      count: row._count.dealId,
      value: row._sum.amount ?? 0,
    }));

    return NextResponse.json({
      summary: {
        totalContacts,
        totalDeals,
        openDeals,
        pipelineValue,
        wonDeals,
        lostDeals,
        winRate,
        overdueTasks,
        newContactsThisWeek,
      },
      dealsByStage,
      recentActivities,
    });
  } catch (error) {
    console.error("[CRM_ANALYTICS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
