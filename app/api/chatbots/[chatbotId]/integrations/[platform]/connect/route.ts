import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; platform: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId, platform } = await params;
    const body = await req.json();
    const { config } = body;

    /*
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    */

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
