import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ workspaceId: string; sourceId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId, sourceId } = await params;
  const workspace = await db.workspace.findFirst({ where: { workspaceId, userId }, select: { workspaceId: true } });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  const source = await db.source.findFirst({ where: { sourceId, workspaceId, isGlobal: true }, select: { id: true } });
  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });
  await db.source.delete({ where: { id: source.id } });
  return NextResponse.json({ success: true });
}
