import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { getGeminiEmbeddings } from "@/lib/ai/embeddings";
import { getContext } from "@/lib/ai/rag";
import { openRouter } from "@/lib/ai/embeddings";
import { getOpenRouterModel, CHAT_MODELS } from "@/lib/ai/chat-models";
import { getCompareCreditCost, getModelTier, getCreditCostByTier, CREDIT_COSTS } from "@/lib/domain/credit-config";

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

    // 2. Credit check — compare mode: (modelA cost + modelB cost) × 2
    const user = await db.user.findUnique({ where: { userId }, select: { plan: true, creditsBalance: true } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const openRouterModelA = getOpenRouterModel(providerA, modelA);
    const openRouterModelB = getOpenRouterModel(providerB, modelB);
    const creditsRequired = getCompareCreditCost(openRouterModelA, openRouterModelB);

    if (user.plan !== "enterprise" && user.creditsBalance < creditsRequired) {
      return NextResponse.json({
        error: "Insufficient credits. Please upgrade.",
        code: "INSUFFICIENT_CREDITS",
        credits_required: creditsRequired,
        credits_balance: user.creditsBalance,
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

    // 9. Credit deduction — compare mode costs
    if (user.plan !== "enterprise") {
      const tierA = getModelTier(openRouterModelA);
      const tierB = getModelTier(openRouterModelB);
      await db.$transaction([
        db.user.update({
          where: { userId },
          data: {
            creditsBalance:       { decrement: creditsRequired },
            creditsUsedThisCycle: { increment: creditsRequired },
          },
        }),
        db.creditTransaction.create({
          data: {
            userId,
            chatbotId,
            action_type:   "compare",
            model_tier:    null, // দুটো model আছে, তাই null
            credits_spent: creditsRequired,
            metadata: {
              modelA: openRouterModelA, tierA,
              modelB: openRouterModelB, tierB,
              is_test_chat: true,
            },
          },
        }),
      ]);
    }

    return NextResponse.json({
      a: contentA,
      b: contentB,
    });

  } catch (error) {
    console.error("[COMPARE_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
