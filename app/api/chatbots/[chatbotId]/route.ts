import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { normalizeChatModel } from "@/lib/chat-models";
import { canCreateChatbot } from "@/lib/usage-limit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const chatbot = await db.chatbot.findUnique({
      where: { chatbotId, userId },
    });

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const normalizedModel = normalizeChatModel(chatbot.provider, chatbot.model);
    return NextResponse.json({
      ...chatbot,
      provider: normalizedModel.provider,
      model: normalizedModel.model,
    });
  } catch (error) {
    console.error("[CHATBOT_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PUT(
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
    const { name, model, provider, temperature, maxTokens, systemPrompt, avatarBase64, status } = body;
    const normalizedModel = normalizeChatModel(provider, model);

    // Status can be updated freely as paused chatbots are already counted towards the limit

    const chatbot = await db.chatbot.update({
      where: { chatbotId, userId },
      data: {
        ...(name && { name }),
        ...((model || provider) && {
          model: normalizedModel.model,
          provider: normalizedModel.provider,
        }),
        ...(temperature !== undefined && { temperature }),
        ...(maxTokens !== undefined && { maxTokens }),
        ...(systemPrompt !== undefined && { systemPrompt }),
        ...(avatarBase64 !== undefined && { avatarBase64 }),
        ...(status !== undefined && { status }),
      },
    });

    return NextResponse.json(chatbot);
  } catch (error) {
    console.error("[CHATBOT_PUT]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.chatbot.delete({
      where: { chatbotId, userId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[CHATBOT_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
