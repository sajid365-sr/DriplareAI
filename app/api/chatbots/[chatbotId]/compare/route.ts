import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { getPlan, type PlanKey } from "@/lib/domain/plan-config";
import type { Region } from "@/lib/core/region";
import { getGeminiEmbeddings } from "@/lib/ai/embeddings";
import { getContext } from "@/lib/ai/rag";
import { openRouter } from "@/lib/ai/embeddings";
import { getOpenRouterModel, CHAT_MODELS } from "@/lib/ai/chat-models";

function getModelLabel(provider: string, model: string): string {
  const found = CHAT_MODELS.find(
    (m) => m.provider === provider && m.model === model
  );
  return found ? found.label : model;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { message, providerA, modelA, providerB, modelB, sessionId } = body;

    if (!message || !modelA || !providerA || !modelB || !providerB || !sessionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Verify chatbot ownership
    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    // 2. Quota check
    const user = await db.user.findUnique({ where: { userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const region = (user.region || "bd") as Region;
    const planConfig = getPlan(region, user.plan as PlanKey);

    if (planConfig.includedMessages !== Infinity && user.messagesUsedThisCycle + 2 > planConfig.includedMessages) {
      return NextResponse.json({ 
        error: "Quota exhausted. Please upgrade.",
        code: "QUOTA_EXHAUSTED"
      }, { status: 402 });
    }

    // 3. Find or Create Chat Session in the database
    let session = await db.chatSession.findUnique({
      where: {
        chatbotId_sessionId: {
          chatbotId,
          sessionId,
        }
      }
    });

    if (!session) {
      session = await db.chatSession.create({
        data: {
          chatbotId,
          sessionId,
          platform: "compare",
          guestName: "Model Compare Sandbox",
        }
      });
    }

    // 4. Save User Message to the Database
    await db.chatMessage.create({
      data: {
        chatbotId,
        userId,
        sessionId,
        role: "user",
        content: message,
      }
    });

    // 5. Retrieve RAG Context (using Gemini Embedding)
    let context = "";
    try {
      const embeddings = await getGeminiEmbeddings(message);
      if (embeddings && embeddings.length > 0) {
        context = await getContext(chatbotId, embeddings[0]);
      }
    } catch (err) {
      console.error("[COMPARE_RAG_ERROR]", err);
    }

    // 6. Combine system prompt & context
    const systemPrompt = bot.systemPrompt || "You are a helpful assistant.";
    const fullSystemPrompt = `${systemPrompt}

Below is some context retrieved from the database to help you answer the user's question. Use it to formulate your answer if relevant:
-----
${context}
-----`;

    // 7. Send parallel calls to both models
    const modelIdA = getOpenRouterModel(providerA, modelA);
    const modelIdB = getOpenRouterModel(providerB, modelB);

    const [resA, resB] = await Promise.all([
      openRouter.chat.completions.create({
        model: modelIdA,
        messages: [
          { role: "system", content: fullSystemPrompt },
          { role: "user", content: message }
        ],
        temperature: bot.temperature,
        max_tokens: bot.maxTokens,
      }).catch(err => {
        console.error(`Error querying model A (${modelIdA}):`, err);
        return { choices: [{ message: { content: `Error: Failed to fetch response from ${modelA}.` } }] };
      }),
      openRouter.chat.completions.create({
        model: modelIdB,
        messages: [
          { role: "system", content: fullSystemPrompt },
          { role: "user", content: message }
        ],
        temperature: bot.temperature,
        max_tokens: bot.maxTokens,
      }).catch(err => {
        console.error(`Error querying model B (${modelIdB}):`, err);
        return { choices: [{ message: { content: `Error: Failed to fetch response from ${modelB}.` } }] };
      })
    ]);

    const contentA = resA.choices[0]?.message?.content || "";
    const contentB = resB.choices[0]?.message?.content || "";

    const labelA = getModelLabel(providerA, modelA);
    const labelB = getModelLabel(providerB, modelB);

    // 8. Save Assistant Messages to the Database (prefixed with Model Labels)
    await Promise.all([
      db.chatMessage.create({
        data: {
          chatbotId,
          userId,
          sessionId,
          role: "assistant",
          content: `[${labelA}]: ${contentA}`,
        }
      }),
      db.chatMessage.create({
        data: {
          chatbotId,
          userId,
          sessionId,
          role: "assistant",
          content: `[${labelB}]: ${contentB}`,
        }
      })
    ]);

    // 9. Update user's message quota (deduct 2 points)
    await db.user.update({
      where: { userId },
      data: {
        messagesUsedThisCycle: { increment: 2 }
      }
    });

    return NextResponse.json({
      a: contentA,
      b: contentB,
    });

  } catch (error) {
    console.error("[COMPARE_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
