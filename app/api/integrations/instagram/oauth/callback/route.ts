import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/core/db";
import { canAddIntegration } from "@/lib/domain/usage-limit";
import {
  buildInstagramLoginIntegrationConfig,
  exchangeInstagramLoginCode,
  exchangeInstagramLoginLongLivedToken,
  fetchInstagramLoginProfile,
  InstagramGraphApiError,
} from "@/lib/services/instagram";
import {
  getAppOrigin,
  getInstagramLoginRedirectUri,
  verifyInstagramOAuthState,
} from "@/lib/services/instagram-oauth";

function integrationsUrl(origin: string, chatbotId: string, query: string) {
  return `${origin}/dashboard/chatbots/${chatbotId}/integrations${query}`;
}

export async function GET(req: Request) {
  const origin = getAppOrigin(req);
  const { searchParams } = new URL(req.url);
  const oauthError = searchParams.get("error");
  const oauthErrorDescription = searchParams.get("error_description");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (oauthError) {
    const message = oauthErrorDescription || oauthError;
    return NextResponse.redirect(`${origin}/dashboard/chatbots?instagram_error=${encodeURIComponent(message)}`);
  }

  const parsedState = verifyInstagramOAuthState(state);
  if (!parsedState) {
    return NextResponse.redirect(
      `${origin}/dashboard/chatbots?instagram_error=${encodeURIComponent("Invalid or expired Instagram login session.")}`
    );
  }

  const { chatbotId, userId: stateUserId } = parsedState;

  try {
    const { userId } = await auth();
    if (!userId || userId !== stateUserId) {
      const returnUrl = encodeURIComponent(integrationsUrl(origin, chatbotId, ""));
      return NextResponse.redirect(`${origin}/sign-in?redirect_url=${returnUrl}`);
    }

    if (!code) {
      return NextResponse.redirect(
        integrationsUrl(origin, chatbotId, `?instagram_error=${encodeURIComponent("Instagram did not return an authorization code.")}`)
      );
    }

    const chatbot = await db.chatbot.findFirst({
      where: { chatbotId, userId },
      select: { chatbotId: true },
    });

    if (!chatbot) {
      return NextResponse.redirect(
        integrationsUrl(origin, chatbotId, `?instagram_error=${encodeURIComponent("Chatbot not found.")}`)
      );
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
        return NextResponse.redirect(
          integrationsUrl(origin, chatbotId, `?instagram_error=${encodeURIComponent(check.error || "Plan limit reached.")}`)
        );
      }
    }

    const redirectUri = getInstagramLoginRedirectUri(req);
    const { shortLivedToken } = await exchangeInstagramLoginCode(code, redirectUri);
    const longLivedToken = await exchangeInstagramLoginLongLivedToken(shortLivedToken);
    const profile = await fetchInstagramLoginProfile(longLivedToken.accessToken);

    const config = buildInstagramLoginIntegrationConfig({
      profile,
      longLivedToken,
    });

    await db.integration.upsert({
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

    return NextResponse.redirect(integrationsUrl(origin, chatbotId, "?instagram=connected"));
  } catch (error) {
    console.error("[INSTAGRAM_OAUTH_CALLBACK]", error);
    const message =
      error instanceof InstagramGraphApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Instagram connection failed";

    return NextResponse.redirect(
      integrationsUrl(origin, chatbotId, `?instagram_error=${encodeURIComponent(message)}`)
    );
  }
}
