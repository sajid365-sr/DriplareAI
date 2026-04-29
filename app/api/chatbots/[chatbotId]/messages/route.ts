import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOwnedChatbot } from "@/lib/chatbot-access";

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

    const whereClause: any = { chatbotId };
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
