import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/core/db";
import { canAddIntegration } from "@/lib/domain/usage-limit";
import {
  buildWhatsAppIntegrationConfig,
  exchangeWhatsAppEmbeddedSignupCode,
  subscribeWhatsAppBusinessAccount,
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

    const payload = await req.json();
    const code = payload?.code;
    const phoneNumberId = payload?.phoneNumberId || payload?.phone_number_id;
    const wabaId = payload?.wabaId || payload?.waba_id;

    if (!code || !phoneNumberId) {
      return NextResponse.json({ error: "code and phoneNumberId are required" }, { status: 400 });
    }

    const token = await exchangeWhatsAppEmbeddedSignupCode(code);
    const validation = await validateWhatsAppCloudCredentials({
      accessToken: token.access_token,
      phoneNumberId,
      wabaId: wabaId || null,
      tokenType: token.token_type ?? null,
      expiresInSeconds: typeof token.expires_in === "number" ? token.expires_in : null,
    });

    let webhookSubscribed = false;

    if (validation.wabaId) {
      await subscribeWhatsAppBusinessAccount(validation.wabaId, validation.accessToken);
      webhookSubscribed = true;
    }

    const config = buildWhatsAppIntegrationConfig({
      validation,
      connectionSource: "embedded_signup",
      webhookSubscribed,
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
        connectedAt: new Date(),
        status: "active",
        lastError: null,
        config,
      },
      create: {
        chatbotId,
        platform: "whatsapp",
        connected: true,
        connectedAt: new Date(),
        status: "active",
        lastError: null,
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
    console.error("[WHATSAPP_EMBEDDED_CONNECT]", error);

    if (error instanceof WhatsAppGraphApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status || 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Error" },
      { status: 500 }
    );
  }
}
