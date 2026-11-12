import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { formatBusinessAnswerContent, formatFaqContent, formatSampleReplyContent, syncTrainingSource } from "@/lib/ai/qa-training";

type KnowledgeKind = "faq" | "sample_reply";
const isKnowledgeKind = (value: string | null): value is KnowledgeKind => value === "faq" || value === "sample_reply";

function toClientItem(item: { id: string; kind: string; title: string; content: string; archived: boolean; embeddingStatus: string }) {
  return item.kind === "faq"
    ? { id: item.id, question: item.title, answer: item.content, archived: item.archived, embeddingStatus: item.embeddingStatus }
    : { id: item.id, customerMessage: item.title, reply: item.content, archived: item.archived, embeddingStatus: item.embeddingStatus };
}

function toUnifiedClientItem(item: { id: string; kind: string; title: string; content: string; archived: boolean; embeddingStatus: string }) {
  return {
    id: item.id,
    kind: item.kind,
    context: item.title,
    answer: item.content,
    archived: item.archived,
    embeddingStatus: item.embeddingStatus,
  };
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
  if (kind && !isKnowledgeKind(kind)) return NextResponse.json({ error: "Invalid knowledge kind" }, { status: 400 });
  const items = await db.workspaceKnowledgeItem.findMany({
    where: { workspaceId, ...(kind ? { kind } : { kind: { in: ["faq", "sample_reply"] } }) },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(kind ? items.map(toClientItem) : items.map(toUnifiedClientItem));
}

export async function POST(req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  if (!await getOwnedWorkspace(userId, workspaceId)) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    const rawBody: unknown = await req.json();
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const body = rawBody as Record<string, unknown>;
    const kind = body.kind;
    if (kind !== "answer" && kind !== "faq" && kind !== "sample_reply") return NextResponse.json({ error: "Invalid knowledge kind" }, { status: 400 });
    const context = kind === "answer" ? body.context : undefined;
    if (kind === "answer" && context !== undefined && typeof context !== "string") {
      return NextResponse.json({ error: "Question or situation must be text" }, { status: 400 });
    }
    const titleValue = kind === "answer" ? context ?? "" : kind === "faq" ? body.question : body.customerMessage;
    const contentValue = kind === "sample_reply" ? body.reply : body.answer;
    if (typeof titleValue !== "string" || (kind !== "answer" && !titleValue.trim()) || typeof contentValue !== "string" || !contentValue.trim()) {
      return NextResponse.json({ error: kind === "answer" ? "An answer is required" : "Both fields are required" }, { status: 400 });
    }
    if (kind === "answer" && (titleValue.length > 2_000 || contentValue.length > 6_000)) {
      return NextResponse.json({ error: "Question or situation must be at most 2,000 characters and answer at most 6,000 characters" }, { status: 400 });
    }

    const title = titleValue.trim();
    const content = contentValue.trim();
    const storedKind: KnowledgeKind = kind === "answer" ? title ? "faq" : "sample_reply" : kind;
    const item = await db.workspaceKnowledgeItem.create({ data: { workspaceId, kind: storedKind, title, content } });
    const formatted = kind === "answer"
      ? formatBusinessAnswerContent(item.title, item.content)
      : kind === "faq" ? formatFaqContent(item.title, item.content) : formatSampleReplyContent(item.title, item.content);
    const embedding = await syncTrainingSource({
      workspaceId,
      type: storedKind,
      name: item.title,
      entityId: item.id,
      content: formatted,
    });
    const updated = await db.workspaceKnowledgeItem.update({
      where: { id: item.id },
      data: { sourceId: embedding.sourceId, embeddingStatus: embedding.status },
    });
    return NextResponse.json(kind === "answer" ? toUnifiedClientItem(updated) : toClientItem(updated), { status: 201 });
  } catch (error) {
    console.error("[WORKSPACE_KNOWLEDGE_POST]", error);
    return NextResponse.json({ error: "Failed to save workspace knowledge" }, { status: 500 });
  }
}
