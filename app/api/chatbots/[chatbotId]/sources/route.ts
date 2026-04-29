import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { getOwnedChatbot } from "@/lib/chatbot-access";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const sources = await db.source.findMany({
      where: { chatbotId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(sources);
  } catch (error) {
    console.error("[SOURCES_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
