import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import {
  formatFaqContent,
  syncTrainingSource,
  deleteTrainingSource,
} from "@/lib/ai/qa-training";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; faqId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId: identifier, faqId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { question, answer } = await req.json();

    if (!question?.trim() || !answer?.trim()) {
      return NextResponse.json(
        { error: "Question and answer are required" },
        { status: 400 }
      );
    }

    const bot = await getOwnedChatbot(userId, identifier);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const faq = await db.faq.findFirst({
      where: { chatbotId: bot.chatbotId, faqId },
    });

    if (!faq) {
      return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    }

    const updated = await db.faq.update({
      where: { faqId },
      data: {
        question: question.trim(),
        answer: answer.trim(),
      },
    });

    // Re-embed the updated FAQ. Persist embeddingStatus so a failed re-embed is flagged.
    const content = formatFaqContent(updated.question, updated.answer);
    const { sourceId, status } = await syncTrainingSource({
      chatbotId: bot.chatbotId,
      existingSourceId: updated.sourceId,
      type: "faq",
      name: updated.question,
      entityId: updated.faqId,
      content,
    });

    await db.faq.update({
      where: { faqId },
      data: { sourceId, embeddingStatus: status },
    });

    return NextResponse.json({
      id: updated.faqId,
      question: updated.question,
      answer: updated.answer,
      embeddingStatus: status,
      ...(status === "failed"
        ? { warning: "FAQ updated, but embedding failed — it is not searchable yet. Save again to retry." }
        : {}),
    });
  } catch (error) {
    console.error("[FAQ_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; faqId: string }> }
) {
  try {
    void req;
    const { userId } = await auth();
    const { chatbotId: identifier, faqId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, identifier);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const faq = await db.faq.findFirst({
      where: { chatbotId: bot.chatbotId, faqId },
    });

    if (!faq) {
      return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    }

    // Delete companion Source (chunks cascade)
    await deleteTrainingSource(faq.sourceId);

    await db.faq.delete({
      where: { faqId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[FAQ_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
