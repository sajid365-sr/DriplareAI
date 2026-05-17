import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/core/db";
import { canAddIntegration } from "@/lib/domain/usage-limit";
import {
  buildWhatsAppIntegrationConfig,
  validateWhatsAppCloudCredentials,
  WhatsAppGraphApiError,
} from "@/lib/services/whatsapp";

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

    const chatbot = await db.chatbot.findFirst({
      where: {
        chatbotId,
        userId,
      },
      select: {
        chatbotId: true,
      },
    });

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const existingIntegration = await db.integration.findUnique({
      where: {
        chatbotId_platform: {
          chatbotId,
          platform: "whatsapp",
        },
      },
      select: {
        id: true,
      },
    });

    if (!existingIntegration) {
      const check = await canAddIntegration(userId, "whatsapp", chatbotId);
      if (!check.allowed) {
        return NextResponse.json({ error: check.error }, { status: 403 });
      }
    }

    if (!accessToken || !phoneNumberId) {
      return NextResponse.json({ error: "accessToken and phoneNumberId are required" }, { status: 400 });
    }

    const validation = await validateWhatsAppCloudCredentials({
      accessToken,
      phoneNumberId,
      wabaId: wabaId || null,
    });
    const config = buildWhatsAppIntegrationConfig({
      validation,
      connectionSource: "manual_cloud_api",
    });

    const integration = await db.integration.upsert({
      where: {
        chatbotId_platform: {
          chatbotId,
          platform: "whatsapp",
        },
      },
      update: {
        connected: true,
        status: "active",
        lastError: null,
        connectedAt: new Date(),
        config,
      },
      create: {
        chatbotId,
        platform: "whatsapp",
        connected: true,
        status: "active",
        lastError: null,
        connectedAt: new Date(),
        config,
      },
    });

    return NextResponse.json({
      success: true,
      integration: {
        id: integration.id,
        platform: integration.platform,
        connected: integration.connected,
        status: integration.status,
      },
    });
  } catch (error) {
    console.error("[WHATSAPP_CONNECT]", error);

    if (error instanceof WhatsAppGraphApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status || 400 });
    }

    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
