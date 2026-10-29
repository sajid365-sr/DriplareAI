import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { createSourceWithEmbeddings } from "@/lib/ai/source-ingestion";
import { formatFaqContent, formatSampleReplyContent, syncTrainingSource } from "@/lib/ai/qa-training";

type ApplyBody = {
  faqs?: Array<{ question: string; answer: string }>;
  sampleReplies?: Array<{ customerMessage: string; reply: string }>;
  content?: Array<{ title: string; content: string }>;
};

export async function POST(req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  if (!await db.workspace.findFirst({ where: { workspaceId, userId }, select: { workspaceId: true } })) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  try {
    const body = await req.json() as ApplyBody;
    const added = { faqs: 0, sampleReplies: 0, content: 0 };
    for (const faq of (body.faqs ?? []).filter((item) => item?.question?.trim() && item?.answer?.trim())) {
      try {
        const item = await db.workspaceKnowledgeItem.create({ data: { workspaceId, kind: "faq", title: faq.question.trim(), content: faq.answer.trim() } });
        const embedding = await syncTrainingSource({ workspaceId, type: "faq", name: item.title, entityId: item.id, content: formatFaqContent(item.title, item.content) });
        await db.workspaceKnowledgeItem.update({ where: { id: item.id }, data: { sourceId: embedding.sourceId, embeddingStatus: embedding.status } });
        added.faqs++;
      } catch (error) { console.error("[WORKSPACE_AUTO_TRAIN_FAQ]", error); }
    }
    for (const reply of (body.sampleReplies ?? []).filter((item) => item?.customerMessage?.trim() && item?.reply?.trim())) {
      try {
        const item = await db.workspaceKnowledgeItem.create({ data: { workspaceId, kind: "sample_reply", title: reply.customerMessage.trim(), content: reply.reply.trim() } });
        const embedding = await syncTrainingSource({ workspaceId, type: "sample_reply", name: item.title, entityId: item.id, content: formatSampleReplyContent(item.title, item.content) });
        await db.workspaceKnowledgeItem.update({ where: { id: item.id }, data: { sourceId: embedding.sourceId, embeddingStatus: embedding.status } });
        added.sampleReplies++;
      } catch (error) { console.error("[WORKSPACE_AUTO_TRAIN_SAMPLE]", error); }
    }
    for (const source of (body.content ?? []).filter((item) => item?.title?.trim() && item?.content?.trim())) {
      try {
        await createSourceWithEmbeddings({ workspaceId, isGlobal: true, type: "text", name: source.title.trim().slice(0, 200), content: source.content.trim() });
        added.content++;
      } catch (error) { console.error("[WORKSPACE_AUTO_TRAIN_CONTENT]", error); }
    }
    return NextResponse.json({ added });
  } catch (error) {
    console.error("[WORKSPACE_AUTO_TRAIN_APPLY]", error);
    return NextResponse.json({ error: "Failed to apply workspace training" }, { status: 500 });
  }
}
