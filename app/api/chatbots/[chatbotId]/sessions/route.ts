import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";

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

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Get chat sessions
    const sessions = await db.chatSession.findMany({
      where: { chatbotId },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    // Get all integrations for this chatbot
    const integrations = await db.integration.findMany({
      where: { chatbotId },
    });

    const facebookIntegration = integrations.find(i => i.platform === "facebook") || null;
    const isFacebookConnected = facebookIntegration?.connected || false;

    let filteredSessions = sessions;
    if (!isFacebookConnected) {
      filteredSessions = sessions.filter(s => s.platform !== 'facebook');
    }

    // Get unique platforms from the database chatSession table for this chatbot
    const uniquePlatformsResult = await db.chatSession.groupBy({
      by: ["platform"],
      where: { chatbotId },
    });

    let uniquePlatforms = uniquePlatformsResult.map(p => p.platform);

    if (!isFacebookConnected) {
      uniquePlatforms = uniquePlatforms.filter(p => p !== "facebook");
    }

    // Always ensure 'web' is in platforms since it's the core/default
    if (!uniquePlatforms.includes("web")) {
      uniquePlatforms.push("web");
    }

    const sessionsData = await Promise.all(
      filteredSessions.map(async (s) => {
        const latestMsg = await db.chatMessage.findFirst({
          where: { chatbotId, sessionId: s.sessionId },
          orderBy: { timestamp: "desc" },
        });

        const title = s.guestName || (s.platform === 'facebook' 
          ? `Facebook User (${s.sessionId.slice(-5)})` 
          : `Web User (${s.sessionId.slice(-5)})`);

        return {
          sessionId: s.sessionId,
          title: title,
          platform: s.platform,
          isActive: s.isActive,
          profilePhoto: s.profilePhoto,
          // AI auto-detected lead status: high_prospect, priority, risky, successful, none
          leadStatus: s.leadStatus || "none",
          // Last message preview text for the session list card
          lastMessage: s.lastMessage || latestMsg?.content?.slice(0, 80) || null,
          timestamp: latestMsg ? latestMsg.timestamp : s.updatedAt,
        };
      })
    );

    // sort by timestamp desc
    sessionsData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      sessions: sessionsData,
      integration: facebookIntegration ? {
        status: facebookIntegration.status,
        lastError: facebookIntegration.lastError,
        connected: facebookIntegration.connected
      } : null,
      platforms: uniquePlatforms
    });
  } catch (error) {
    console.error("[SESSIONS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
