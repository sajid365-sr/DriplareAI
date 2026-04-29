import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOwnedChatbot } from "@/lib/chatbot-access";
import { updateSourceWithEmbeddings } from "@/lib/source-ingestion";
import * as cheerio from "cheerio";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; sourceId: string }> }
) {
  try {
    void req;
    const { userId } = await auth();
    const { chatbotId, sourceId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const source = await db.source.findFirst({
      where: {
        chatbotId,
        sourceId,
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    await db.source.delete({
      where: {
        sourceId,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[SOURCE_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; sourceId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId, sourceId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { content, url } = await req.json();

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const source = await db.source.findFirst({
      where: { chatbotId, sourceId },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    let finalContent = content;
    let finalName = source.name;

    if (source.type === "website" && url) {
      // Re-crawl if URL is provided
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);
      $("script, style, noscript, iframe, img, svg").remove();
      finalContent = $("body").text().slice(0, 30000);
      finalName = url;
    }

    if (!finalContent) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const updatedSource = await updateSourceWithEmbeddings(
      sourceId,
      chatbotId,
      finalContent,
      finalName
    );

    return NextResponse.json(updatedSource);
  } catch (error) {
    console.error("[SOURCE_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

