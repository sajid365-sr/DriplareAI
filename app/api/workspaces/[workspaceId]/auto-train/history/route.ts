import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/core/db";
import { getWorkspaceAccess } from "@/lib/domain/workspace-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const url = new URL(_request.url);
  const cursor = url.searchParams.get("cursor");
  if (cursor && (cursor.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(cursor))) {
    return NextResponse.json({ error: "Invalid history cursor" }, { status: 400 });
  }

  const runDelegate = db.conversationLearningRun;
  if (!runDelegate) {
    console.error("[AUTO_TRAIN_HISTORY] Generated Prisma Client is missing ConversationLearningRun.");
    return NextResponse.json({ code: "generated_client_stale" }, { status: 503 });
  }

  try {
    await runDelegate.updateMany({
      where: { workspaceId, detailsExpiresAt: { lte: new Date() } },
      data: { details: Prisma.DbNull, detailsExpiresAt: null },
    });

    const runs = await runDelegate.findMany({
      where: { workspaceId },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 21,
      select: {
        id: true,
        status: true,
        sources: true,
        totalConversations: true,
        processedConversations: true,
        transcriptCount: true,
        answerDraftCount: true,
        contentDraftCount: true,
        failedSources: true,
        truncatedSources: true,
        inputTruncated: true,
        error: true,
        detailsExpiresAt: true,
        approvedAnswerCount: true,
        approvedContentCount: true,
        failedItems: true,
        applyStatus: true,
        createdAt: true,
        completedAt: true,
        appliedAt: true,
      },
    });
    const hasMore = runs.length > 20;
    const page = hasMore ? runs.slice(0, 20) : runs;
    return NextResponse.json({
      runs: page,
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
    });
  } catch (error) {
    console.error("[AUTO_TRAIN_HISTORY]", error);
    const code = error && typeof error === "object" && "code" in error
      ? error.code
      : null;
    if (code === "P2021" || code === "P2022") {
      return NextResponse.json({ code: "history_schema_missing" }, { status: 503 });
    }
    return NextResponse.json({ code: "history_load_failed" }, { status: 500 });
  }
}
