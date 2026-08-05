import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import {
  formatFaqContent,
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

    const faqs = await db.faq.findMany({
      where: { chatbotId: bot.chatbotId },
      orderBy: { createdAt: "desc" },
    });

    // UI expects { id, question, answer, archived }
    const mapped = faqs.map((faq) => ({
      id: faq.faqId,
      question: faq.question,
      answer: faq.answer,
      archived: faq.archived,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("[FAQ_GET]", error);
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

    const faq = await db.faq.create({
      data: {
        chatbotId: bot.chatbotId,
        question: question.trim(),
        answer: answer.trim(),
      },
    });

    // Embed FAQ as a companion Source so it's retrieved at chat time
    const content = formatFaqContent(faq.question, faq.answer);
    const sourceId = await syncTrainingSource({
      chatbotId: bot.chatbotId,
      type: "faq",
      name: faq.question,
      content,
    });

    if (sourceId) {
      await db.faq.update({
        where: { faqId: faq.faqId },
        data: { sourceId },
      });
    }

    return NextResponse.json({
      id: faq.faqId,
      question: faq.question,
      answer: faq.answer,
    });
  } catch (error) {
    console.error("[FAQ_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
