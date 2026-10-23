import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string; sessionId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chatbotId, sessionId } = await params;
    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || !("snoozeUntil" in body)) {
      return NextResponse.json({ error: "A snoozeUntil value is required" }, { status: 400 });
    }

    const snoozeUntil = body.snoozeUntil;
    let snoozeDate: Date | null = null;
    if (snoozeUntil !== null) {
      if (typeof snoozeUntil !== "string") {
        return NextResponse.json({ error: "snoozeUntil must be an ISO date or null" }, { status: 400 });
      }

      snoozeDate = new Date(snoozeUntil);
      if (!Number.isFinite(snoozeDate.getTime()) || snoozeDate <= new Date()) {
        return NextResponse.json({ error: "snoozeUntil must be a future date" }, { status: 400 });
      }
    }

    const botIds = Array.from(new Set([bot.id, bot.chatbotId]));
    const existingSession = await db.chatSession.findFirst({
      where: { sessionId, chatbotId: { in: botIds } },
      select: { id: true },
    });
    if (!existingSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const session = await db.chatSession.update({
      where: { id: existingSession.id },
      data: { snoozeUntil: snoozeDate },
      select: { snoozeUntil: true },
    });
    return NextResponse.json({ success: true, snoozeUntil: session.snoozeUntil });
  } catch (error) {
    console.error("Error updating snooze status:", error);
    return NextResponse.json({ success: false, error: "Failed to update snooze status" }, { status: 500 });
  }
}
