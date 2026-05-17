import { NextResponse } from "next/server";

import { db } from "@/lib/core/db";

type TokenStatusPayload = {
  phoneNumberId?: string;
  errorMessage?: string;
  errorCode?: number;
  errorSubcode?: number;
  secret?: string;
};

function buildWhatsAppErrorMessage(payload: TokenStatusPayload) {
  const rawMessage = payload.errorMessage?.trim();

  if (payload.errorCode === 190 || payload.errorCode === 10 || payload.errorCode === 200) {
    return rawMessage || "WhatsApp connection needs to be refreshed.";
  }

  return rawMessage || "WhatsApp runtime error reported by n8n.";
}

export async function POST(req: Request) {
  try {
    const expectedSecret = process.env.N8N_CALLBACK_SECRET;

    if (!expectedSecret) {
      return NextResponse.json({ error: "N8N callback secret is not configured." }, { status: 500 });
    }

    const payload = (await req.json()) as TokenStatusPayload;

    if (payload.secret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!payload.phoneNumberId) {
      return NextResponse.json({ error: "phoneNumberId is required" }, { status: 400 });
    }

    const integration = await db.integration.findFirst({
      where: {
        platform: "whatsapp",
        config: {
          path: ["phoneNumberId"],
          equals: payload.phoneNumberId,
        },
      },
      include: {
        chatbot: {
          select: {
            name: true,
            userId: true,
          },
        },
      },
    });

    if (!integration) {
      return NextResponse.json({ error: "WhatsApp integration not found." }, { status: 404 });
    }

    const lastError = buildWhatsAppErrorMessage(payload);

    await db.integration.update({
      where: {
        id: integration.id,
      },
      data: {
        connected: false,
        status: "error",
        lastError,
      },
    });

    await db.notification.create({
      data: {
        userId: integration.chatbot.userId,
        type: "system",
        title: "WhatsApp reconnection required",
        message: `The WhatsApp integration for "${integration.chatbot.name}" stopped working. Please reconnect it from the dashboard.`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[N8N_WHATSAPP_TOKEN_STATUS]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
