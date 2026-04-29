import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userToken } = await req.json();

    // Fetch pages using the user's access token
    const response = await fetch(`https://graph.facebook.com/v20.0/me/accounts?access_token=${userToken}`);
    const data = await response.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    // data.data contains the list of pages with id, name, access_token, and category
    // Let's also fetch profile pictures
    const pagesWithPictures = await Promise.all(
      data.data.map(async (page: any) => {
        const picRes = await fetch(`https://graph.facebook.com/v20.0/${page.id}/picture?redirect=0&access_token=${userToken}`);
        const picData = await picRes.json();
        return {
          ...page,
          picture: picData.data || null
        };
      })
    );

    return NextResponse.json({ pages: pagesWithPictures });
  } catch (error) {
    console.error("[FB_PAGES]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
