import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import {
  formatSampleReplyContent,
  syncTrainingSource,
  deleteTrainingSource,
} from "@/lib/ai/qa-training";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; replyId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId: identifier, replyId } = await params;

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

    const sampleReply = await db.sampleReply.findFirst({
      where: { chatbotId: bot.chatbotId, sampleReplyId: replyId },
    });

    if (!sampleReply) {
      return NextResponse.json({ error: "Sample reply not found" }, { status: 404 });
    }

    const updated = await db.sampleReply.update({
      where: { sampleReplyId: replyId },
      data: {
        customerMessage: customerMessage.trim(),
        reply: reply.trim(),
      },
    });

    // Re-embed the updated sample reply
    const content = formatSampleReplyContent(updated.customerMessage, updated.reply);
    const sourceId = await syncTrainingSource({
      chatbotId: bot.chatbotId,
      existingSourceId: updated.sourceId,
      type: "sample_reply",
      name: updated.customerMessage,
      content,
    });

    if (sourceId && sourceId !== updated.sourceId) {
      await db.sampleReply.update({
        where: { sampleReplyId: replyId },
        data: { sourceId },
      });
    }

    return NextResponse.json({
      id: updated.sampleReplyId,
      customerMessage: updated.customerMessage,
      reply: updated.reply,
    });
  } catch (error) {
    console.error("[SAMPLE_REPLY_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; replyId: string }> }
) {
  try {
    void req;
    const { userId } = await auth();
    const { chatbotId: identifier, replyId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, identifier);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const sampleReply = await db.sampleReply.findFirst({
      where: { chatbotId: bot.chatbotId, sampleReplyId: replyId },
    });

    if (!sampleReply) {
      return NextResponse.json({ error: "Sample reply not found" }, { status: 404 });
    }

    // Delete companion Source (chunks cascade)
    await deleteTrainingSource(sampleReply.sourceId);

    await db.sampleReply.delete({
      where: { sampleReplyId: replyId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[SAMPLE_REPLY_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
