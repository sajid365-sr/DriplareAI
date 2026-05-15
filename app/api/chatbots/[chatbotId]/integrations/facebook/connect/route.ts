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
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    

    // Check integration limit and platform
    const check = await canAddIntegration(userId, "facebook", chatbotId);
    if (!check.allowed) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }

    const { pageId, pageToken, pageName } = await req.json();

    // Subscribe app to page webhooks
    const subscribeRes = await fetch(`https://graph.facebook.com/v20.0/${pageId}/subscribed_apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscribed_fields: ['messages', 'messaging_postbacks'],
        access_token: pageToken
      })
    });
    const subscribeData = await subscribeRes.json();
    
    if (subscribeData.error) {
      console.error("[FB_WEBHOOK_SUB_ERROR]", subscribeData.error);
      return NextResponse.json({ error: subscribeData.error.message }, { status: 400 });
    }

    const integration = await db.integration.upsert({
      where: {
        chatbotId_platform: {
          chatbotId,
          platform: "facebook",
        },
      },
      update: {
        connected: true,
        connectedAt: new Date(),
        status: "active",
        lastError: null,
        config: { pageId, pageToken, pageName },
      },
      create: {
        chatbotId,
        platform: "facebook",
        connected: true,
        connectedAt: new Date(),
        status: "active",
        config: { pageId, pageToken, pageName },
      },
    });

    return NextResponse.json(integration);
  } catch (error) {
    console.error("[FB_CONNECT]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
