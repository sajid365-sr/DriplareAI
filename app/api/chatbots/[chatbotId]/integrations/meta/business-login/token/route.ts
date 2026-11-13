import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { exchangeFacebookBusinessLoginCode, FacebookGraphApiError } from "@/lib/services/facebook";

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

    if (!(await getOwnedChatbot(userId, chatbotId))) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const payload = await req.json();
    const code = typeof payload?.code === "string" ? payload.code : "";
    const redirectUri = typeof payload?.redirectUri === "string" ? payload.redirectUri : "";
    if (!code) {
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }
    if (!redirectUri) {
      return NextResponse.json({ error: "Missing OAuth redirect URI" }, { status: 400 });
    }

    let parsedRedirectUri: URL;
    try {
      parsedRedirectUri = new URL(redirectUri);
    } catch {
      return NextResponse.json({ error: "Invalid OAuth redirect URI" }, { status: 400 });
    }
    const requestOrigin = req.headers.get("origin") || new URL(req.url).origin;
    if (
      parsedRedirectUri.origin !== requestOrigin
      || parsedRedirectUri.pathname !== "/dashboard/platforms"
      || parsedRedirectUri.search
      || parsedRedirectUri.hash
    ) {
      return NextResponse.json({ error: "Invalid OAuth redirect URI" }, { status: 400 });
    }

    const token = await exchangeFacebookBusinessLoginCode(code, redirectUri);
    return NextResponse.json({
      accessToken: token.access_token,
      expiresInSeconds: token.expires_in ?? null,
    });
  } catch (error) {
    console.error("[META_BUSINESS_LOGIN_TOKEN]", error);

    if (error instanceof FacebookGraphApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status || 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Meta login failed" },
      { status: 500 }
    );
  }
}
