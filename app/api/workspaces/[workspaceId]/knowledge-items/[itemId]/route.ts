import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { formatBusinessAnswerContent, formatFaqContent, formatSampleReplyContent, syncTrainingSource } from "@/lib/ai/qa-training";

export async function PATCH(req: Request, { params }: { params: Promise<{ workspaceId: string; itemId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId, itemId } = await params;
  if (!await db.workspace.findFirst({ where: { workspaceId, userId }, select: { workspaceId: true } })) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  const existing = await db.workspaceKnowledgeItem.findFirst({ where: { id: itemId, workspaceId } });
  if (!existing) return NextResponse.json({ error: "Knowledge item not found" }, { status: 404 });
  try {
    const rawBody: unknown = await req.json();
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const body = rawBody as Record<string, unknown>;
    const isUnifiedAnswer = body.kind === "answer";
    if (isUnifiedAnswer && body.context !== undefined && typeof body.context !== "string") {
      return NextResponse.json({ error: "Question or situation must be text" }, { status: 400 });
    }
    const titleValue = isUnifiedAnswer
      ? body.context ?? ""
      : existing.kind === "faq" ? body.question : body.customerMessage;
    const contentValue = isUnifiedAnswer || existing.kind === "faq" ? body.answer : body.reply;
    if (typeof titleValue !== "string" || (!isUnifiedAnswer && !titleValue.trim()) || typeof contentValue !== "string" || !contentValue.trim()) {
      return NextResponse.json({ error: "An answer is required" }, { status: 400 });
    }
    if (isUnifiedAnswer && (titleValue.length > 2_000 || contentValue.length > 6_000)) {
      return NextResponse.json({ error: "Question or situation must be at most 2,000 characters and answer at most 6,000 characters" }, { status: 400 });
    }
    const title = titleValue.trim();
    const content = contentValue.trim();
    const kind = isUnifiedAnswer ? title ? "faq" : "sample_reply" : existing.kind;
    const item = await db.workspaceKnowledgeItem.update({
      where: { id: itemId },
      data: { kind, title, content },
    });
    const formatted = isUnifiedAnswer
      ? formatBusinessAnswerContent(item.title, item.content)
      : item.kind === "faq" ? formatFaqContent(item.title, item.content) : formatSampleReplyContent(item.title, item.content);
    const embedding = await syncTrainingSource({ workspaceId, type: item.kind as "faq" | "sample_reply", name: item.title, entityId: item.id, existingSourceId: item.sourceId, content: formatted });
    const updated = await db.workspaceKnowledgeItem.update({ where: { id: item.id }, data: { sourceId: embedding.sourceId, embeddingStatus: embedding.status } });
    return NextResponse.json(isUnifiedAnswer
      ? { id: updated.id, kind: updated.kind, context: updated.title, answer: updated.content, archived: updated.archived, embeddingStatus: updated.embeddingStatus }
      : item.kind === "faq"
      ? { id: updated.id, question: updated.title, answer: updated.content, archived: updated.archived, embeddingStatus: updated.embeddingStatus }
      : { id: updated.id, customerMessage: updated.title, reply: updated.content, archived: updated.archived, embeddingStatus: updated.embeddingStatus });
  } catch (error) {
    console.error("[WORKSPACE_KNOWLEDGE_PATCH]", error);
    return NextResponse.json({ error: "Failed to update workspace knowledge" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ workspaceId: string; itemId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId, itemId } = await params;
  if (!await db.workspace.findFirst({ where: { workspaceId, userId }, select: { workspaceId: true } })) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  const item = await db.workspaceKnowledgeItem.findFirst({ where: { id: itemId, workspaceId } });
  if (!item) return NextResponse.json({ error: "Knowledge item not found" }, { status: 404 });
  if (item.sourceId) await db.source.deleteMany({ where: { sourceId: item.sourceId, workspaceId } });
  await db.workspaceKnowledgeItem.delete({ where: { id: item.id } });
  return NextResponse.json({ success: true });
}
