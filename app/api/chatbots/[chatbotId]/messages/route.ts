import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { deliverInboxMessage } from "@/lib/services/inbox-delivery";

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

    const {
      sessionId,
      content = "",
      message = "",
      role = "assistant",
      sentByHuman = false,
      mediaUrl = null,
      mediaType = "text",
    } = body;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const textStr = (message || content || "").trim();
    if (!sessionId || (!textStr && !mediaUrl)) {
      return NextResponse.json(
        { error: "sessionId and either text content or mediaUrl are required" },
        { status: 400 }
      );
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const botIds = Array.from(new Set([bot.id, bot.chatbotId]));

    // ── 1. Publish to the customer's channel ──────────────────────────────────
    // Facebook, Instagram and WhatsApp all route through the same helper, so a
    // reply is either delivered on the platform the customer writes from or
    // reported as undelivered — never quietly stored as though it was sent.
    // Agent-authored rows (`sentByHuman: false`) are notes for the merchant and
    // are not delivered anywhere.
    const delivery = sentByHuman
      ? await deliverInboxMessage({
          botIds,
          sessionId,
          text: textStr,
          mediaUrl,
          mediaType,
        })
      : null;

    if (delivery && !delivery.delivered) {
      console.error(
        "[MESSAGES_POST] Delivery failed:",
        delivery.platform,
        delivery.skipReason ?? delivery.error ?? "unknown reason"
      );
    }

    // ── 2. Save Message to Database ───────────────────────────────────────────
    let lastMessageText = textStr;
    if (mediaType === "image") {
      lastMessageText = textStr ? `📷 ${textStr}` : "📷 Sent an image";
    } else if (mediaType === "audio") {
      lastMessageText = textStr ? `🎵 ${textStr}` : "🎵 Sent an audio";
    }

    const messageContent = textStr || mediaUrl || lastMessageText;

    const newMessage = await db.chatMessage.create({
      data: {
        chatbotId: bot.chatbotId,
        userId,
        sessionId,
        role,
        content: messageContent,
        sentByHuman: Boolean(sentByHuman),
        mediaUrl: mediaUrl || null,
        mediaType: mediaType !== "text" ? mediaType : null,
        timestamp: new Date(),
      },
    });

    // Update session lastMessage and set isActive = false if sent by human agent
    await db.chatSession.updateMany({
      where: {
        chatbotId: { in: botIds },
        sessionId,
      },
      data: {
        lastMessage: lastMessageText,
        ...(sentByHuman && { isActive: false }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: newMessage,
      // The inbox warns the merchant when this says `delivered: false`, so a
      // reply that never left the dashboard is never mistaken for a sent one.
      delivery,
      ...newMessage,
    });
  } catch (error: any) {
    console.error("[MESSAGES_POST]", error);
    return NextResponse.json(
      { error: error.message || "Internal Error" },
      { status: 500 }
    );
  }
}
