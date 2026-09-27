import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import {
  formatSampleReplyContent,
  syncTrainingSource,
} from "@/lib/ai/qa-training";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    void req;
    const { userId } = await auth();
    const { chatbotId: identifier } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, identifier);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const replies = await db.sampleReply.findMany({
      where: { chatbotId: bot.chatbotId },
      orderBy: { createdAt: "desc" },
    });

    // UI expects { id, customerMessage, reply, archived }
    const mapped = replies.map((reply) => ({
      id: reply.sampleReplyId,
      customerMessage: reply.customerMessage,
      reply: reply.reply,
      archived: reply.archived,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("[SAMPLE_REPLY_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId: identifier } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { customerMessage, reply } = await req.json();

    if (!customerMessage?.trim() || !reply?.trim()) {
      return NextResponse.json(
        { error: "Customer message and reply are required" },
        { status: 400 }
      );
    }

    const bot = await getOwnedChatbot(userId, identifier);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const sampleReply = await db.sampleReply.create({
      data: {
        chatbotId: bot.chatbotId,
        customerMessage: customerMessage.trim(),
        reply: reply.trim(),
      },
    });

    // Embed as a companion Source so it's retrieved at chat time.
    // Always persist embeddingStatus so a failed embed is flagged, never silently dropped.
    const content = formatSampleReplyContent(
      sampleReply.customerMessage,
      sampleReply.reply
    );
    const { sourceId, status } = await syncTrainingSource({
      chatbotId: bot.chatbotId,
      type: "sample_reply",
      name: sampleReply.customerMessage,
      entityId: sampleReply.sampleReplyId,
      content,
    });

    await db.sampleReply.update({
      where: { sampleReplyId: sampleReply.sampleReplyId },
      data: { sourceId, embeddingStatus: status },
    });

    return NextResponse.json({
      id: sampleReply.sampleReplyId,
      customerMessage: sampleReply.customerMessage,
      reply: sampleReply.reply,
      embeddingStatus: status,
      ...(status === "failed"
        ? { warning: "Reply saved, but embedding failed — it is not searchable yet. Edit and save again to retry." }
        : {}),
    });
  } catch (error) {
    console.error("[SAMPLE_REPLY_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
