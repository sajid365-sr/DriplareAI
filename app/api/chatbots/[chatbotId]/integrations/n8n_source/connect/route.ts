import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;
    const { ingestUrl } = await req.json();

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Ownership gate — the URL's chatbotId is untrusted on its own.
    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    await db.integration.upsert({
      where: { chatbotId_platform: { chatbotId, platform: "n8n_source" } },
      update: {
        connected: true,
        status: "active",
        config: { ingestUrl },
      },
      create: {
        chatbotId,
        platform: "n8n_source",
        connected: true,
        status: "active",
        config: { ingestUrl },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
