import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; platform: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId, platform } = await params;
    const body = await req.json();
    const { config } = body;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ownership gate. The URL carries only a chatbotId, so without this a
    // signed-in user could write an integration config — tokens included —
    // onto another merchant's chatbot.
    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const integration = await db.integration.upsert({
      where: {
        chatbotId_platform: {
          chatbotId,
          platform,
        },
      },
      update: {
        connected: true,
        config,
      },
      create: {
        chatbotId,
        platform,
        connected: true,
        config,
      },
    });

    return NextResponse.json(integration);
  } catch (error) {
    console.error("[INTEGRATION_CONNECT]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
