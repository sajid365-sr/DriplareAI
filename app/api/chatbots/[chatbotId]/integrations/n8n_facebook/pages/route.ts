import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

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

    const { userToken } = await req.json();

    if (!userToken) {
      return NextResponse.json({ error: "Missing userToken" }, { status: 400 });
    }

    // Fetch pages using Facebook Graph API
    const res = await fetch(`https://graph.facebook.com/v20.0/me/accounts?access_token=${userToken}`);
    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    return NextResponse.json({ pages: data.data });
  } catch (error) {
    console.error("[N8N_FB_PAGES]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
