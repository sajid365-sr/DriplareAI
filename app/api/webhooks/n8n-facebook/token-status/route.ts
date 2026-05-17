import { NextResponse } from "next/server";

import { db } from "@/lib/core/db";

type TokenStatusPayload = {
  pageId?: string;
  errorMessage?: string;
  errorCode?: number;
  errorSubcode?: number;
  secret?: string;
};

function buildIntegrationErrorMessage(payload: TokenStatusPayload) {
  const rawMessage = payload.errorMessage?.trim();

  if (payload.errorCode === 190 || payload.errorSubcode === 463 || payload.errorSubcode === 467) {
    return rawMessage || "Facebook token expired or became invalid.";
  }

  return rawMessage || "Facebook Messenger runtime error reported by n8n.";
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

    if (!payload.pageId) {
      return NextResponse.json({ error: "pageId is required" }, { status: 400 });
    }

    const integration = await db.integration.findFirst({
      where: {
        platform: "facebook",
        config: {
          path: ["pageId"],
          equals: payload.pageId,
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
      return NextResponse.json({ error: "Facebook integration not found." }, { status: 404 });
    }

    const lastError = buildIntegrationErrorMessage(payload);

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
        title: "Facebook Messenger reconnection required",
        message: `The Facebook Messenger integration for "${integration.chatbot.name}" stopped because the saved page token expired or became invalid. Please reconnect the page from the dashboard.`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[N8N_FB_TOKEN_STATUS]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
