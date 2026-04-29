import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOwnedChatbot } from "@/lib/chatbot-access";
import { createSourceWithEmbeddings } from "@/lib/source-ingestion";

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

    const { name, content } = await req.json();
    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const source = await createSourceWithEmbeddings({
      chatbotId,
      type: "text",
      name: name || "Text Input",
      content,
    });

    return NextResponse.json(source);
  } catch (error) {
    console.error("[SOURCE_TEXT]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
