import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAndSyncUser } from "@/lib/auth";
import { getPlan, type PlanKey } from "@/lib/plan-config";
import type { Region } from "@/lib/region";

export async function GET() {
  try {
    const user = await getAndSyncUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const enrichedUser = await db.user.findUnique({
      where: { userId: user.userId },
      include: {
        chatbots: { select: { id: true } },
        messages: { select: { id: true } },
      },
    });

    if (!enrichedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get plan config for user's region
    const region = (enrichedUser.region || "bd") as Region;
    const planConfig = getPlan(region, enrichedUser.plan as PlanKey);

    // Get this month's AI usage stats
    const usageLogs = await db.aIUsageLog.findMany({
      where: {
        userId: user.userId,
        createdAt: { gte: enrichedUser.billingCycleStart },
      },
    });

    const totalMessages = usageLogs.length;
    const freeMessages = usageLogs.filter((l) => l.isFreeMessage).length;
    const paidMessages = usageLogs.filter((l) => !l.isFreeMessage).length;
    const totalChargedAmount = usageLogs.reduce((sum, l) => sum + l.chargedAmount, 0);
    const totalActualCostUSD = usageLogs.reduce((sum, l) => sum + l.actualCostUSD, 0);
    const totalTokens = usageLogs.reduce((sum, l) => sum + l.totalTokens, 0);

    // Breakdown by platform
    const platformBreakdown = usageLogs.reduce((acc, log) => {
      const key = log.platform;
      if (!acc[key]) acc[key] = { messages: 0, cost: 0 };
      acc[key].messages += 1;
      acc[key].cost += log.chargedAmount;
      return acc;
    }, {} as Record<string, { messages: number; cost: number }>);

    // Breakdown by chatbot (detailed for table)
    const allChatbots = await db.chatbot.findMany({
      where: { userId: user.userId },
      select: { id: true, name: true, maxTokens: true, status: true }
    });

    const chatbotUsageMap = usageLogs.reduce((acc, log) => {
      acc[log.chatbotId] = (acc[log.chatbotId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const agentUsage = allChatbots.map(bot => ({
      id: bot.id,
      name: bot.name,
      maxTokens: bot.maxTokens,
      usedMessages: chatbotUsageMap[bot.id] || 0,
      status: bot.status
    }));

    // Daily usage history (Last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    
    const dailyLogs = await db.aIUsageLog.findMany({
      where: {
        userId: user.userId,
        createdAt: { gte: fourteenDaysAgo },
      },
      select: { createdAt: true }
    });

    const dailyUsageMap = dailyLogs.reduce((acc, log) => {
      const date = log.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const dailyUsage = Object.entries(dailyUsageMap).map(([date, count]) => ({
      date,
      count
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({
      plan: enrichedUser.plan,
      region,
      currency: region === "bd" ? "BDT" : "USD",
      currencySymbol: region === "bd" ? "৳" : "$",
      chatbots_total: enrichedUser.chatbots.length,
      messages_total: enrichedUser.messages.length,
      // Billing cycle
      billingCycleStart: enrichedUser.billingCycleStart,
      planExpiresAt: enrichedUser.planExpiresAt,
      includedMessagesTotal: enrichedUser.includedMessages, // Real total from DB
      basePlanMessages: planConfig.includedMessages, // What the plan gives
      referralBonusMessages: Math.max(0, enrichedUser.includedMessages - planConfig.includedMessages),
      messagesUsedThisCycle: enrichedUser.messagesUsedThisCycle,
      messagesRemaining: Math.max(0, enrichedUser.includedMessages - enrichedUser.messagesUsedThisCycle),
      dataRetention: enrichedUser.dataRetention,
      // AI usage this cycle
      ai: {
        totalMessages,
        freeMessages,
        paidMessages,
        totalChargedAmount: Math.round(totalChargedAmount * 100) / 100,
        totalActualCostUSD: Math.round(totalActualCostUSD * 1000000) / 1000000,
        totalTokens,
        perMessageRate: planConfig.perMessageRate,
        perMessageLabel: planConfig.perMessageLabel,
      },
      dailyUsage,
      agentUsage,
      breakdowns: {
        platform: platformBreakdown,
        chatbot: chatbotUsageMap,
      },
    });
  } catch (error) {
    console.error("[USAGE_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
