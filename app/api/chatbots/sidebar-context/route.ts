import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getActiveWorkspace } from "@/lib/core/workspace-server";
import { ensureBusinessTableSchemas } from "@/lib/domain/business-zone";
import { listWorkspaceBusinessForms } from "@/lib/domain/workspace-business-forms";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Get the current active workspace for the user
    let activeWorkspace = null;
    try {
      activeWorkspace = await getActiveWorkspace(userId);
    } catch (e) {
      console.warn("Could not resolve active workspace, falling back to first bot:", e);
    }

    const workspaceId = activeWorkspace?.workspaceId;

    // 2. Fetch the chatbot scoped to this active workspace (or first bot)
    const chatbot = await db.chatbot.findFirst({
      where: {
        userId,
        ...(workspaceId ? { workspaceId } : {}),
      },
      orderBy: { createdAt: "asc" },
    });

    // 3. The business category is governed by the Workspace!
    // If activeWorkspace.category is set, that takes precedence.
    const businessCategory =
      activeWorkspace?.category || chatbot?.chatbotMode || "ecommerce";
    const customBusinessZoneTitle =
      activeWorkspace?.customBusinessTitle || chatbot?.customBusinessZoneTitle || null;

    if (!chatbot) {
      return NextResponse.json({
        chatbotId: null,
        chatbotMode: businessCategory,
        customBusinessZoneTitle,
        schemas: [],
      });
    }

    const workspaceBots = workspaceId
      ? await db.chatbot.findMany({ where: { workspaceId }, select: { chatbotId: true } })
      : [{ chatbotId: chatbot.chatbotId }];
    await ensureBusinessTableSchemas(chatbot.chatbotId, workspaceId ?? null, businessCategory);
    const schemas = await listWorkspaceBusinessForms(workspaceId ?? null, workspaceBots.map((bot) => bot.chatbotId));

    return NextResponse.json({
      chatbotId: chatbot.chatbotId,
      chatbotMode: businessCategory,
      customBusinessZoneTitle,
      schemas: schemas.map(({ id, name, slug, description, isVisibleInSidebar }) => ({ id, name, slug, description, isVisibleInSidebar })),
    });
  } catch (error) {
    console.error("[SIDEBAR_CONTEXT_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
