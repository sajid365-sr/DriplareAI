import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";

// PATCH /api/workspaces/[workspaceId] — rename a business (and optional logo)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await params;

    // Ownership check
    const existing = await db.workspace.findFirst({
      where: { workspaceId, userId: user.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    let body: { name?: unknown; logoUrl?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body (image may be too large)" },
        { status: 400 }
      );
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const logoUrl =
      typeof body.logoUrl === "string" && body.logoUrl.trim()
        ? body.logoUrl.trim()
        : undefined;

    if (!name) {
      return NextResponse.json(
        { error: "Business name is required" },
        { status: 400 }
      );
    }

    const workspace = await db.workspace.update({
      where: { workspaceId },
      data: { name, ...(logoUrl !== undefined && { logoUrl }) },
    });

    return NextResponse.json(workspace);
  } catch (error) {
    console.error("[WORKSPACE_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// DELETE /api/workspaces/[workspaceId] — delete a business and ALL its data.
// Chatbot.workspace is onDelete: SetNull, so deleting the workspace would only
// orphan its chatbots. We must delete the chatbots explicitly (that cascades to
// Source/Chunk/ChatMessage/Integration/ChatSession/Order/EcommerceConfig) and
// clean up AIUsageLog/CreditTransaction (bare chatbotId strings, no FK).
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await params;

    // Ownership check
    const existing = await db.workspace.findFirst({
      where: { workspaceId, userId: user.userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Guard: never delete the last business (the system would auto-recreate one
    // and orphaned chatbots would silently reattach — confusing).
    const total = await db.workspace.count({ where: { userId: user.userId } });
    if (total <= 1) {
      return NextResponse.json(
        { error: "You must keep at least one business." },
        { status: 400 }
      );
    }

    // Collect the chatbot ids under this workspace.
    const bots = await db.chatbot.findMany({
      where: { userId: user.userId, workspaceId },
      select: { chatbotId: true },
    });
    const chatbotIds = bots.map((b) => b.chatbotId);

    await db.$transaction([
      // No FK cascade from Chatbot — remove by chatbotId string.
      db.aIUsageLog.deleteMany({ where: { chatbotId: { in: chatbotIds } } }),
      db.creditTransaction.deleteMany({ where: { chatbotId: { in: chatbotIds } } }),
      // Cascades to Source/Chunk/ChatMessage/Integration/ChatSession/Order/EcommerceConfig.
      db.chatbot.deleteMany({ where: { userId: user.userId, workspaceId } }),
      // Finally the workspace itself.
      db.workspace.delete({ where: { workspaceId } }),
    ]);

    // Tell the client which business to switch to (earliest remaining).
    const next = await db.workspace.findFirst({
      where: { userId: user.userId },
      orderBy: { createdAt: "asc" },
      select: { workspaceId: true },
    });

    return NextResponse.json({
      ok: true,
      nextWorkspaceId: next?.workspaceId ?? null,
    });
  } catch (error) {
    console.error("[WORKSPACE_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
