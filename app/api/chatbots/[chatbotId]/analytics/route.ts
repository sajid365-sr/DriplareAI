import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { subDays, format } from "date-fns";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch all messages for this chatbot
    const messages = await db.chatMessage.findMany({
      where: { chatbotId },
      orderBy: { timestamp: "asc" },
    });

    const totalMessages = messages.length;
    
    // 2. Fetch Sessions
    const sessions = await db.chatSession.findMany({
      where: { chatbotId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    
    const uniqueSessions = sessions.length;

    // 3. Calculate Avg Response Time
    // We look for pairs: User message followed by Assistant message in the same session
    let totalResponseTime = 0;
    let pairsCount = 0;

    for (let i = 0; i < messages.length - 1; i++) {
      const current = messages[i];
      const next = messages[i + 1];

      if (
        current.role === "user" && 
        next.role === "assistant" && 
        current.sessionId === next.sessionId
      ) {
        const diff = next.timestamp.getTime() - current.timestamp.getTime();
        // Ignore outliers (> 30s) as they might be stale sessions or errors
        if (diff > 0 && diff < 30000) {
          totalResponseTime += diff;
          pairsCount++;
        }
      }
    }

    const avgResponseMs = pairsCount > 0 ? Math.round(totalResponseTime / pairsCount) : 0;

    // 4. Platform Distribution
    const platformCounts: Record<string, number> = {};
    sessions.forEach(s => {
      platformCounts[s.platform] = (platformCounts[s.platform] || 0) + 1;
    });

    const platformDistribution = Object.entries(platformCounts).map(([name, value]) => ({
      name,
      value
    }));

    // 5. Timeline array (Last 7 days)
    const timeline = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dateStr = format(d, "MMM dd");
      const count = messages.filter((m) => format(m.timestamp, "MMM dd") === dateStr).length;
      timeline.push({ date: dateStr, messages: count });
    }

    // 6. Recent Sessions for UI
    const recentSessions = sessions.slice(0, 5).map(s => ({
      id: s.id,
      sessionId: s.sessionId,
      platform: s.platform,
      createdAt: s.createdAt,
      sentiment: s.sentiment || "neutral",
    }));

    return NextResponse.json({
      total_messages: totalMessages,
      unique_sessions: uniqueSessions,
      avg_response_ms: avgResponseMs,
      satisfaction: 98, // Mocked until we have a feedback system
      timeline,
      platform_distribution: platformDistribution,
      recent_sessions: recentSessions,
    });
  } catch (error) {
    console.error("[ANALYTICS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
