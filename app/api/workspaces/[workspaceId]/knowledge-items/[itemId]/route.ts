import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { formatFaqContent, formatSampleReplyContent, syncTrainingSource } from "@/lib/ai/qa-training";

export async function PATCH(req: Request, { params }: { params: Promise<{ workspaceId: string; itemId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId, itemId } = await params;
  if (!await db.workspace.findFirst({ where: { workspaceId, userId }, select: { workspaceId: true } })) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  const existing = await db.workspaceKnowledgeItem.findFirst({ where: { id: itemId, workspaceId } });
  if (!existing) return NextResponse.json({ error: "Knowledge item not found" }, { status: 404 });
  try {
    const body = await req.json() as Record<string, unknown>;
    const title = existing.kind === "faq" ? body.question : body.customerMessage;
    const content = existing.kind === "faq" ? body.answer : body.reply;
    if (typeof title !== "string" || !title.trim() || typeof content !== "string" || !content.trim()) return NextResponse.json({ error: "Both fields are required" }, { status: 400 });
    const item = await db.workspaceKnowledgeItem.update({ where: { id: itemId }, data: { title: title.trim(), content: content.trim() } });
    const formatted = item.kind === "faq" ? formatFaqContent(item.title, item.content) : formatSampleReplyContent(item.title, item.content);
    const embedding = await syncTrainingSource({ workspaceId, type: item.kind as "faq" | "sample_reply", name: item.title, entityId: item.id, existingSourceId: item.sourceId, content: formatted });
    const updated = await db.workspaceKnowledgeItem.update({ where: { id: item.id }, data: { sourceId: embedding.sourceId, embeddingStatus: embedding.status } });
    return NextResponse.json(item.kind === "faq"
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
