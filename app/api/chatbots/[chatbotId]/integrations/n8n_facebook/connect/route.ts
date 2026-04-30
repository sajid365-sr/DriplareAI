import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;
    const { webhookUrl, pageId, pageToken } = await req.json();

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await db.integration.upsert({
      where: { chatbotId_platform: { chatbotId, platform: "n8n_facebook" } },
      update: {
        connected: true,
        status: "active",
        config: { webhookUrl, pageId, pageToken },
      },
      create: {
        chatbotId,
        platform: "n8n_facebook",
        connected: true,
        status: "active",
        config: { webhookUrl, pageId, pageToken },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
