import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";

const PLAN_MONTHLY_REVENUE_BDT: Record<string, number> = {
  starter: 0,
  growth: 2990,
  pro: 7990,
  agency: 14990,
  enterprise: 19900,
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
    }

    // 1. Fetch workspace by id or workspaceId
    const workspace = await db.workspace.findFirst({
      where: {
        OR: [{ id }, { workspaceId: id }],
      },
      include: {
        user: true,
        chatbots: {
          orderBy: { createdAt: "desc" },
          include: {
            _count: {
              select: { messages: true, sessions: true },
            },
          },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const chatbotIds = workspace.chatbots.map((c) => c.chatbotId);

    // 2. Aggregate AI Usage by Model
    const modelUsageAggregates = await db.aIUsageLog.groupBy({
      where: {
        OR: [
          { workspaceId: workspace.workspaceId },
          { userId: workspace.userId },
          { chatbotId: { in: chatbotIds.length > 0 ? chatbotIds : ["__none__"] } },
        ],
      },
      by: ["modelId", "model"],
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        costUsd: true,
        costBdt: true,
      },
      _count: {
        id: true,
      },
    });

    const modelBreakdown = modelUsageAggregates.map((item) => ({
      modelId: item.modelId || item.model || "unknown",
      modelName: item.model || item.modelId || "Unknown Model",
      promptTokens: item._sum.promptTokens ?? 0,
      completionTokens: item._sum.completionTokens ?? 0,
      totalTokens: item._sum.totalTokens ?? 0,
      costUsd: Math.round((item._sum.costUsd ?? 0) * 10000) / 10000,
      costBdt: Math.round((item._sum.costBdt ?? 0) * 100) / 100,
      requestCount: item._count.id ?? 0,
    }));

    // 3. Aggregate AI Usage by Channel
    const channelUsageAggregates = await db.aIUsageLog.groupBy({
      where: {
        OR: [
          { workspaceId: workspace.workspaceId },
          { userId: workspace.userId },
          { chatbotId: { in: chatbotIds.length > 0 ? chatbotIds : ["__none__"] } },
        ],
      },
      by: ["channel"],
      _sum: {
        totalTokens: true,
        costUsd: true,
        costBdt: true,
      },
      _count: {
        id: true,
      },
    });

    const channelBreakdown = channelUsageAggregates.map((item) => ({
      channel: item.channel || "web",
      totalTokens: item._sum.totalTokens ?? 0,
      costUsd: Math.round((item._sum.costUsd ?? 0) * 10000) / 10000,
      costBdt: Math.round((item._sum.costBdt ?? 0) * 100) / 100,
      requestCount: item._count.id ?? 0,
    }));

    // 4. Fetch past credit transactions & granular AI usage logs
    const creditTransactions = await db.creditTransaction.findMany({
      where: {
        userId: workspace.userId,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const usageLogs = await db.aIUsageLog.findMany({
      where: {
        OR: [
          { workspaceId: workspace.workspaceId },
          { userId: workspace.userId },
          { chatbotId: { in: chatbotIds.length > 0 ? chatbotIds : ["__none__"] } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // 5. Total Financial Summary for this Workspace
    const totalPromptTokens = modelBreakdown.reduce((sum, m) => sum + m.promptTokens, 0);
    const totalCompletionTokens = modelBreakdown.reduce((sum, m) => sum + m.completionTokens, 0);
    const totalTokens = modelBreakdown.reduce((sum, m) => sum + m.totalTokens, 0);
    const totalCostUsd = Math.round(modelBreakdown.reduce((sum, m) => sum + m.costUsd, 0) * 10000) / 10000;
    const totalCostBdt = Math.round(modelBreakdown.reduce((sum, m) => sum + m.costBdt, 0) * 100) / 100;

    const planKey = (workspace.user.plan || "starter").toLowerCase();
    const monthlyRevenueBdt = PLAN_MONTHLY_REVENUE_BDT[planKey] ?? 0;
    const netProfitBdt = Math.round((monthlyRevenueBdt - totalCostBdt) * 100) / 100;

    let netMarginPercent = 100;
    if (monthlyRevenueBdt > 0) {
      netMarginPercent = Math.round((netProfitBdt / monthlyRevenueBdt) * 100);
    } else if (totalCostBdt > 0) {
      netMarginPercent = -100;
    }

    return NextResponse.json({
      workspace: {
        id: workspace.id,
        workspaceId: workspace.workspaceId,
        name: workspace.name,
        logoUrl: workspace.logoUrl,
        status: (workspace as any).status || "active",
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
      owner: {
        id: workspace.user.id,
        userId: workspace.user.userId,
        name: workspace.user.name,
        email: workspace.user.email,
        picture: workspace.user.picture,
        plan: workspace.user.plan,
        region: workspace.user.region,
        role: workspace.user.role,
        creditsBalance: workspace.user.creditsBalance,
        includedCredits: workspace.user.includedCredits,
        creditsUsedThisCycle: workspace.user.creditsUsedThisCycle,
        createdAt: workspace.user.createdAt,
      },
      chatbots: workspace.chatbots.map((cb) => ({
        id: cb.id,
        chatbotId: cb.chatbotId,
        name: cb.name,
        model: cb.model,
        avatar: cb.avatar,
        chatbotMode: cb.chatbotMode,
        createdAt: cb.createdAt,
        messageCount: cb._count.messages,
        sessionCount: cb._count.sessions,
      })),
      financials: {
        monthlyRevenueBdt,
        totalCostUsd,
        totalCostBdt,
        netProfitBdt,
        netMarginPercent,
        totalPromptTokens,
        totalCompletionTokens,
        totalTokens,
        isHighCostAlert: totalCostBdt > (monthlyRevenueBdt > 0 ? monthlyRevenueBdt * 0.8 : 50),
      },
      modelBreakdown,
      channelBreakdown,
      creditTransactions,
      usageLogs,
    });
  } catch (error) {
    console.error("[ADMIN_WORKSPACE_DETAIL_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
