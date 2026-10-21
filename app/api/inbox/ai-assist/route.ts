import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { callModel } from "@/lib/ai/gateway";

// POST /api/inbox/ai-assist
// Modes:
// 1. "summary" - Full conversation summary & key points
// 2. "qa" - Ask any question about the conversation
// 3. "suggest_reply" - Generate next best reply for the agent to send in one click
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { chatbotId, sessionId, mode, question } = body;

    if (!chatbotId || !sessionId || !mode) {
      return NextResponse.json(
        { error: "chatbotId, sessionId and mode are required" },
        { status: 400 }
      );
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const botIds = Array.from(new Set([bot.id, bot.chatbotId]));

    // Fetch conversation messages
    const chatMessages = await db.chatMessage.findMany({
      where: {
        chatbotId: { in: botIds },
        sessionId,
      },
      orderBy: { timestamp: "asc" },
      take: 40,
    });

    if (chatMessages.length === 0) {
      return NextResponse.json({
        result: mode === "summary"
          ? "No messages found in this conversation yet."
          : "Conversation is empty.",
      });
    }

    // Format conversation history for prompt
    const conversationTranscript = chatMessages
      .map((m) => `${m.role === "user" ? "Customer" : "Agent/Bot"}: ${m.content}`)
      .join("\n");

    let systemInstruction = "";
    let userPrompt = "";

    switch (mode) {
      case "summary":
        systemInstruction =
          "You are an expert customer service analyst. Summarize the following customer chat into concise, actionable points: 1) What the customer wants/problem, 2) Key details (products, delivery, issues), 3) Current status/next steps. Keep it professional, brief (3-4 sentences maximum), in the language the conversation took place (Bengali or English).";
        userPrompt = `Conversation transcript:\n\n${conversationTranscript}\n\nPlease generate a concise summary.`;
        break;

      case "qa":
        if (!question?.trim()) {
          return NextResponse.json({ error: "question is required for qa mode" }, { status: 400 });
        }
        systemInstruction =
          "You are an AI assistant helping a human support moderator. Based strictly on the conversation transcript provided, answer the moderator's question accurately and helpfully.";
        userPrompt = `Conversation transcript:\n\n${conversationTranscript}\n\nModerator Question: ${question.trim()}`;
        break;

      case "suggest_reply":
      default:
        systemInstruction =
          "You are a top-tier polite, professional sales & support representative for this merchant. Read the conversation history and write the best single next message for the human agent to send to the customer right now. Keep it polite, helpful, clear, and ready to send directly. Do not include quotes or prefixes.";
        userPrompt = `Conversation transcript:\n\n${conversationTranscript}\n\nWrite the best next reply to the customer:`;
        break;
    }

    const aiRes = await callModel({
      task: "chat",
      userId,
      chatbotId: bot.chatbotId,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      maxTokens: 500,
    });

    return NextResponse.json({
      result: aiRes.text.trim(),
    });
  } catch (error) {
    console.error("[INBOX_AI_ASSIST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

