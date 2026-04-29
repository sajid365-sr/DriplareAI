import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEmbeddings, openRouter } from "@/lib/embeddings";
import { getContext } from "@/lib/rag";
import { getOpenRouterModel } from "@/lib/chat-models";

// Shared AI Processing Logic
async function processAiResponse(
  chatbotId: string, 
  sessionId: string, 
  messageText: string,
  platform: "facebook" | "whatsapp",
  sendReply: (reply: string) => Promise<{ success: boolean; error?: string }>
) {
  try {
    const bot = await db.chatbot.findUnique({ where: { chatbotId } });
    if (!bot) return;

    // Handle ChatSession
    let chatSession = await db.chatSession.findUnique({
      where: { chatbotId_sessionId: { chatbotId, sessionId } }
    });

    if (!chatSession) {
      chatSession = await db.chatSession.create({
        data: { chatbotId, sessionId, platform, isActive: true }
      });
    }

    // If session is inactive, just save message and skip LLM
    if (!chatSession.isActive) {
      await db.chatMessage.create({
        data: { chatbotId, userId: bot.userId, sessionId, role: "user", content: messageText }
      });
      return;
    }

    const user = await db.user.findUnique({ where: { userId: bot.userId } });
    if (!user || user.points <= user.pointsUsed) {
      await sendReply("Sorry, you have exhausted your message quota.");
      return;
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
    });

    const reply = completion.choices[0]?.message?.content || "";
    const res = await sendReply(reply);

    if (res.success) {
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
    }
  } catch (err) {
    console.error("[META_WEBHOOK_HELPER] Error:", err);
  }
}

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
  console.log(">>> RECEIVED A POST REQUEST TO /api/webhooks/meta <<<");
  try {
    const body = await req.json();
    console.log("[META_WEBHOOK] Received body:", JSON.stringify(body, null, 2));

    if (body.object === "page") {
      for (const entry of body.entry) {
        const pageId = entry.id;
        console.log(`[META_WEBHOOK] Processing entry for pageId: ${pageId}`);
        
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
          console.error(`[META_WEBHOOK] No integration found for pageId: ${pageId}. Available pageIds:`, integrations.map(i => (i.config as any)?.pageId));
          continue;
        }

        const chatbotId = integration.chatbotId;
        const cfg = integration.config as Record<string, any>;
        const pageAccessToken = cfg.pageToken;

        if (!entry.messaging) {
          console.log("[META_WEBHOOK] No messaging events in this entry");
          continue;
        }

        for (const messagingEvent of entry.messaging) {
          if (messagingEvent.message && messagingEvent.message.text && !messagingEvent.message.is_echo) {
            const senderId = messagingEvent.sender.id;
            const messageText = messagingEvent.message.text;
            const sessionId = `fb_${senderId}`;
            console.log(`[META_WEBHOOK] Message from ${senderId}: ${messageText}`);

            // Handle ChatSession
            let chatSession = await db.chatSession.findUnique({
              where: { chatbotId_sessionId: { chatbotId, sessionId } }
            });

            if (!chatSession || !chatSession.guestName) {
              console.log(`[META_WEBHOOK] Missing guestName for ${sessionId}, fetching...`);
              let guestName = chatSession?.guestName || null;
              try {
                const nameUrl = `https://graph.facebook.com/${senderId}?fields=first_name,last_name&access_token=${pageAccessToken}`;
                const res = await fetch(nameUrl);
                if (res.ok) {
                  const fbUser = await res.json();
                  guestName = fbUser.first_name ? `${fbUser.first_name} ${fbUser.last_name || ''}`.trim() : guestName;
                  console.log(`[META_WEBHOOK] Successfully fetched name: ${guestName}`);
                  
                  // Reset integration error if it was in error state
                  if (integration.status !== "active") {
                    await db.integration.update({
                      where: { id: integration.id },
                      data: { status: "active", lastError: null }
                    });
                  }
                } else {
                  const errData = await res.json();
                  console.error(`[META_WEBHOOK] FB Name Fetch Error:`, JSON.stringify(errData));
                  
                  // Handle expired token (Error code 190)
                  if (errData.error?.code === 190) {
                    await db.integration.update({
                      where: { id: integration.id },
                      data: { 
                        status: "error", 
                        lastError: "Facebook Access Token has expired. Please reconnect your page." 
                      }
                    });
                  }
                }
              } catch (err) {
                console.error("[META_WEBHOOK] Exception fetching FB user name", err);
              }

              if (!chatSession) {
                console.log(`[META_WEBHOOK] Creating new ChatSession for ${sessionId}`);
                chatSession = await db.chatSession.create({
                  data: {
                    chatbotId,
                    sessionId,
                    platform: "facebook",
                    guestName
                  }
                });
              } else if (guestName && guestName !== chatSession.guestName) {
                console.log(`[META_WEBHOOK] Updating guestName for ${sessionId} to ${guestName}`);
                chatSession = await db.chatSession.update({
                  where: { id: chatSession.id },
                  data: { guestName }
                });
              }
            }

            const bot = await db.chatbot.findUnique({ where: { chatbotId } });
            if (!bot) {
              console.error(`[META_WEBHOOK] Chatbot ${chatbotId} not found`);
              continue;
            }

            // If session is inactive, just save message and skip LLM
            if (!chatSession.isActive) {
              console.log(`[META_WEBHOOK] Session ${sessionId} is INACTIVE. Saving user message only.`);
              try {
                await db.chatMessage.create({
                  data: { chatbotId, userId: bot.userId, sessionId, role: "user", content: messageText }
                });
              } catch (err) {
                console.error("[META_WEBHOOK] DB Save Error for inactive session:", err);
              }
              continue;
            }

            const user = await db.user.findUnique({ where: { userId: bot.userId } });
            if (!user || user.points <= user.pointsUsed) {
              console.log(`[META_WEBHOOK] User out of points. Sending quota message.`);
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

            console.log(`[META_WEBHOOK] Processing through LLM for ${senderId}...`);
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
            console.log(`[META_WEBHOOK] AI Reply: ${reply}`);

            // Send reply via Facebook Graph API
            console.log(`[META_WEBHOOK] Sending reply to FB...`);
            const fbRes = await fetch(`https://graph.facebook.com/v20.0/${pageId}/messages?access_token=${pageAccessToken}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipient: { id: senderId },
                message: { text: reply }
              })
            });

            if (!fbRes.ok) {
              const fbErr = await fbRes.json();
              console.error("[META_WEBHOOK] FB Send Error:", JSON.stringify(fbErr));
              
              // Handle expired token (Error code 190)
              if (fbErr.error?.code === 190) {
                await db.integration.update({
                  where: { id: integration.id },
                  data: { 
                    status: "error", 
                    lastError: "Facebook Access Token has expired. Please reconnect your page." 
                  }
                });
              }
            } else {
              console.log(`[META_WEBHOOK] Reply sent successfully to FB`);
              
              // Reset integration error if it was in error state
              if (integration.status !== "active") {
                await db.integration.update({
                  where: { id: integration.id },
                  data: { status: "active", lastError: null }
                });
              }
            }

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
              console.log(`[META_WEBHOOK] Saved messages to DB and incremented points.`);
            } catch (dbError) {
              console.error("[META_WEBHOOK] DB Save Error:", dbError);
            }
          }
        }
      }
      return new NextResponse("EVENT_RECEIVED", { status: 200 });
    }

    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field !== "messages") continue;
          
          const value = change.value;
          const phoneId = value.metadata.phone_number_id;
          
          // Find integration
          const integration = await db.integration.findFirst({
            where: {
              platform: "whatsapp",
              connected: true,
              config: { path: ["phoneNumberId"], equals: phoneId }
            }
          });

          if (!integration || !value.messages) continue;
          
          const cfg = integration.config as any;
          const accessToken = cfg.accessToken;

          for (const msg of value.messages) {
            if (msg.type !== "text") continue;
            
            const from = msg.from;
            const text = msg.text.body;
            const sessionId = `wa_${from}`;
            const contact = value.contacts?.find((c: any) => c.wa_id === from);
            const guestName = contact?.profile?.name || null;

            // Ensure session has guestName
            await db.chatSession.upsert({
              where: { chatbotId_sessionId: { chatbotId: integration.chatbotId, sessionId } },
              update: { guestName: guestName },
              create: { chatbotId: integration.chatbotId, sessionId, platform: "whatsapp", guestName, isActive: true }
            });

            await processAiResponse(
              integration.chatbotId,
              sessionId,
              text,
              "whatsapp",
              async (reply) => {
                const waRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                  body: JSON.stringify({
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    to: from,
                    type: "text",
                    text: { body: reply }
                  })
                });
                return { success: waRes.ok };
              }
            );
          }
        }
      }
      return new NextResponse("EVENT_RECEIVED", { status: 200 });
    }

    console.log(`[META_WEBHOOK] Object was not supported: ${body.object}`);
    return new NextResponse("Not Found", { status: 404 });
  } catch (error) {
    console.error("[META_WEBHOOK] Fatal Error:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
