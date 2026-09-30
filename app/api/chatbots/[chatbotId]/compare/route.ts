import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { getGeminiEmbeddings } from "@/lib/ai/embeddings";
import { getContext } from "@/lib/ai/rag";
import { openRouter } from "@/lib/ai/embeddings";
import { getDisplayModelLabel, getLiveChatModels, getOpenRouterModel } from "@/lib/ai/chat-models";
import { checkProModeAccess, toDeniedResponse } from "@/lib/ai/plan-model-access";
import type { Region } from "@/lib/core/region";
import { getModelTier } from "@/lib/domain/credit-config";
import { resolveCompareCredits } from "@/lib/ai/credit-resolver";
import { logAiUsage } from "@/lib/ai/usage-logger";
import { MAX_COMPARE_MODELS, MIN_COMPARE_MODELS } from "@/lib/domain/compare-config";

/**
 * Compare-এর credit ভাগ।
 *
 * ⚠️ তুলে নেওয়া মোট credit আর ভাগগুলোর যোগফল **হুবহু** সমান হতে হবে, নইলে
 *    usage log-এ মডেলপ্রতি খরচের যোগফল আর `creditTransaction`-এর অঙ্ক মিলত না
 *    — আর cost analytics-এ গরমিল দেখা দিত। তাই `Math.ceil`/`Math.floor` জোড়ার
 *    বদলে ভাগশেষগুলো প্রথম কয়েকটা মডেলে এক একটা করে বসানো হয়।
 */
function splitCredits(total: number, parts: number): number[] {
  const per = Math.floor(total / parts);
  const remainder = total - per * parts;

  return Array.from({ length: parts }, (_, i) => per + (i < remainder ? 1 : 0));
}

/**
 * দেহ থেকে মডেলের তালিকা বের করা।
 *
 * `models: [{provider, model}, …]` — ২ থেকে ৪টা। পুরনো `providerA/modelA` +
 * `providerB/modelB` জোড়াটাও নেওয়া হয়, কারণ deploy-এর মুহূর্তে কারও ব্রাউজারে
 * পুরনো bundle এখনো চলতে পারে; ওটা ৪০০ খেলে সে কিছুই করতে পারত না।
 */
function readModels(body: unknown): { provider: string; model: string }[] | null {
  const b = body as {
    models?: unknown;
    providerA?: unknown;
    modelA?: unknown;
    providerB?: unknown;
    modelB?: unknown;
  };

  if (Array.isArray(b?.models)) {
    const parsed = b.models
      .map((entry) => {
        const e = entry as { provider?: unknown; model?: unknown };
        return { provider: String(e?.provider ?? ""), model: String(e?.model ?? "") };
      })
      .filter((e) => e.provider && e.model);

    if (parsed.length !== b.models.length) return null;
    return parsed.length >= MIN_COMPARE_MODELS && parsed.length <= MAX_COMPARE_MODELS
      ? parsed
      : null;
  }

  const legacy = [
    { provider: String(b?.providerA ?? ""), model: String(b?.modelA ?? "") },
    { provider: String(b?.providerB ?? ""), model: String(b?.modelB ?? "") },
  ];
  return legacy.every((e) => e.provider && e.model) ? legacy : null;
}

interface CompareResult {
  modelId: string;
  label: string;
  content: string;
  promptTokens: number;
  completionTokens: number;
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
    const { message, sessionId } = body as { message?: string; sessionId?: string };
    const requested = readModels(body);

    if (!message || !sessionId || !requested) {
      return NextResponse.json(
        {
          error: `Missing required fields. Send a message, a sessionId, and ${MIN_COMPARE_MODELS}–${MAX_COMPARE_MODELS} models.`,
        },
        { status: 400 }
      );
    }

    // 1. Verify chatbot ownership
    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const user = await db.user.findUnique({ where: { userId }, select: { plan: true, region: true, creditsBalance: true } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ── Plan gate ────────────────────────────────────────────────────────────
    // ⚠️ এই রুটটা স্বভাবতই Pro: মডেলের id সোজা ক্লায়েন্টের body থেকে আসে,
    //    ড্যাশবোর্ডের preset থেকে নয়। অর্থাৎ এখানে merchant নিজেই ঠিক করেন
    //    কোন মডেল চলবে — আর "নিজে মডেল বাছা"-টাই Pro মোডের সংজ্ঞা। তাই এখানে
    //    `promptMode` দেখার কিছু নেই: এই সুবিধাটা পেতেই plan-এ Pro থাকতে হবে।
    //
    //    ক্লায়েন্টের body-তে ভরসা না করে এখানে যাচাই করা অপরিহার্য — curl দিয়ে
    //    যেকোনো চারটা মডেল পাঠানো যেত, আর response-টা ফেরতও আসত।
    const denied = toDeniedResponse(
      checkProModeAccess(user.plan, (user.region || "bd") as Region)
    );
    if (denied) return denied;

    // ⚠️ মডেল-তালিকা ও preset DB থেকে **একবারই** পড়া হয়, তারপর শুধু ব্যবহার।
    //    আগে `getOpenRouterModel` দুইবার ডাকা হত — একই ইনপুট, একই কল।
    const modelIds = await Promise.all(
      requested.map((entry) => getOpenRouterModel(entry.provider, entry.model))
    );

    // ⚠️ `credit-resolver.ts` থেকে — admin override ও টেস্ট গুণক দুটোই ভেতরে
    const creditsRequired = (await resolveCompareCredits(modelIds)).credits;

    if (user.creditsBalance < creditsRequired) {
      return NextResponse.json({
        error: "Insufficient credits. Please upgrade.",
        code: "INSUFFICIENT_CREDITS",
        credits_required: creditsRequired,
        credits_balance: user.creditsBalance,
      }, { status: 402 });
    }

    // 2. Find or Create Chat Session in the database
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

    // 3. Save User Message to the Database
    await db.chatMessage.create({
      data: {
        chatbotId,
        userId,
        sessionId,
        role: "user",
        content: message,
      }
    });

    // 4. Retrieve RAG Context (using Gemini Embedding)
    let context = "";
    try {
      const embeddings = await getGeminiEmbeddings(message);
      if (embeddings && embeddings.length > 0) {
        context = await getContext(chatbotId, embeddings[0]);
      }
    } catch (err) {
      console.error("[COMPARE_RAG_ERROR]", err);
    }

    // 5. Combine system prompt & context
    const systemPrompt = bot.systemPrompt || "You are a helpful assistant.";
    let fullSystemPrompt = `${systemPrompt}\n\nBelow is some context retrieved from the database to help you answer the user's question. Use it to formulate your answer if relevant:\n-----\n${context}\n-----`;

    // 5b. Inject Sample Replies as few-shot tone/persona examples
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

    // 6. একই prompt সব মডেলকে — নইলে তুলনাটাই অর্থহীন হত।
    //
    // ⚠️ একটা মডেল ব্যর্থ হলে বাকিরা তবু উত্তর দেয় (`catch` প্রতি কলে আলাদা),
    //    কারণ একটা provider down থাকলে পুরো তুলনা হারানো মানে merchant-এর
    //    credit কেটে কিছু না দেওয়া।
    const settled = await Promise.all(
      modelIds.map((modelId) =>
        openRouter.chat.completions.create({
          model: modelId,
          messages: [
            { role: "system", content: fullSystemPrompt },
            { role: "user", content: message }
          ],
          temperature: bot.temperature,
          max_tokens: bot.maxTokens,
        }).catch((err) => {
          console.error(`[COMPARE_MODEL_ERROR] ${modelId}:`, err);
          return { choices: [{ message: { content: `Error: Failed to fetch response from ${modelId}.` } }] };
        })
      )
    );

    const liveModels = await getLiveChatModels();

    const results: CompareResult[] = settled.map((res, i) => {
      const modelId = modelIds[i];
      const content = res.choices[0]?.message?.content || "";
      // `usage` টাইপ-স্পেসে ঐচ্ছিক; না এলে অক্ষর গুনে আন্দাজ করা হয়
      const usage = (res as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;

      return {
        modelId,
        label: getDisplayModelLabel(liveModels, modelId),
        content,
        promptTokens:
          usage?.prompt_tokens ?? Math.ceil((fullSystemPrompt.length + message.length) / 4),
        completionTokens: usage?.completion_tokens ?? Math.ceil(content.length / 4),
      };
    });

    // 7. Save Assistant Messages to the Database (prefixed with Model Labels)
    //
    // ⚠️ প্রিফিক্সটা শুধু সাজসজ্জা নয় — history লোড করার সময় এই `[label]: `
    //    খুলেই কোন উত্তর কোন মডেলের তা ফেরত পাওয়া যায়। তাই ফরম্যাট বদলালে
    //    পুরনো সেশনগুলোর তুলনা ভেঙে যাবে।
    await Promise.all(
      results.map((r) =>
        db.chatMessage.create({
          data: {
            chatbotId,
            userId,
            sessionId,
            role: "assistant",
            content: `[${r.label}]: ${r.content}`,
          }
        })
      )
    );

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
            models: results.map((r) => ({ model: r.modelId, tier: getModelTier(r.modelId) })),
            modelCount: results.length,
            is_test_chat: true,
          },
        },
      }),
    ]);

    // Fire-and-forget usage logs — মডেলপ্রতি একটা, credit ভাগ করা
    const creditShares = splitCredits(creditsRequired, results.length);
    results.forEach((r, i) => {
      logAiUsage({
        workspaceId: bot.workspaceId || undefined,
        chatbotId: bot.chatbotId,
        sessionId,
        channel: "compare",
        modelId: r.modelId,
        promptTokens: r.promptTokens,
        completionTokens: r.completionTokens,
        userId,
        creditsDeducted: creditShares[i],
      }).catch((err) => console.error(`[COMPARE_LOG_USAGE_ERROR] ${r.modelId}`, err));
    });

    return NextResponse.json({
      replies: results.map((r) => ({ modelId: r.modelId, label: r.label, content: r.content })),
    });

  } catch (error) {
    console.error("[COMPARE_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
