import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { canAddIntegration } from "@/lib/usage-limit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;
    const { accessToken, phoneNumberId, wabaId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check integration limit and platform
    const check = await canAddIntegration(userId, "whatsapp");
    if (!check.allowed) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }

    if (!accessToken || !phoneNumberId || !wabaId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Update or create integration
    await db.integration.upsert({
      where: {
        chatbotId_platform: {
          chatbotId,
          platform: "whatsapp",
        },
      },
      update: {
        connected: true,
        status: "active",
        config: {
          accessToken,
          phoneNumberId,
          wabaId,
        },
      },
      create: {
        chatbotId,
        platform: "whatsapp",
        connected: true,
        status: "active",
        config: {
          accessToken,
          phoneNumberId,
          wabaId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WHATSAPP_CONNECT]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
