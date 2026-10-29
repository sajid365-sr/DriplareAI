import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { formatFaqContent, formatSampleReplyContent, syncTrainingSource } from "@/lib/ai/qa-training";

type KnowledgeKind = "faq" | "sample_reply";
const isKnowledgeKind = (value: string | null): value is KnowledgeKind => value === "faq" || value === "sample_reply";

function toClientItem(item: { id: string; kind: string; title: string; content: string; archived: boolean; embeddingStatus: string }) {
  return item.kind === "faq"
    ? { id: item.id, question: item.title, answer: item.content, archived: item.archived, embeddingStatus: item.embeddingStatus }
    : { id: item.id, customerMessage: item.title, reply: item.content, archived: item.archived, embeddingStatus: item.embeddingStatus };
}

async function getOwnedWorkspace(userId: string, workspaceId: string) {
  return db.workspace.findFirst({ where: { workspaceId, userId }, select: { workspaceId: true } });
}

export async function GET(req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  if (!await getOwnedWorkspace(userId, workspaceId)) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  const kind = new URL(req.url).searchParams.get("kind");
  if (!isKnowledgeKind(kind)) return NextResponse.json({ error: "Invalid knowledge kind" }, { status: 400 });
  const items = await db.workspaceKnowledgeItem.findMany({ where: { workspaceId, kind }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(items.map(toClientItem));
}

export async function POST(req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  if (!await getOwnedWorkspace(userId, workspaceId)) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    const body = await req.json() as Record<string, unknown>;
    const kind = body.kind;
    if (kind !== "faq" && kind !== "sample_reply") return NextResponse.json({ error: "Invalid knowledge kind" }, { status: 400 });
    const title = kind === "faq" ? body.question : body.customerMessage;
    const content = kind === "faq" ? body.answer : body.reply;
    if (typeof title !== "string" || !title.trim() || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Both fields are required" }, { status: 400 });
    }

    const item = await db.workspaceKnowledgeItem.create({ data: { workspaceId, kind, title: title.trim(), content: content.trim() } });
    const formatted = kind === "faq"
      ? formatFaqContent(item.title, item.content)
      : formatSampleReplyContent(item.title, item.content);
    const embedding = await syncTrainingSource({
      workspaceId,
      type: kind,
      name: item.title,
      entityId: item.id,
      content: formatted,
    });
    const updated = await db.workspaceKnowledgeItem.update({
      where: { id: item.id },
      data: { sourceId: embedding.sourceId, embeddingStatus: embedding.status },
    });
    return NextResponse.json(toClientItem(updated), { status: 201 });
  } catch (error) {
    console.error("[WORKSPACE_KNOWLEDGE_POST]", error);
    return NextResponse.json({ error: "Failed to save workspace knowledge" }, { status: 500 });
  }
}
