import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAndSyncUser } from "@/lib/auth";
import { DEFAULT_CHAT_MODEL, normalizeChatModel } from "@/lib/chat-models";

export async function GET() {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const chatbots = await db.chatbot.findMany({
      where: { userId: user.userId },
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

    const colors = ["#6d28d9", "#db2777", "#2563eb", "#ea580c", "#16a34a"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const chatbot = await db.chatbot.create({
      data: {
        userId: user.userId,
        name,
        model: selectedModel.model,
        provider: selectedModel.provider,
        avatarColor: randomColor,
      },
    });

    return NextResponse.json(chatbot);
  } catch (error) {
    console.error("[CHATBOTS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
