import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

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

    return NextResponse.json(integration);
  } catch (error) {
    console.error("[INTEGRATIONS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
