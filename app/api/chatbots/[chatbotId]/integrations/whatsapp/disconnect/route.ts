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

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.integration.update({
      where: {
        chatbotId_platform: {
          chatbotId,
          platform: "whatsapp",
        },
      },
      data: {
        connected: false,
        status: "active",
        config: {},
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WHATSAPP_DISCONNECT]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
