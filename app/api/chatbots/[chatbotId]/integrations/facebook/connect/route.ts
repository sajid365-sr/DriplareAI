import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/core/db";
import {
  buildFacebookIntegrationConfig,
  exchangeForLongLivedFacebookUserToken,
  FacebookGraphApiError,
  fetchFacebookPagesWithUserToken,
  subscribeFacebookPageToApp,
} from "@/lib/services/facebook";
import { canAddIntegration } from "@/lib/domain/usage-limit";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { toPublicIntegration } from "@/lib/domain/integration-config";

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

    // Ownership gate must run before the limit check: canAddIntegration counts
    // integrations on the URL's chatbotId, which is not scoped to this user.
    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const check = await canAddIntegration(userId, "facebook", chatbotId);
    if (!check.allowed) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }

    const payload = await req.json();
    const pageId = payload?.pageId ?? payload?.config?.pageId;
    const userToken = payload?.userToken ?? payload?.config?.userToken;

    if (!pageId || !userToken) {
      return NextResponse.json({ error: "pageId and userToken are required" }, { status: 400 });
    }

    const longLivedToken = await exchangeForLongLivedFacebookUserToken(userToken);
    const pages = await fetchFacebookPagesWithUserToken(longLivedToken.accessToken);
    const selectedPage = pages.find((page) => page.id === pageId);

    if (!selectedPage) {
      return NextResponse.json({ error: "Selected Facebook page was not found." }, { status: 404 });
    }

    await subscribeFacebookPageToApp(selectedPage.id, selectedPage.accessToken);

    const config = buildFacebookIntegrationConfig({
      selectedPage,
      longLivedUserToken: longLivedToken,
    });

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
        config,
      },
      create: {
        chatbotId,
        platform: "facebook",
        connected: true,
        connectedAt: new Date(),
        status: "active",
        lastError: null,
        config,
      },
    });

    // `config` here contains the freshly minted Page token and the long-lived
    // user token. The client only needs to know the connect succeeded.
    return NextResponse.json(toPublicIntegration(integration));
  } catch (error) {
    console.error("[FB_CONNECT]", error);

    if (error instanceof FacebookGraphApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status || 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Error" },
      { status: 500 }
    );
  }
}
