import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/core/db";
import { FacebookGraphApiError, syncFacebookWebhookSubscriptions } from "@/lib/services/facebook";

const syncWebhookSchema = z.object({
  chatbotId: z.string().min(1),
  pageId: z.string().min(1),
});

type FacebookIntegrationConfig = {
  pageId?: string;
  pageToken?: string;
  pageAccessToken?: string;
};

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = syncWebhookSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { chatbotId, pageId } = parsed.data;

    const integration = await db.integration.findFirst({
      where: {
        chatbotId,
        platform: "facebook",
        chatbot: { userId },
      },
    });

    const config = (integration?.config as FacebookIntegrationConfig | null) ?? null;
    const configuredPageId = config?.pageId;
    const pageAccessToken = config?.pageToken || config?.pageAccessToken;

    if (!integration || configuredPageId !== pageId) {
      return NextResponse.json({ error: "Facebook integration not found" }, { status: 404 });
    }

    if (!pageAccessToken) {
      return NextResponse.json({ error: "Page access token is missing. Please reconnect the page." }, { status: 400 });
    }

    await syncFacebookWebhookSubscriptions(pageId, pageAccessToken);

    return NextResponse.json({
      success: true,
      message: "Page webhooks & message echoes synced successfully!",
    });
  } catch (error) {
    console.error("[FACEBOOK_SYNC_WEBHOOK_POST]", error);

    if (error instanceof FacebookGraphApiError) {
      return NextResponse.json(
        { error: error.message || "Facebook webhook sync failed." },
        { status: error.status || 502 }
      );
    }

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
