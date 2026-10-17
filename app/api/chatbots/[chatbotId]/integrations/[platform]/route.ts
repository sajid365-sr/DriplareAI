import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { toPublicIntegration } from "@/lib/domain/integration-config";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string, platform: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId, platform } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ownership gate — see [platform]/connect/route.ts for the rationale.
    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const { action } = await req.json(); // "connect" or "disconnect"

    const integration = await db.integration.upsert({
      where: { chatbotId_platform: { chatbotId, platform } },
      update: {
        connected: action === "connect",
        connectedAt: action === "connect" ? new Date() : null,
      },
      create: {
        chatbotId,
        platform,
        connected: action === "connect",
        connectedAt: action === "connect" ? new Date() : null,
      }
    });

    // The update above does not touch `config`, so the row that comes back still
    // holds whatever credentials were stored earlier — they must not be echoed.
    return NextResponse.json(toPublicIntegration(integration));
  } catch (error) {
    console.error("[INTEGRATIONS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
