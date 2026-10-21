import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; sessionId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId, sessionId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const botIds = Array.from(new Set([bot.id, bot.chatbotId]));
    const existingSession = await db.chatSession.findFirst({
      where: {
        sessionId,
        chatbotId: { in: botIds },
      },
    });

    if (!existingSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    // If isAiBlocked is explicitly passed, use it; otherwise toggle existing state
    const newStatus =
      typeof body.isAiBlocked === "boolean"
        ? body.isAiBlocked
        : !existingSession.isAiBlocked;

    const session = await db.chatSession.update({
      where: { id: existingSession.id },
      data: { isAiBlocked: newStatus },
    });

    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      isAiBlocked: session.isAiBlocked,
      message: session.isAiBlocked
        ? "AI permanently blocked for this user"
        : "AI unblocked for this user",
    });
  } catch (error) {
    console.error("[SESSION_BLOCK_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
