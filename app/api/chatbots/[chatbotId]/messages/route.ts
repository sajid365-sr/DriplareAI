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
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const botIds = Array.from(new Set([bot.id, bot.chatbotId]));

    const whereClause: any = { chatbotId: { in: botIds } };
    if (sessionId) {
      whereClause.sessionId = sessionId;
    }

    const messages = await db.chatMessage.findMany({
      where: whereClause,
      orderBy: { timestamp: "desc" },
      take: 100, // Get last 100 messages
    });

    // Reverse to return in chronological order for UI
    return NextResponse.json(messages.reverse());
  } catch (error) {
    console.error("[ACTIVITY_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;
    const body = await req.json();
    const { sessionId, content, role = "assistant", sentByHuman = false } = body;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!sessionId || !content || typeof content !== "string") {
      return NextResponse.json(
        { error: "sessionId and content are required" },
        { status: 400 }
      );
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const botIds = Array.from(new Set([bot.id, bot.chatbotId]));

    // Save human agent / assistant message into Neon DB
    const message = await db.chatMessage.create({
      data: {
        chatbotId: bot.chatbotId,
        userId,
        sessionId,
        role,
        content,
        // Mark true when the message is sent by a human agent (not AI)
        sentByHuman: Boolean(sentByHuman),
        timestamp: new Date(),
      },
    });

    // Update session lastMessage and updatedAt timestamp
    await db.chatSession.updateMany({
      where: {
        chatbotId: { in: botIds },
        sessionId,
      },
      data: {
        lastMessage: content,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error("[MESSAGES_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

