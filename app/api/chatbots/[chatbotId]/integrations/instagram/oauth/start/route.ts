import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/core/db";
import { buildInstagramLoginAuthorizeUrl } from "@/lib/services/instagram";
import {
  getAppOrigin,
  getInstagramLoginRedirectUri,
  signInstagramOAuthState,
} from "@/lib/services/instagram-oauth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params;
  try {
    const { userId } = await auth();

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

    const appId =
      process.env.INSTAGRAM_APP_ID
      || process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID
      || process.env.NEXT_PUBLIC_META_APP_ID
      || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    if (!appId) {
      throw new Error("Meta App ID is not configured for Instagram Login.");
    }

    const redirectUri = getInstagramLoginRedirectUri(req);
    const state = signInstagramOAuthState({ chatbotId, userId });
    const authorizeUrl = buildInstagramLoginAuthorizeUrl({ appId, redirectUri, state });

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    console.error("[INSTAGRAM_OAUTH_START]", error);
    const origin = getAppOrigin(req);
    const message = error instanceof Error ? error.message : "Instagram OAuth failed";
    const query = new URLSearchParams({
      botId: chatbotId,
      instagram_error: message,
    });
    return NextResponse.redirect(
      `${origin}/dashboard/platforms?${query.toString()}`
    );
  }
}
