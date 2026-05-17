import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";

export async function GET() {
  try {
    const user = await getAndSyncUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const chatbots = await db.chatbot.findMany({
      where: { userId: user.userId },
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

    // 3. Total Messages (AI Usage Logs)
    const totalMessages = await db.aIUsageLog.count({
      where: { userId: user.userId }
    });

    // 4. Platform Breakdown
    const platformLogs = await db.aIUsageLog.groupBy({
      by: ['platform'],
      where: { userId: user.userId },
      _count: { _all: true }
    });

    const platforms = platformLogs.map(p => ({
      name: p.platform,
      count: p._count._all
    }));

    // 5. Daily Activity (Last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyLogs = await db.aIUsageLog.findMany({
      where: {
        userId: user.userId,
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
        hoursSaved: Math.round(hoursSaved)
      },
      platforms,
      dailyActivity,
      sentiment,
      topTopics
    });

  } catch (error) {
    console.error("[ANALYTICS_OVERVIEW_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
