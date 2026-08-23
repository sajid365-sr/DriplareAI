import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { getGeminiEmbeddings } from "@/lib/ai/embeddings";
import { getContext } from "@/lib/ai/rag";
import { openRouter } from "@/lib/ai/embeddings";
import { getDisplayModelLabel, getLiveChatModels, getOpenRouterModel } from "@/lib/ai/chat-models";
import { getCompareCreditCost, getModelTier } from "@/lib/domain/credit-config";
import { logAiUsage } from "@/lib/ai/usage-logger";

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

    const openRouterModelA = await getOpenRouterModel(providerA, modelA);
    const openRouterModelB = await getOpenRouterModel(providerB, modelB);
    const creditsRequired = getCompareCreditCost(openRouterModelA, openRouterModelB);

    if (user.creditsBalance < creditsRequired) {
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
    let fullSystemPrompt = `${systemPrompt}\n\nBelow is some context retrieved from the database to help you answer the user's question. Use it to formulate your answer if relevant:\n-----\n${context}\n-----`;

    // 6b. Inject Sample Replies as few-shot tone/persona examples
    try {
      const sampleReplies = await db.sampleReply.findMany({
        where: { chatbotId: bot.chatbotId },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      if (sampleReplies.length > 0) {
        const examples = sampleReplies
          .map((s) => `Customer: ${s.customerMessage}\nYou: ${s.reply}`)
          .join("\n\n");
        fullSystemPrompt += `\n\nExamples of the tone and style you should use when replying:\n${examples}`;
      }
    } catch (err) {
      console.error("[COMPARE_SAMPLE_REPLY_ERROR]", err);
    }

    // 7. Send parallel calls to both models
    const modelIdA = await getOpenRouterModel(providerA, modelA);
    const modelIdB = await getOpenRouterModel(providerB, modelB);

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

    const liveModels = await getLiveChatModels();
    const labelA = getDisplayModelLabel(liveModels, modelIdA);
    const labelB = getDisplayModelLabel(liveModels, modelIdB);

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
          model_tier:    null,
          credits_spent: creditsRequired,
          metadata: {
            modelA: openRouterModelA, tierA,
            modelB: openRouterModelB, tierB,
            is_test_chat: true,
          },
        },
      }),
    ]);

    const usageA = (resA as any).usage;
    const usageB = (resB as any).usage;
    const promptTokensA = usageA?.prompt_tokens ?? Math.ceil((fullSystemPrompt.length + message.length) / 4);
    const completionTokensA = usageA?.completion_tokens ?? Math.ceil(contentA.length / 4);
    const promptTokensB = usageB?.prompt_tokens ?? Math.ceil((fullSystemPrompt.length + message.length) / 4);
    const completionTokensB = usageB?.completion_tokens ?? Math.ceil(contentB.length / 4);

    // Fire-and-forget usage logs for both models
    logAiUsage({
      workspaceId: bot.workspaceId || undefined,
      chatbotId: bot.chatbotId,
      sessionId,
      channel: "compare",
      modelId: modelIdA,
      promptTokens: promptTokensA,
      completionTokens: completionTokensA,
      userId,
      creditsDeducted: Math.ceil(creditsRequired / 2),
    }).catch((err) => console.error("[COMPARE_LOG_USAGE_A_ERROR]", err));

    logAiUsage({
      workspaceId: bot.workspaceId || undefined,
      chatbotId: bot.chatbotId,
      sessionId,
      channel: "compare",
      modelId: modelIdB,
      promptTokens: promptTokensB,
      completionTokens: completionTokensB,
      userId,
      creditsDeducted: Math.floor(creditsRequired / 2),
    }).catch((err) => console.error("[COMPARE_LOG_USAGE_B_ERROR]", err));

    return NextResponse.json({
      a: contentA,
      b: contentB,
    });

  } catch (error) {
    console.error("[COMPARE_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
