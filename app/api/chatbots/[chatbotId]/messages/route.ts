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

    const platform = session?.platform || (sessionId.startsWith("fb_") ? "facebook" : "web");

    // ── 2. Meta Graph API Delivery for Facebook sessions ──────────────────────
    let metaDeliverySuccess = false;
    let metaDeliveryError: string | null = null;

    if (sentByHuman && platform === "facebook") {
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
          // Send text payload if text is present
          if (textStr) {
            const textPayload = {
              recipient: { id: psid },
              messaging_type: "RESPONSE",
              message: { text: textStr },
            };

            const textRes = await fetch(metaEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(textPayload),
            });

            if (!textRes.ok) {
              const textErr = await textRes.text();
              console.error("[MESSAGES_POST] Meta text delivery error:", textErr);
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
              console.error("[MESSAGES_POST] Meta media delivery error:", mediaErr);
              metaDeliveryError = mediaErr;
            } else {
              metaDeliverySuccess = true;
            }
          }
        } catch (metaErr: any) {
          console.error("[MESSAGES_POST] Meta API fetch exception:", metaErr);
          metaDeliveryError = metaErr.message || "Meta API call failed";
        }
      }
    }

    // ── 3. Save Message to Database ───────────────────────────────────────────
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
