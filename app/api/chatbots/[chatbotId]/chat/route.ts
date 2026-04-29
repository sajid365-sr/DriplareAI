import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getEmbeddings } from "@/lib/embeddings";
import { getContext } from "@/lib/rag";
import { openRouter } from "@/lib/embeddings";
import { getOpenRouterModel } from "@/lib/chat-models";
import { getOwnedChatbot } from "@/lib/chatbot-access";

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

    // Ensure user has points
    const user = await db.user.findUnique({ where: { userId } });
    if (!user) {
      console.log("[CHAT] User not found in database:", userId);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    if (user.points <= user.pointsUsed) {
      return NextResponse.json({ error: "No points remaining" }, { status: 402 });
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

    // 6. Save messages to DB
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

    // 7. Deduct Point
    await db.user.update({
      where: { userId },
      data: { pointsUsed: { increment: 1 } },
    });

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[CHAT_LLM]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
