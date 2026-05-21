import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/core/db";
import { canAddIntegration } from "@/lib/domain/usage-limit";
import {
  buildInstagramIntegrationConfig,
  exchangeForLongLivedInstagramUserToken,
  fetchInstagramAccountsWithUserToken,
  InstagramGraphApiError,
  subscribeInstagramPageToApp,
} from "@/lib/services/instagram";

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
      where: { chatbotId, userId },
      select: { chatbotId: true },
    });

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const existingIntegration = await db.integration.findUnique({
      where: {
        chatbotId_platform: {
          chatbotId,
          platform: "instagram",
        },
      },
      select: { id: true },
    });

    if (!existingIntegration) {
      const check = await canAddIntegration(userId, "instagram", chatbotId);
      if (!check.allowed) {
        return NextResponse.json({ error: check.error }, { status: 403 });
      }
    }

    const payload = await req.json();
    const accountId = payload?.accountId ?? payload?.instagramAccountId;
    const userToken = payload?.userToken;

    if (!accountId || !userToken) {
      return NextResponse.json({ error: "accountId and userToken are required" }, { status: 400 });
    }

    const longLivedToken = await exchangeForLongLivedInstagramUserToken(userToken);
    const accounts = await fetchInstagramAccountsWithUserToken(longLivedToken.accessToken);
    const selectedAccount = accounts.find((account) => account.id === accountId);

    if (!selectedAccount) {
      return NextResponse.json({ error: "Selected Instagram account was not found." }, { status: 404 });
    }

    // Subscribe the linked Facebook Page to the app for Instagram webhooks
    await subscribeInstagramPageToApp(selectedAccount.pageId, selectedAccount.pageAccessToken);

    const config = buildInstagramIntegrationConfig({
      selectedAccount,
      longLivedUserToken: longLivedToken,
    });

    const integration = await db.integration.upsert({
      where: {
        chatbotId_platform: {
          chatbotId,
          platform: "instagram",
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
        platform: "instagram",
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
    console.error("[INSTAGRAM_CONNECT]", error);

    if (error instanceof InstagramGraphApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status || 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Error" },
      { status: 500 }
    );
  }
}
