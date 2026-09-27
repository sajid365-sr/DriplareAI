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
    const body = await req.json();
    const { isActive, leadStatus, isArchived } = body;

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

    const updateData: Record<string, unknown> = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (leadStatus !== undefined) updateData.leadStatus = leadStatus;
    if (isArchived !== undefined) updateData.isArchived = isArchived;

    const session = await db.chatSession.update({
      where: { id: existingSession.id },
      data: updateData,
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error("[SESSION_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
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

    if (existingSession) {
      // Delete all messages in the session
      await db.chatMessage.deleteMany({
        where: {
          chatbotId: { in: botIds },
          sessionId,
        },
      });

      // Delete the session itself
      await db.chatSession.delete({
        where: { id: existingSession.id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SESSION_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
