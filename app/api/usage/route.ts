import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import { getPlan, getTotalIntegrationLimit, type PlanKey } from "@/lib/domain/plan-config";
import { getPlanCredits } from "@/lib/domain/credit-config";
import type { Region } from "@/lib/core/region";

export async function GET(req: Request) {
  try {
    const user = await getAndSyncUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

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

    // Billing cycle start — creditsResetDate থেকে 30 দিন বিয়োগ করে calculate
    const rawResetDate = enrichedUser.creditsResetDate ?? new Date();
    const billingCycleStart = new Date(rawResetDate);
    billingCycleStart.setDate(billingCycleStart.getDate() - 30);

    // Determine date range filter
    let dateFilter: any = { gte: billingCycleStart };
    if (from || to) {
      dateFilter = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
    }

    // Get plan config for user's region
    const region = (enrichedUser.region || "bd") as Region;
    const planConfig = getPlan(region, enrichedUser.plan as PlanKey);

    // Get AI usage stats within range
    const usageLogs = await db.aIUsageLog.findMany({
      where: {
        userId: user.userId,
        createdAt: dateFilter,
      },
    });

    // ALSO get messages from ChatMessage table
    const assistantMessages = await db.chatMessage.findMany({
      where: {
        userId: user.userId,
        role: "assistant",
        timestamp: dateFilter,
      },
      select: { chatbotId: true, timestamp: true }
    });

    // Credits calculation
    const paidCreditsCount = Math.max(0, enrichedUser.creditsUsedThisCycle - enrichedUser.includedCredits);
    const creditsRemaining = Math.max(0, enrichedUser.creditsBalance);
    const planIncludedCredits = getPlanCredits(enrichedUser.plan);
    
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
      select: { id: true, chatbotId: true, name: true, maxTokens: true, status: true }
    });

    // Count messages per chatbot from assistantMessages (most reliable as n8n saves here)
    const chatbotUsageMap = assistantMessages.reduce((acc, msg) => {
      acc[msg.chatbotId] = (acc[msg.chatbotId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Merge with usageLogs if any exist that aren't in ChatMessage (unlikely but safe)
    usageLogs.forEach(log => {
      if (!chatbotUsageMap[log.chatbotId]) {
        chatbotUsageMap[log.chatbotId] = 1;
      }
    });

    const agentUsage = allChatbots.map(bot => ({
      id: bot.id,
      name: bot.name,
      maxTokens: bot.maxTokens,
      usedMessages: chatbotUsageMap[bot.chatbotId] || 0,
      status: bot.status
    }));

    // Daily usage history (Last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    
    // Use assistantMessages for daily stats as it's the most complete
    const dailyUsageMap = assistantMessages.reduce((acc, msg) => {
      const date = msg.timestamp.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const dailyUsage = Object.entries(dailyUsageMap).map(([date, count]) => ({
      date,
      count
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Total connected integrations
    const totalIntegrations = await db.integration.count({
      where: { 
        chatbot: { userId: user.userId },
        connected: true
      }
    });

    return NextResponse.json({
      plan: enrichedUser.plan,
      region,
      currency: region === "bd" ? "BDT" : "USD",
      currencySymbol: region === "bd" ? "৳" : "$",
      chatbots_total: enrichedUser.chatbots.length,
      messages_total: enrichedUser.messages.length,
      // Scheduled downgrade info (for payment page banner)
      scheduledDowngradePlan: (enrichedUser as any).scheduledDowngradePlan ?? null,
      scheduledDowngradeAt: (enrichedUser as any).scheduledDowngradeAt ?? null,
      // Billing cycle
      billingCycleStart: billingCycleStart.toISOString(),
      creditsResetDate: enrichedUser.creditsResetDate,
      planExpiresAt: enrichedUser.planExpiresAt,
      // Credit fields (new system)
      creditsBalance:        enrichedUser.creditsBalance,
      includedCreditsTotal:  enrichedUser.includedCredits,   // bonus credits সহ মোট
      basePlanCredits:       planIncludedCredits,             // plan-এ যা include
      referralBonusCredits:  Math.max(0, enrichedUser.includedCredits - planIncludedCredits),
      creditsUsedThisCycle:  enrichedUser.creditsUsedThisCycle,
      creditsRemaining,
      dataRetention: enrichedUser.dataRetention,
      includedChatbots: planConfig.maxChatbots,
      maxIntegrations: getTotalIntegrationLimit(planConfig),
      maxIntegrationsPerChatbot: planConfig.maxIntegrationsPerChatbot,
      totalIntegrations,
      // AI usage this cycle
      ai: {
        totalMessages: Math.max(usageLogs.length, assistantMessages.length),
        totalChargedAmount: Math.round(totalChargedAmount * 100) / 100,
        totalActualCostUSD: Math.round(totalActualCostUSD * 1000000) / 1000000,
        totalTokens,
        creditsUsed: enrichedUser.creditsUsedThisCycle,
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
