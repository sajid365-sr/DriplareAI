import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getEmbeddings } from "@/lib/embeddings";
import { getContext } from "@/lib/rag";
import { openRouter } from "@/lib/embeddings";
import { getOpenRouterModel } from "@/lib/chat-models";
import { getOwnedChatbot } from "@/lib/chatbot-access";
import { calculateActualCost } from "@/lib/model-pricing";
import { getPlan, type PlanKey } from "@/lib/plan-config";
import type { Region } from "@/lib/region";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;

    if (!userId) {
      console.log("[CHAT] No userId found in auth");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message, sessionId = "default", guestName = "Web User" } = await req.json();
    const normalizedSessionId = String(sessionId || "default").slice(0, 120);

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      console.log("[CHAT] Bot not found or not owned by user:", chatbotId, userId);
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    // Fetch user and check plan limits
    const user = await db.user.findUnique({ where: { userId } });
    if (!user) {
      console.log("[CHAT] User not found in database:", userId);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if starter trial has expired
    if (user.plan === "starter" && user.planExpiresAt && new Date() > user.planExpiresAt) {
      return NextResponse.json({ 
        error: "Trial expired. Please upgrade your plan.",
        code: "TRIAL_EXPIRED"
      }, { status: 402 });
    }

    // Get the plan config for this user's region and plan
    const region = (user.region || "bd") as Region;
    const planConfig = getPlan(region, user.plan as PlanKey);

    // Check if user has exceeded included messages and has no overage system yet
    // For now: if messages used >= included, and plan is starter → block
    if (user.plan === "starter" && user.messagesUsedThisCycle >= planConfig.includedMessages) {
      return NextResponse.json({ 
        error: "Free message quota exhausted. Please upgrade your plan.",
        code: "QUOTA_EXHAUSTED"
      }, { status: 402 });
    }

    // Handle ChatSession
    let chatSession = await db.chatSession.findUnique({
      where: { chatbotId_sessionId: { chatbotId, sessionId: normalizedSessionId } }
    });

    if (!chatSession) {
      chatSession = await db.chatSession.create({
        data: {
          chatbotId,
          sessionId: normalizedSessionId,
          platform: "web",
          guestName: guestName,
        }
      });
    }

    if (!chatSession.isActive) {
      // Just save user message and return an empty reply (human handles it)
      try {
        await db.chatMessage.create({
          data: { chatbotId, userId, sessionId: normalizedSessionId, role: "user", content: message }
        });
      } catch (err) {
        console.error("[CHAT] DB Save Error for inactive session:", err);
      }
      return NextResponse.json({ reply: "" }); // or a default handoff message
    }

    // 1. Get embedding for the user's message
    const [queryEmbedding] = await getEmbeddings([message]);

    // 2. Retrieve relevant context from DB
    const contextStr = await getContext(chatbotId, queryEmbedding, 5);

    // 3. Assemble system prompt
    let systemPrompt = bot.systemPrompt;
    if (contextStr) {
      systemPrompt += `\n\nKnowledge Base Context:\n${contextStr}\n\nUse the above context to answer the user's question. If the answer is not in the context, say you don't know.`;
    }

    // 4. Fetch recent chat history
    const history = await db.chatMessage.findMany({
      where: { chatbotId, sessionId: normalizedSessionId },
      orderBy: { timestamp: "desc" },
      take: 6,
    });
    const formattedHistory = history.reverse().map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    const orModel = getOpenRouterModel(bot.provider, bot.model);

    // 5. Call LLM via OpenRouter
    const completion = await openRouter.chat.completions.create({
      model: orModel,
      messages: [
        { role: "system", content: systemPrompt },
        ...formattedHistory,
        { role: "user", content: message },
      ],
      temperature: bot.temperature,
      max_tokens: bot.maxTokens,
      extra_headers: {
        "HTTP-Referer": "https://driplare.com",
        "X-Title": "Driplare AI",
      },
    });

    const reply = completion.choices[0]?.message?.content || "";

    // 6. Extract token usage from OpenRouter response
    const usage = completion.usage;
    const promptTokens = usage?.prompt_tokens || 0;
    const completionTokens = usage?.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;

    // Calculate actual API cost (what OpenRouter charges us)
    const actualCostUSD = calculateActualCost(bot.model, promptTokens, completionTokens);

    // Determine if this message is within the free quota
    const isFreeMessage = user.messagesUsedThisCycle < planConfig.includedMessages;
    const chargedAmount = isFreeMessage ? 0 : planConfig.perMessageRate;
    const chargedCurrency = region === "bd" ? "BDT" : "USD";

    // 7. Save messages to DB
    console.log("[CHAT] Attempting to save messages to DB...");
    try {
      await db.chatMessage.create({
        data: {
          chatbotId,
          userId,
          sessionId: normalizedSessionId,
          role: "user",
          content: message,
        },
      });
      
      await db.chatMessage.create({
        data: {
          chatbotId,
          userId,
          sessionId: normalizedSessionId,
          role: "assistant",
          content: reply,
        },
      });
      console.log("[CHAT] Messages saved successfully.");
    } catch (dbError) {
      console.error("[CHAT] DB Save Error:", dbError);
    }

    // 8. Log AI usage and update message counter
    try {
      await db.aIUsageLog.create({
        data: {
          userId,
          chatbotId,
          sessionId: normalizedSessionId,
          platform: chatSession.platform || "web",
          model: bot.model,
          promptTokens,
          completionTokens,
          totalTokens,
          actualCostUSD,
          chargedAmount,
          chargedCurrency,
          isFreeMessage,
        },
      });

      const updatedUser = await db.user.update({
        where: { userId },
        data: { messagesUsedThisCycle: { increment: 1 } },
      });

      // --- Trigger Background Analytics ---
      // We don't await this to keep the chat response fast
      import("@/lib/services/analytics").then(m => m.analyzeSession(chatbotId, normalizedSessionId)).catch(err => console.error("[ANALYTICS_TRIGGER_ERR]", err));

      // --- Check Usage Alerts ---
      try {
        const totalMessages = updatedUser.includedMessages;
        const used = updatedUser.messagesUsedThisCycle;
        const settings = (updatedUser.notificationSettings as any) || {};

        if (totalMessages > 0 && (settings.usage_alerts_app !== false || settings.usage_alerts_email !== false)) {
          // Trigger 100% alert
          if (used === totalMessages) {
            // In-app
            if (settings.usage_alerts_app !== false) {
              await db.notification.create({
                data: {
                  userId,
                  type: "usage",
                  title: "Quota Exhausted",
                  message: "You have used 100% of your monthly AI messages quota. Please upgrade to continue.",
                }
              });
            }
            // Email
            if (settings.usage_alerts_email !== false) {
              const { sendMail, MailTemplates } = await import("@/lib/mail");
              await sendMail({
                to: updatedUser.email,
                subject: "Usage Alert: 100% messages quota reached - Driplare AI",
                html: MailTemplates.usageAlert(updatedUser.name || "User", 100, totalMessages)
              });
            }
          } 
          // Trigger 80% alert
          else if (used === Math.floor(totalMessages * 0.8)) {
            // In-app
            if (settings.usage_alerts_app !== false) {
              await db.notification.create({
                data: {
                  userId,
                  type: "usage",
                  title: "Usage Alert (80%)",
                  message: "You've used 80% of your monthly AI messages quota.",
                }
              });
            }
            // Email
            if (settings.usage_alerts_email !== false) {
              const { sendMail, MailTemplates } = await import("@/lib/mail");
              await sendMail({
                to: updatedUser.email,
                subject: "Usage Alert: 80% messages quota reached - Driplare AI",
                html: MailTemplates.usageAlert(updatedUser.name || "User", 80, totalMessages)
              });
            }
          }
        }
      } catch (alertError) {
        console.error("[USAGE_ALERT_ERROR]", alertError);
      }
    } catch (logError) {
      console.error("[CHAT] Usage log error:", logError);
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[CHAT_LLM]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
