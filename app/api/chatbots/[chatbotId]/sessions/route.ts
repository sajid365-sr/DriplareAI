import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getInboxAccessibleChatbot } from "@/lib/domain/chatbot-access";

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

    const bot = await getInboxAccessibleChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const botIds = Array.from(new Set([bot.id, bot.chatbotId]));

    // Apply due assignment handoffs during inbox refresh as a low-latency fallback
    // when the scheduled worker is delayed or disabled in a local environment.
    await db.chatSession.updateMany({
      where: {
        chatbotId: { in: botIds },
        assignmentAiPaused: true,
        assignmentAiResumeAt: { lte: new Date() },
      },
      data: {
        isActive: true,
        assignmentAiPaused: false,
        assignmentAiResumeAt: null,
      },
    });

    // Get all chat sessions saved in database for this chatbot
    const sessions = await db.chatSession.findMany({
      where: { chatbotId: { in: botIds } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    // Get all integrations for this chatbot for status reporting
    const integrations = await db.integration.findMany({
      where: { chatbotId: { in: botIds } },
      select: {
        id: true,
        platform: true,
        status: true,
        lastError: true,
        connected: true,
      },
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
        const [latestMsg, latestCustomerMessage] = await Promise.all([
          db.chatMessage.findFirst({
            where: { chatbotId: { in: botIds }, sessionId: s.sessionId },
            orderBy: { timestamp: "desc" },
          }),
          db.chatMessage.findFirst({
            where: { chatbotId: { in: botIds }, sessionId: s.sessionId, role: "user" },
            orderBy: { timestamp: "desc" },
            select: { timestamp: true },
          }),
        ]);

        const title = s.guestName || (s.platform === 'facebook' 
          ? `Facebook User (${s.sessionId.slice(-5)})` 
          : `Web User (${s.sessionId.slice(-5)})`);

        const extraction =
          s.aiExtractionData && typeof s.aiExtractionData === "object" && !Array.isArray(s.aiExtractionData)
            ? (s.aiExtractionData as Record<string, unknown>)
            : {};
        const extractedCartItems = Array.isArray(extraction.cartItems) ? extraction.cartItems : [];
        const hasOrderIntent = s.leadStatus === "high_prospect" || extractedCartItems.length > 0 || (s.topic ? s.topic.toLowerCase().includes("order") : false);
        const orderConfirmed = extraction.orderStatus === "confirmed" || s.leadStatus === "successful";
        const lastMessageSender = !latestMsg || latestMsg.role === "user"
          ? "customer"
          : latestMsg.sentByHuman
            ? "agent"
            : "ai";
        const unread = Boolean(
          latestCustomerMessage &&
            (!s.lastReadAt || latestCustomerMessage.timestamp > s.lastReadAt)
        );
        const isTicket = s.topic ? (s.topic.toLowerCase().includes("code") || s.topic.toLowerCase().includes("issue")) : false;
        const status = s.leadStatus === "successful" ? "resolved" : (!s.isActive ? "archived" : "active");

        return {
          sessionId: s.sessionId,
          title: title,
          platform: s.platform,
          isActive: s.isActive,
          isArchived: s.isArchived,
          isDone: s.isDone,
          lastReadAt: s.lastReadAt?.toISOString() ?? null,
          isAiBlocked: s.isAiBlocked,
          snoozeUntil: s.snoozeUntil ? s.snoozeUntil.toISOString() : null,
          assignedToUserId: s.assignedToUserId,
          assignedAt: s.assignedAt ? s.assignedAt.toISOString() : null,
          assignmentNote: s.assignmentNote,
          assignmentAiPaused: s.assignmentAiPaused,
          assignmentAiResumeAt: s.assignmentAiResumeAt?.toISOString() ?? null,
          profilePhoto: s.profilePhoto,
          leadStatus: s.leadStatus || "none",
          topic: s.topic,
          sentiment: s.sentiment,
          hasOrderIntent,
          orderConfirmed,
          lastMessageSender,
          unread,
          phone: typeof extraction.phone === "string" ? extraction.phone : null,
          orderId: typeof extraction.orderId === "string" ? extraction.orderId : null,
          isTicket,
          status,
          lastMessage: latestMsg?.content?.slice(0, 160) || s.lastMessage || null,
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
