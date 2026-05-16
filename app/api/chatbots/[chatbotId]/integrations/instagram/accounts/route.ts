import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import {
  exchangeForLongLivedInstagramUserToken,
  fetchInstagramAccountsWithUserToken,
  InstagramGraphApiError,
} from "@/lib/instagram";

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

    const longLivedToken = await exchangeForLongLivedInstagramUserToken(userToken);
    const accounts = await fetchInstagramAccountsWithUserToken(longLivedToken.accessToken);

    return NextResponse.json({
      accounts: accounts.map((account) => ({
        id: account.id,
        username: account.username,
        name: account.name,
        profilePictureUrl: account.profilePictureUrl,
        pageId: account.pageId,
        pageName: account.pageName,
      })),
    });
  } catch (error) {
    console.error("[INSTAGRAM_ACCOUNTS]", error);

    if (error instanceof InstagramGraphApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status || 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Error" },
      { status: 500 }
    );
  }
}
