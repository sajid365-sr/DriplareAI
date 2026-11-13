import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { updateSourceWithEmbeddings } from "@/lib/ai/source-ingestion";

export async function PATCH(req: Request, { params }: { params: Promise<{ workspaceId: string; sourceId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId, sourceId } = await params;
  const workspace = await db.workspace.findFirst({ where: { workspaceId, userId }, select: { workspaceId: true } });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  const source = await db.source.findFirst({
    where: { sourceId, workspaceId, isGlobal: true, type: { in: ["file", "text", "website"] } },
    select: { id: true },
  });
  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });

  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const content = (body as { content?: unknown }).content;
    const rawName = (body as { name?: unknown }).name;
    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }
    if (rawName !== undefined && (typeof rawName !== "string" || !rawName.trim())) {
      return NextResponse.json({ error: "Source name is required" }, { status: 400 });
    }
    if (typeof rawName === "string" && rawName.trim().length > 160) {
      return NextResponse.json({ error: "Source name must be 160 characters or less" }, { status: 400 });
    }
    if (content.length > 50_000) {
      return NextResponse.json({ error: "Content must be 50,000 characters or less" }, { status: 413 });
    }
    const updated = await updateSourceWithEmbeddings(
      sourceId,
      null,
      content,
      typeof rawName === "string" ? rawName.trim() : undefined,
      { workspaceId }
    );
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[WORKSPACE_SOURCE_PATCH]", error);
    return NextResponse.json({ error: "Failed to update workspace source" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ workspaceId: string; sourceId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId, sourceId } = await params;
  const workspace = await db.workspace.findFirst({ where: { workspaceId, userId }, select: { workspaceId: true } });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  const source = await db.source.findFirst({
    where: { sourceId, workspaceId, isGlobal: true },
    select: { id: true, sourceId: true, type: true, name: true },
  });
  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });
  await db.$transaction(async (transaction) => {
    await transaction.source.delete({ where: { id: source.id } });
    if (source.type === "website") {
      await transaction.websiteDiscoveredPage.updateMany({
        where: {
          workspaceId,
          OR: [{ sourceId: source.sourceId }, { url: source.name }],
          status: "crawled",
        },
        data: { status: "pending", sourceId: null, crawledAt: null, lastError: null, jobId: null },
      });
    }
  });
  return NextResponse.json({ success: true });
}
