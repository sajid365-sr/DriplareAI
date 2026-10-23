import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const chatbotId = new URL(request.url).searchParams.get("chatbotId");
    if (!chatbotId) {
      return NextResponse.json({ error: "chatbotId is required" }, { status: 400 });
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const snoozedSessions = await db.chatSession.findMany({
      where: {
        chatbotId: { in: Array.from(new Set([bot.id, bot.chatbotId])) },
        snoozeUntil: { gt: new Date() },
      },
      select: { sessionId: true },
    });
    const snoozedSessionIds = snoozedSessions.map((session) => session.sessionId);
    return NextResponse.json({ snoozedSessionIds });
  } catch (error) {
    console.error("Error fetching snoozed sessions:", error);
    return NextResponse.json({ error: "Failed to fetch snoozed sessions" }, { status: 500 });
  }
}
