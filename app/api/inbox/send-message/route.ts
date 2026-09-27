import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";

/**
 * POST /api/inbox/send-message
 *
 * Sends a human agent message (Text, Image, or Audio) to the customer.
 * Integrates with Meta Graph API for Facebook Messenger sessions
 * and persists the message to PostgreSQL (ChatMessage & ChatSession).
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

    // ── 1. Retrieve ChatSession & Integration credentials ─────────────────────
    const session = await db.chatSession.findFirst({
      where: {
        chatbotId: { in: botIds },
        sessionId,
      },
      include: {
        integration: true,
      },
    });

    // ── 2. Deliver via Meta Graph API if Facebook session ─────────────────────
    let metaDeliverySuccess = false;
    let metaDeliveryError: string | null = null;

    const platform = session?.platform || (sessionId.startsWith("fb_") ? "facebook" : "web");

    if (platform === "facebook") {
      // Find Facebook integration for token
      let integration = session?.integration;
      if (!integration || integration.platform !== "facebook") {
        integration = await db.integration.findFirst({
          where: {
            chatbotId: { in: botIds },
            platform: "facebook",
          },
        });
      }

      const config = (integration?.config as Record<string, string>) || {};
      const pageToken = config.pageToken;
      const psid = sessionId.startsWith("fb_")
        ? sessionId.replace(/^fb_/, "")
        : sessionId;

      if (pageToken && psid) {
        const metaEndpoint = `https://graph.facebook.com/v20.0/me/messages?access_token=${pageToken}`;

        try {
          // Send text payload if present
          if (trimmedText) {
            const textPayload = {
              recipient: { id: psid },
              messaging_type: "RESPONSE",
              message: { text: trimmedText },
            };

            const textRes = await fetch(metaEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(textPayload),
            });

            if (!textRes.ok) {
              const textErr = await textRes.text();
              console.error("[INBOX_SEND_MESSAGE] Meta text send failed:", textErr);
              metaDeliveryError = textErr;
            } else {
              metaDeliverySuccess = true;
            }
          }

          // Send media attachment payload if image or audio
          if (mediaUrl && (mediaType === "image" || mediaType === "audio")) {
            const mediaPayload = {
              recipient: { id: psid },
              messaging_type: "RESPONSE",
              message: {
                attachment: {
                  type: mediaType === "image" ? "image" : "audio",
                  payload: {
                    url: mediaUrl,
                    is_reusable: true,
                  },
                },
              },
            };

            const mediaRes = await fetch(metaEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(mediaPayload),
            });

            if (!mediaRes.ok) {
              const mediaErr = await mediaRes.text();
              console.error("[INBOX_SEND_MESSAGE] Meta media send failed:", mediaErr);
              metaDeliveryError = mediaErr;
            } else {
              metaDeliverySuccess = true;
            }
          }
        } catch (err: any) {
          console.error("[INBOX_SEND_MESSAGE] Meta API fetch exception:", err);
          metaDeliveryError = err.message || "Meta API request failed";
        }
      }
    }

    // ── 3. Local DB Persistence ───────────────────────────────────────────────
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
      metaDelivered: metaDeliverySuccess,
      ...(metaDeliveryError && { metaError: metaDeliveryError }),
    });
  } catch (error: any) {
    console.error("[INBOX_SEND_MESSAGE]", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
