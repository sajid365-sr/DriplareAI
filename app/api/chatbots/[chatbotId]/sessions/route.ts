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

    const botIds = Array.from(new Set([bot.id, bot.chatbotId]));

    // Get all chat sessions saved in database for this chatbot
    const sessions = await db.chatSession.findMany({
      where: { chatbotId: { in: botIds } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    // Get all integrations for this chatbot for status reporting
    const integrations = await db.integration.findMany({
      where: { chatbotId: { in: botIds } },
    });

    const facebookIntegration = integrations.find((i) => i.platform === "facebook") || null;

    // Aggregate unique platforms present in saved sessions
    const uniquePlatformsResult = await db.chatSession.groupBy({
      by: ["platform"],
      where: { chatbotId: { in: botIds } },
    });

    const uniquePlatforms = Array.from(
      new Set(["web", "facebook", "whatsapp", "instagram", ...uniquePlatformsResult.map((p) => p.platform)])
    );

    const sessionsData = await Promise.all(
      sessions.map(async (s) => {
        const latestMsg = await db.chatMessage.findFirst({
          where: { chatbotId: { in: botIds }, sessionId: s.sessionId },
          orderBy: { timestamp: "desc" },
        });

        const title = s.guestName || (s.platform === 'facebook' 
          ? `Facebook User (${s.sessionId.slice(-5)})` 
          : `Web User (${s.sessionId.slice(-5)})`);

        const extraction = (s.aiExtractionData as any) ?? {};
        const hasOrderIntent = s.leadStatus === "high_prospect" || Boolean(extraction.cartItems?.length) || (s.topic ? s.topic.toLowerCase().includes("order") : false);
        const orderConfirmed = extraction.orderStatus === "confirmed" || s.leadStatus === "successful";
        const lastMessageSender = latestMsg ? (latestMsg.role === "user" ? "customer" : "agent") : "customer";
        const unread = latestMsg ? latestMsg.role === "user" : false;
        const isTicket = s.topic ? (s.topic.toLowerCase().includes("code") || s.topic.toLowerCase().includes("issue")) : false;
        const status = s.leadStatus === "successful" ? "resolved" : (!s.isActive ? "archived" : "active");

        return {
          sessionId: s.sessionId,
          title: title,
          platform: s.platform,
          isActive: s.isActive,
          isArchived: s.isArchived,
          profilePhoto: s.profilePhoto,
          leadStatus: s.leadStatus || "none",
          topic: s.topic,
          sentiment: s.sentiment,
          hasOrderIntent,
          orderConfirmed,
          lastMessageSender,
          unread,
          isTicket,
          status,
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
