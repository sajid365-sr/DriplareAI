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
    const { assignedToUserId } = body;

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

    const targetUserId = assignedToUserId ? String(assignedToUserId) : null;

    const updatedSession = await db.chatSession.update({
      where: { id: existingSession.id },
      data: {
        assignedToUserId: targetUserId,
        assignedAt: targetUserId ? new Date() : null,
      },
    });

    // Create an in-app notification for the assigned agent if targetUserId is set
    if (targetUserId) {
      try {
        await db.notification.create({
          data: {
            userId: targetUserId,
            type: "system",
            title: "New Conversation Assigned",
            message: `Conversation with ${existingSession.guestName || "Customer (" + sessionId.slice(-5) + ")"} has been assigned to you.`,
          },
        });
      } catch (notifErr) {
        console.error("[ASSIGN_NOTIF_ERROR]", notifErr);
      }
    }

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error("[ASSIGN_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

