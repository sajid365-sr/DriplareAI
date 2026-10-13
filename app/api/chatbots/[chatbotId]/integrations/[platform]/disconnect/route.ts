import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { toPublicIntegration } from "@/lib/domain/integration-config";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ chatbotId: string; platform: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId, platform } = await params;
    const canonicalPlatform = platform === "n8n_facebook" ? "facebook" : platform;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ownership gate — see [platform]/connect/route.ts for the rationale.
    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const integration = await db.integration.update({
      where: {
        chatbotId_platform: {
          chatbotId,
          platform: canonicalPlatform,
        },
      },
      data: {
        connected: false,
        connectedAt: null,
        status: "active",
        lastError: null,
        config: {},
      },
    });

    // `config` is emptied above, so nothing sensitive is in the row today — the
    // sanitiser is applied anyway so that "a raw integration row never reaches a
    // response" holds as one rule rather than one rule plus an exception.
    return NextResponse.json(toPublicIntegration(integration));
  } catch (error) {
    console.error("[INTEGRATION_DISCONNECT]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
