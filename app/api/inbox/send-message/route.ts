import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { deliverInboxMessage } from "@/lib/services/inbox-delivery";

/**
 * POST /api/inbox/send-message
 *
 * Sends a human agent message (Text, Image, or Audio) to the customer on
 * whichever channel the session belongs to, then persists it to PostgreSQL
 * (ChatMessage & ChatSession).
 *
 * Payload:
 * - chatbotId : string (required)
 * - sessionId : string (required)
 * - message   : string (optional if mediaUrl provided)
 * - mediaUrl  : string (optional, Cloudinary URL)
 * - mediaType : 'text' | 'image' | 'audio' (optional)
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      chatbotId,
      sessionId,
      message = "",
      mediaUrl = null,
      mediaType = "text",
    } = body;

    // Validate required fields
    if (!chatbotId || !sessionId) {
      return NextResponse.json(
        { error: "chatbotId and sessionId are required" },
        { status: 400 }
      );
    }

    // Require either text message or mediaUrl
    const trimmedText = (message || "").trim();
    if (!trimmedText && !mediaUrl) {
      return NextResponse.json(
        { error: "Either text message or mediaUrl must be provided" },
        { status: 400 }
      );
    }

    // Authenticate bot ownership
    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found or access denied" }, { status: 404 });
    }

    const botIds = Array.from(new Set([bot.id, bot.chatbotId]));

    // ── 1. Publish to the customer's channel ──────────────────────────────────
    // This route always speaks as a human agent, so it always delivers. The
    // channel-specific work lives in `deliverInboxMessage`, which covers
    // Facebook, Instagram and WhatsApp rather than Facebook alone.
    const delivery = await deliverInboxMessage({
      botIds,
      sessionId,
      text: trimmedText,
      mediaUrl,
      mediaType,
    });

    if (!delivery.delivered) {
      console.error(
        "[INBOX_SEND_MESSAGE] Delivery failed:",
        delivery.platform,
        delivery.skipReason ?? delivery.error ?? "unknown reason"
      );
    }

    // ── 2. Local DB Persistence ───────────────────────────────────────────────
    // Determine lastMessage preview text
    let lastMessageText = trimmedText;
    if (mediaType === "image") {
      lastMessageText = trimmedText ? `📷 ${trimmedText}` : "📷 Sent an image";
    } else if (mediaType === "audio") {
      lastMessageText = trimmedText ? `🎵 ${trimmedText}` : "🎵 Sent an audio";
    }

    // Content for ChatMessage record
    const messageContent = trimmedText || mediaUrl || lastMessageText;

    const newMessage = await db.chatMessage.create({
      data: {
        chatbotId: bot.chatbotId,
        userId,
        sessionId,
        role: "assistant",
        content: messageContent,
        sentByHuman: true,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType !== "text" ? mediaType : null,
        timestamp: new Date(),
      },
    });

    // Update ChatSession state (set isActive = false to maintain human takeover mode)
    await db.chatSession.updateMany({
      where: {
        chatbotId: { in: botIds },
        sessionId,
      },
      data: {
        lastMessage: lastMessageText,
        isActive: false, // Human agent took over, pause AI
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: newMessage,
      delivery,
    });
  } catch (error: any) {
    console.error("[INBOX_SEND_MESSAGE]", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
