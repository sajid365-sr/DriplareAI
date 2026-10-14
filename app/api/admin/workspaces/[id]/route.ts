import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";
import { getUsdToBdtRate } from "@/lib/ai/credit-resolver";
import { computeUnitEconomics } from "@/lib/domain/unit-economics";

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

    // ⚠️ ৳-এর একমাত্র সূত্র — admin `/admin/ai-settings`-এ যা সেট করেছেন।
    //    নিচের সব `costBdt` এই রেটে `costUsd` থেকে read-time-এ রূপান্তরিত,
    //    জমা-করা `costBdt` থেকে নয় (নাহলে পুরনো-নতুন লগে দুই রেট মিশে যেত)।
    const usdToBdtRate = await getUsdToBdtRate();

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

    // ── Which usage rows belong to *this* workspace ───────────────────────────
    // A row counts if it names this workspace, or if it names one of this
    // workspace's chatbots (older rows were written before `workspaceId` was
    // populated).
    //
    // ⚠️ `{ userId }` is deliberately **not** in this list, although it used to
    //    be. It made a merchant with two workspaces see the combined API cost of
    //    both on each workspace's page — inflating the single figure this screen
    //    exists to report, in the direction that looks like a problem. A row
    //    naming neither a workspace nor one of its chatbots cannot be attributed
    //    to a workspace, so it is left out rather than guessed at.
    const usageScope = {
      OR: [
        { workspaceId: workspace.workspaceId },
        { chatbotId: { in: chatbotIds.length > 0 ? chatbotIds : ["__none__"] } },
      ],
    };

    // 2. Aggregate AI Usage by Model
    const modelUsageAggregates = await db.aIUsageLog.groupBy({
      where: usageScope,
      by: ["modelId", "model"],
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        costUsd: true,
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
      costBdt: Math.round((item._sum.costUsd ?? 0) * usdToBdtRate * 100) / 100,
      requestCount: item._count.id ?? 0,
    }));

    // 3. Aggregate AI Usage by Channel
    const channelUsageAggregates = await db.aIUsageLog.groupBy({
      where: usageScope,
      by: ["channel"],
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        costUsd: true,
      },
      _count: {
        id: true,
      },
    });

    const channelBreakdown = channelUsageAggregates.map((item) => ({
      channel: item.channel || "web",
      promptTokens: item._sum.promptTokens ?? 0,
      completionTokens: item._sum.completionTokens ?? 0,
      totalTokens: item._sum.totalTokens ?? 0,
      costUsd: Math.round((item._sum.costUsd ?? 0) * 10000) / 10000,
      costBdt: Math.round((item._sum.costUsd ?? 0) * usdToBdtRate * 100) / 100,
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

    const usageLogsRaw = await db.aIUsageLog.findMany({
      where: usageScope,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // লগ-তালিকার ৳ও read-time-এ — নাহলে উপরের মোটের সাথে প্রতিটি সারি মিলত না।
    const usageLogs = usageLogsRaw.map((log) => ({
      ...log,
      costBdt: Math.round(log.costUsd * usdToBdtRate * 100) / 100,
    }));

    // 5. Total Financial Summary for this Workspace
    const totalPromptTokens = modelBreakdown.reduce((sum, m) => sum + m.promptTokens, 0);
    const totalCompletionTokens = modelBreakdown.reduce((sum, m) => sum + m.completionTokens, 0);
    const totalTokens = modelBreakdown.reduce((sum, m) => sum + m.totalTokens, 0);
    const totalCostUsdRaw = modelBreakdown.reduce((sum, m) => sum + m.costUsd, 0);

    // ⚠️ Revenue, cost, profit and margin come from one shared helper. This
    //    route used to keep its own hardcoded revenue table, duplicated from the
    //    list route — and both were wrong.
    //
    // ⚠️ `netProfitBdt` / `netMarginPercent` below are `null` when the plan's
    //    price is not knowable (a negotiated Enterprise deal, or a plan key that
    //    is not in the catalogue). `null` means "not measurable"; the UI shows a
    //    dash. Reading those as 0 revenue produced a fixed −100% margin on every
    //    such workspace, which is a claim we have no basis for.
    const economics = computeUnitEconomics({
      plan: workspace.user.plan,
      region: workspace.user.region,
      usdToBdtRate,
      costUsd: totalCostUsdRaw,
    });

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
        avatar: cb.avatarBase64,
        chatbotMode: cb.chatbotMode,
        createdAt: cb.createdAt,
        messageCount: cb._count.messages,
        sessionCount: cb._count.sessions,
      })),
      financials: {
        monthlyRevenueBdt: economics.revenueBdt,
        revenueBasis: economics.revenueBasis,
        totalCostUsd: economics.costUsd,
        totalCostBdt: economics.costBdt,
        netProfitBdt: economics.netProfitBdt,
        netMarginPercent: economics.netMarginPercent,
        totalPromptTokens,
        totalCompletionTokens,
        totalTokens,
        isHighCostAlert: economics.isHighCostAlert,
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
