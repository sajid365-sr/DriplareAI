import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import {
  formatFaqContent,
  formatSampleReplyContent,
  syncTrainingSource,
} from "@/lib/ai/qa-training";
import { createSourceWithEmbeddings } from "@/lib/ai/source-ingestion";

type ApplyBody = {
  faqs?: Array<{ question: string; answer: string }>;
  sampleReplies?: Array<{ customerMessage: string; reply: string }>;
  content?: Array<{ title: string; content: string }>;
};

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

    const bot = await getOwnedChatbot(userId, identifier);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }
    const chatbotId = bot.chatbotId;

    const body = (await req.json()) as ApplyBody;
    const faqs = (body.faqs || []).filter((f) => f?.question?.trim() && f?.answer?.trim());
    const sampleReplies = (body.sampleReplies || []).filter(
      (s) => s?.customerMessage?.trim() && s?.reply?.trim()
    );
    const content = (body.content || []).filter((c) => c?.title?.trim() && c?.content?.trim());

    const added = { faqs: 0, sampleReplies: 0, content: 0 };

    // FAQs — mirror the /faqs POST route so they embed + surface in the FAQ tab
    for (const item of faqs) {
      try {
        const faq = await db.faq.create({
          data: {
            chatbotId,
            question: item.question.trim(),
            answer: item.answer.trim(),
          },
        });
        const { sourceId, status } = await syncTrainingSource({
          chatbotId,
          type: "faq",
          name: faq.question,
          entityId: faq.faqId,
          content: formatFaqContent(faq.question, faq.answer),
        });
        await db.faq.update({
          where: { faqId: faq.faqId },
          data: { sourceId, embeddingStatus: status },
        });
        added.faqs++;
      } catch (err) {
        console.error("[AUTO_TRAIN_APPLY_FAQ]", err);
      }
    }

    // Sample replies — mirror the /sample-replies POST route
    for (const item of sampleReplies) {
      try {
        const reply = await db.sampleReply.create({
          data: {
            chatbotId,
            customerMessage: item.customerMessage.trim(),
            reply: item.reply.trim(),
          },
        });
        const { sourceId, status } = await syncTrainingSource({
          chatbotId,
          type: "sample_reply",
          name: reply.customerMessage,
          entityId: reply.sampleReplyId,
          content: formatSampleReplyContent(reply.customerMessage, reply.reply),
        });
        await db.sampleReply.update({
          where: { sampleReplyId: reply.sampleReplyId },
          data: { sourceId, embeddingStatus: status },
        });
        added.sampleReplies++;
      } catch (err) {
        console.error("[AUTO_TRAIN_APPLY_SAMPLE]", err);
      }
    }

    // Content — create a text Source with embeddings (shows in Content Training tab)
    for (const item of content) {
      try {
        await createSourceWithEmbeddings({
          chatbotId,
          type: "text",
          name: item.title.trim().slice(0, 200),
          content: item.content.trim(),
        });
        added.content++;
      } catch (err) {
        console.error("[AUTO_TRAIN_APPLY_CONTENT]", err);
      }
    }

    return NextResponse.json({ added });
  } catch (error) {
    console.error("[AUTO_TRAIN_APPLY_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
