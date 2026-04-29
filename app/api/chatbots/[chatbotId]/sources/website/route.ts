import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOwnedChatbot } from "@/lib/chatbot-access";
import { createSourceWithEmbeddings } from "@/lib/source-ingestion";
import * as cheerio from "cheerio";

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

    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Fetch and extract text from website
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    $("script, style, noscript, iframe, img, svg").remove();
    const text = $("body").text();

    if (!text) {
      return NextResponse.json({ error: "No content found on the page" }, { status: 400 });
    }

    const source = await createSourceWithEmbeddings({
      chatbotId,
      type: "website",
      name: url,
      content: text.slice(0, 30000),
    });

    return NextResponse.json(source);
  } catch (error) {
    console.error("[SOURCE_WEBSITE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
