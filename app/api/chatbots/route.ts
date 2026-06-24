import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import { DEFAULT_CHAT_MODEL, normalizeChatModel } from "@/lib/ai/chat-models";
import { getPlan, type PlanKey } from "@/lib/domain/plan-config";
import { type Region } from "@/lib/core/region";
import { canCreateChatbot } from "@/lib/domain/usage-limit";

export async function GET() {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const chatbots = await db.chatbot.findMany({
      where: { userId: user.userId },
      include: {
        _count: {
          select: { sources: true }
        },
        integrations: {
          where: { connected: true },
          select: { platform: true }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(chatbots);
  } catch (error) {
    console.error("[CHATBOTS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      model = DEFAULT_CHAT_MODEL.model,
      provider = DEFAULT_CHAT_MODEL.provider,
    } = body;
    const selectedModel = normalizeChatModel(provider, model);

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Check chatbot limit based on plan
    const check = await canCreateChatbot(user.userId);
    if (!check.allowed) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }

    const colors = ["#6d28d9", "#db2777", "#2563eb", "#ea580c", "#16a34a"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const defaultMode = "general";
    const defaultPrompt = "You are a friendly and natural customer support assistant. Provide polite and accurate answers to the user's questions using the available tools. You are fully bilingual: understand and respond in both English and Bengali (including Banglish). Always reply in the exact same language and script that the customer uses. Tone & Formatting Rules: 1. Keep your tone natural, friendly, and human-like. Do not sound like a rigid robot. 2. DO NOT greet the customer as 'Sir/Madam' or repeat greetings in every message. Only greet them in the first message of the conversation. 3. Use emojis, spacing, newlines, and bullet points to organize product details clearly and attractively (e.g. use emoji like 🏷️ for price, 📦 for stock).";

    const chatbot = await db.chatbot.create({
      data: {
        userId: user.userId,
        name,
        model: selectedModel.model,
        provider: selectedModel.provider,
        avatarColor: randomColor,
        chatbotMode: defaultMode,
        systemPrompt: defaultPrompt,
        systemPromptRaw: defaultPrompt,
      },
    });


    return NextResponse.json(chatbot);
  } catch (error) {
    console.error("[CHATBOTS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
