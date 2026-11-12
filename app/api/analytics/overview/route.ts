import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import { getActiveWorkspace } from "@/lib/core/workspace-server";

export async function GET() {
  try {
    const user = await getAndSyncUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Scope analytics to the active business/workspace
    const workspace = await getActiveWorkspace(user.userId);

    const chatbots = await db.chatbot.findMany({
      where: { userId: user.userId, workspaceId: workspace.workspaceId },
      select: { chatbotId: true, id: true }
    });

    const chatbotIds = chatbots.map(b => b.chatbotId);

    // 1. Total Conversations (Sessions)
    const totalSessions = await db.chatSession.count({
      where: { chatbotId: { in: chatbotIds } }
    });

    // 2. Total Leads (Sessions with guestName)
    const totalLeads = await db.chatSession.count({
      where: {
        chatbotId: { in: chatbotIds },
        guestName: { not: null }
      }
    });

    // 3. Total Messages (AI Usage Logs) — scoped to this workspace's bots
    const totalMessages = await db.aIUsageLog.count({
      where: { chatbotId: { in: chatbotIds } }
    });

    // 4. Platform Breakdown
    const platformLogs = await db.aIUsageLog.groupBy({
      by: ['channel'],
      where: { chatbotId: { in: chatbotIds } },
      _count: { _all: true }
    });

    const platforms = platformLogs.map(p => ({
      name: p.channel,
      count: p._count._all
    }));

    // 5. Daily Activity (Last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyLogs = await db.aIUsageLog.findMany({
      where: {
        chatbotId: { in: chatbotIds },
        createdAt: { gte: sevenDaysAgo }
      },
      select: { createdAt: true }
    });

    const dailyMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dailyMap[label] = 0;
    }

    dailyLogs.forEach(log => {
      const label = log.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (dailyMap[label] !== undefined) {
        dailyMap[label]++;
      }
    });

    const dailyActivity = Object.entries(dailyMap).map(([date, messages]) => ({
      date,
      messages
    })).reverse();

    // 6. Real Sentiment
    const sentimentGroups = await db.chatSession.groupBy({
      by: ['sentiment'],
      where: { chatbotId: { in: chatbotIds }, sentiment: { not: null } },
      _count: { _all: true }
    });

    const sentiment = {
      happy: sentimentGroups.find(g => g.sentiment === 'positive')?._count._all || 0,
      neutral: sentimentGroups.find(g => g.sentiment === 'neutral')?._count._all || 0,
      unhappy: sentimentGroups.find(g => g.sentiment === 'negative')?._count._all || 0,
    };

    // 7. Real Top Topics
    const topicGroups = await db.chatSession.groupBy({
      by: ['topic'],
      where: { chatbotId: { in: chatbotIds }, topic: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { topic: 'desc' } },
      take: 5
    });

    const topTopics = topicGroups.map(g => ({
      topic: g.topic,
      count: g._count._all
    }));

    // If no real topics yet, provide some fallback info
    if (topTopics.length === 0) {
      topTopics.push({ topic: "Waiting for analysis...", count: 0 });
    }

    // 9. Real COD Collection Summary (Feature #26)
    const codOrders = await db.order.findMany({
      where: {
        chatbotId: { in: chatbotIds },
        paymentMethod: { in: ["COD", "Cash on Delivery", "cod"] },
      },
      select: { totalAmount: true, codCollected: true },
    });

    let codCollectedAmount = 0;
    let codPendingAmount = 0;
    let codCollectedCount = 0;
    let codPendingCount = 0;

    for (const ord of codOrders) {
      if (ord.codCollected) {
        codCollectedAmount += ord.totalAmount;
        codCollectedCount++;
      } else {
        codPendingAmount += ord.totalAmount;
        codPendingCount++;
      }
    }

    // 10. Cancellation & Return Breakdown (Feature #27)
    const issueOrders = await db.order.findMany({
      where: {
        chatbotId: { in: chatbotIds },
        status: { in: ["Cancelled", "Returned", "Damage"] },
      },
      select: {
        status: true,
        cancellationReason: true,
        returnReason: true,
        damageNote: true,
      },
    });

    const reasonCounts: Record<string, number> = {};
    for (const ord of issueOrders) {
      const raw = ord.cancellationReason || ord.returnReason || ord.damageNote || "Other";
      const category = raw.split(":")[0].trim();
      reasonCounts[category] = (reasonCounts[category] || 0) + 1;
    }

    const cancellationReasons = Object.entries(reasonCounts).map(([reason, count]) => ({
      reason,
      count,
    }));

    // CRM Metrics
    const totalContacts = await db.contact.count({
      where: { workspaceId: workspace.workspaceId },
    });
    const openDeals = await db.deal.findMany({
      where: {
        workspaceId: workspace.workspaceId,
        stage: { notIn: ["won", "lost"] },
      },
      select: { amount: true },
    });
    const pipelineValue = openDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
    const overdueTasks = await db.crmTask.count({
      where: {
        workspaceId: workspace.workspaceId,
        status: { not: "done" },
        dueAt: { lt: new Date() },
      },
    });

    // 8. Real ROI Calculation
    const dbUser = await db.user.findUnique({ 
      where: { userId: user.userId }, 
      select: { supportCostPerHour: true } 
    });
    const costPerHour = dbUser?.supportCostPerHour || 15.0;
    
    // Logic: Each AI message saves approx 2 minutes of human time.
    const minutesSaved = totalMessages * 2;
    const hoursSaved = minutesSaved / 60;
    const moneySaved = hoursSaved * costPerHour;

    return NextResponse.json({
      summary: {
        totalSessions,
        totalLeads,
        totalMessages,
        moneySaved: Math.round(moneySaved),
        hoursSaved: Math.round(hoursSaved),
        totalContacts,
        activeDealsCount: openDeals.length,
        pipelineValue: Math.round(pipelineValue),
        overdueTasks,
      },
      platforms,
      dailyActivity,
      sentiment,
      topTopics,
      codSummary: {
        collectedAmount: codCollectedAmount,
        pendingAmount: codPendingAmount,
        collectedCount: codCollectedCount,
        pendingCount: codPendingCount,
      },
      cancellationReasons
    });

  } catch (error) {
    console.error("[ANALYTICS_OVERVIEW_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
