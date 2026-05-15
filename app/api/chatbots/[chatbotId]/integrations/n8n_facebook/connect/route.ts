import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/**
 * n8n Facebook Connect
 * 
 * Same flow as regular Facebook connect:
 * - User logs in via Facebook SDK
 * - Selects page
 * - pageId, pageToken, pageName saved here
 * 
 * The n8n webhook URL is stored server-side in .env (N8N_WEBHOOK_URL)
 * — users never need to enter it manually.
 */
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

    const payload = await req.json();
    const pageId = payload?.pageId ?? payload?.config?.pageId;
    const pageToken = payload?.pageToken ?? payload?.accessToken ?? payload?.config?.pageToken ?? payload?.config?.accessToken;
    const pageName = payload?.pageName ?? payload?.config?.pageName;

    if (!pageId || !pageToken) {
      return NextResponse.json({ error: "pageId and pageToken are required" }, { status: 400 });
    }

    // Subscribe the page to webhook events (same as regular FB)
    const subscribeRes = await fetch(
      `https://graph.facebook.com/v20.0/${pageId}/subscribed_apps`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscribed_fields: ["messages", "messaging_postbacks"],
          access_token: pageToken,
        }),
      }
    );
    const subscribeData = await subscribeRes.json();

    if (subscribeData.error) {
      console.error("[N8N_FB_CONNECT] Webhook subscribe error:", subscribeData.error);
      return NextResponse.json(
        { error: subscribeData.error.message },
        { status: 400 }
      );
    }

    // Save to DB — n8n webhook URL comes from server .env, not from user
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || "";

    const integration = await db.integration.upsert({
      where: {
        chatbotId_platform: {
          chatbotId,
          platform: "n8n_facebook",
        },
      },
      update: {
        connected: true,
        connectedAt: new Date(),
        status: "active",
        lastError: null,
        config: { pageId, pageToken, pageName, n8nWebhookUrl },
      },
      create: {
        chatbotId,
        platform: "n8n_facebook",
        connected: true,
        connectedAt: new Date(),
        status: "active",
        config: { pageId, pageToken, pageName, n8nWebhookUrl },
      },
    });

    return NextResponse.json(integration);
  } catch (error) {
    console.error("[N8N_FB_CONNECT]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
