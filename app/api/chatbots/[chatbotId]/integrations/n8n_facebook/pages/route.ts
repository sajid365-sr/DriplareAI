import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { exchangeForLongLivedFacebookUserToken, FacebookGraphApiError, fetchFacebookPagesWithUserToken } from "@/lib/services/facebook";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userToken } = await req.json();

    if (!userToken) {
      return NextResponse.json({ error: "Missing userToken" }, { status: 400 });
    }

    const longLivedToken = await exchangeForLongLivedFacebookUserToken(userToken);
    const pages = await fetchFacebookPagesWithUserToken(longLivedToken.accessToken);

    return NextResponse.json({ pages });
  } catch (error) {
    console.error("[N8N_FB_PAGES]", error);

    if (error instanceof FacebookGraphApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status || 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Error" },
      { status: 500 }
    );
  }
}
