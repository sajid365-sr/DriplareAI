import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEmbeddings } from "@/lib/embeddings";
import { getContext } from "@/lib/rag";
import { openRouter } from "@/lib/embeddings";
import { getOpenRouterModel } from "@/lib/chat-models";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new NextResponse(challenge, { status: 200 });
    } else {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  return new NextResponse("Bad Request", { status: 400 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.object === "page") {
      for (const entry of body.entry) {
        const pageId = entry.id;
        
        // Find integration to get the page access token and chatbotId
        const integrations = await db.integration.findMany({
          where: {
            platform: "facebook",
            connected: true,
          }
        });
        
        const integration = integrations.find(i => {
          if (typeof i.config === "object" && i.config !== null) {
            const cfg = i.config as Record<string, any>;
            return cfg.pageId === pageId;
          }
          return false;
        });

        if (!integration) {
          console.error(`[META_WEBHOOK] No integration found for pageId: ${pageId}`);
          continue;
        }

        const chatbotId = integration.chatbotId;
        const cfg = integration.config as Record<string, any>;
        const pageAccessToken = cfg.pageToken;

        for (const messagingEvent of entry.messaging) {
          if (messagingEvent.message && messagingEvent.message.text && !messagingEvent.message.is_echo) {
            const senderId = messagingEvent.sender.id;
            const messageText = messagingEvent.message.text;
            const sessionId = `fb_${senderId}`;

            // Process message via RAG & LLM
            const bot = await db.chatbot.findUnique({ where: { chatbotId } });
            if (!bot) continue;

            const user = await db.user.findUnique({ where: { userId: bot.userId } });
            if (!user || user.points <= user.pointsUsed) {
              await fetch(`https://graph.facebook.com/v20.0/${pageId}/messages?access_token=${pageAccessToken}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  recipient: { id: senderId },
                  message: { text: "Sorry, you have exhausted your message quota." }
                })
              });
              continue;
            }

            const [queryEmbedding] = await getEmbeddings([messageText]);
            const contextStr = await getContext(chatbotId, queryEmbedding, 5);

            let systemPrompt = bot.systemPrompt;
            if (contextStr) {
              systemPrompt += `\n\nKnowledge Base Context:\n${contextStr}\n\nUse the above context to answer the user's question. If the answer is not in the context, say you don't know.`;
            }

            const history = await db.chatMessage.findMany({
              where: { chatbotId, sessionId },
              orderBy: { timestamp: "desc" },
              take: 6,
            });
            const formattedHistory = history.reverse().map((msg) => ({
              role: msg.role as "user" | "assistant",
              content: msg.content,
            }));

            const orModel = getOpenRouterModel(bot.provider, bot.model);

            const completion = await openRouter.chat.completions.create({
              model: orModel,
              messages: [
                { role: "system", content: systemPrompt },
                ...formattedHistory,
                { role: "user", content: messageText },
              ],
              temperature: bot.temperature,
              max_tokens: bot.maxTokens,
              extra_headers: {
                "HTTP-Referer": "https://driplare.com",
                "X-Title": "Driplare AI",
              },
            });

            const reply = completion.choices[0]?.message?.content || "";

            // Send reply via Facebook Graph API
            await fetch(`https://graph.facebook.com/v20.0/${pageId}/messages?access_token=${pageAccessToken}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipient: { id: senderId },
                message: { text: reply }
              })
            });

            // Save messages to DB
            try {
              await db.chatMessage.createMany({
                data: [
                  { chatbotId, userId: bot.userId, sessionId, role: "user", content: messageText },
                  { chatbotId, userId: bot.userId, sessionId, role: "assistant", content: reply }
                ]
              });
              await db.user.update({
                where: { userId: bot.userId },
                data: { pointsUsed: { increment: 1 } },
              });
            } catch (dbError) {
              console.error("[META_WEBHOOK] DB Save Error:", dbError);
            }
          }
        }
      }
      return new NextResponse("EVENT_RECEIVED", { status: 200 });
    }
    return new NextResponse("Not Found", { status: 404 });
  } catch (error) {
    console.error("[META_WEBHOOK]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
