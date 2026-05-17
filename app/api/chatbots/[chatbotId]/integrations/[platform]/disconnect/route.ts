import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";

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

    return NextResponse.json(integration);
  } catch (error) {
    console.error("[INTEGRATION_DISCONNECT]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
