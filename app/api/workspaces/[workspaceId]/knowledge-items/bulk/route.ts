import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";

export async function POST(req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  if (!await db.workspace.findFirst({ where: { workspaceId, userId }, select: { workspaceId: true } })) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  let body: { action?: string; ids?: unknown; kind?: unknown };
  try {
    body = await req.json() as { action?: string; ids?: unknown; kind?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (
    !Array.isArray(body.ids)
    || body.ids.some((id) => typeof id !== "string")
    || (body.kind !== undefined && body.kind !== "faq" && body.kind !== "sample_reply")
    || (body.action !== "delete" && body.action !== "archive" && body.action !== "unarchive")
  ) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const ids = body.ids as string[];
  const where = {
    workspaceId,
    kind: body.kind ?? { in: ["faq", "sample_reply"] },
    id: { in: ids },
  };
  if (body.action === "delete") {
    const items = await db.workspaceKnowledgeItem.findMany({ where, select: { sourceId: true } });
    const sourceIds = items.flatMap((item) => item.sourceId ? [item.sourceId] : []);
    await db.$transaction([
      db.source.deleteMany({ where: { workspaceId, sourceId: { in: sourceIds } } }),
      db.workspaceKnowledgeItem.deleteMany({ where }),
    ]);
  } else if (body.action === "archive" || body.action === "unarchive") {
    await db.workspaceKnowledgeItem.updateMany({ where, data: { archived: body.action === "archive" } });
  } else return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  return NextResponse.json({ success: true, count: ids.length });
}
