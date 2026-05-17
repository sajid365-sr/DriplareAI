import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;
    const { ingestUrl } = await req.json();

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
