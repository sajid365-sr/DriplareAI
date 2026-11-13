import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

import { db } from "@/lib/core/db";
import { getWorkspaceAccess } from "@/lib/domain/workspace-access";

function evidenceHash(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const evidence = value as Record<string, unknown>;
  if (
    typeof evidence.platform !== "string"
    || typeof evidence.label !== "string"
    || typeof evidence.quote !== "string"
  ) return null;
  return createHash("sha256").update(JSON.stringify([
    evidence.platform,
    evidence.label,
    evidence.quote.trim(),
    typeof evidence.agentName === "string" ? evidence.agentName : "",
  ])).digest("hex");
}

function enrichDetails(details: unknown, savedItems: unknown, applyStatus: string): unknown {
  if (!details || typeof details !== "object" || Array.isArray(details)) return details;
  const source = details as Record<string, unknown>;
  if (!source.drafts || typeof source.drafts !== "object" || Array.isArray(source.drafts)) return details;
  const drafts = source.drafts as Record<string, unknown>;
  const savedCounts = new Map<string, number>();
  let hasSavedReferences = false;
  if (Array.isArray(savedItems)) {
    for (const item of savedItems) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const record = item as Record<string, unknown>;
      if (
        typeof record.destination !== "string"
        || typeof record.evidenceHash !== "string"
      ) continue;
      hasSavedReferences = true;
      const key = `${record.destination}:${record.evidenceHash}`;
      savedCounts.set(key, (savedCounts.get(key) ?? 0) + 1);
    }
  }
  const annotate = (entries: unknown, destination: "answers" | "sources") => {
    if (!Array.isArray(entries)) return entries;
    return entries.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
      const draft = entry as Record<string, unknown>;
      const hash = evidenceHash(draft.evidence);
      const key = hash ? `${destination}:${hash}` : "";
      const count = key ? savedCounts.get(key) ?? 0 : 0;
      if (count > 0) savedCounts.set(key, count - 1);
      return {
        ...draft,
        reviewStatus: count > 0
          ? "approved"
          : applyStatus === "not_applied"
            ? "pending_review"
            : hasSavedReferences ? "not_selected" : "unknown",
      };
    });
  };
  return {
    ...source,
    drafts: {
      ...drafts,
      faqs: annotate(drafts.faqs, "answers"),
      sampleReplies: annotate(drafts.sampleReplies, "answers"),
      content: annotate(drafts.content, "sources"),
    },
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; runId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId, runId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const runDelegate = db.conversationLearningRun;
  if (!runDelegate) {
    console.error("[AUTO_TRAIN_HISTORY_DETAIL] Generated Prisma Client is missing ConversationLearningRun.");
    return NextResponse.json({ code: "generated_client_stale" }, { status: 503 });
  }

  try {
    let run = await runDelegate.findFirst({
    where: { id: runId, workspaceId },
    select: {
      id: true,
      workspaceId: true,
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
      details: true,
      detailsExpiresAt: true,
      approvedAnswerCount: true,
      approvedContentCount: true,
      failedItems: true,
      applyStatus: true,
      savedItems: true,
      createdAt: true,
      completedAt: true,
      appliedAt: true,
    },
    });
    if (!run) return NextResponse.json({ error: "Learning run not found" }, { status: 404 });
    if (run.detailsExpiresAt && run.detailsExpiresAt <= new Date() && run.details !== null) {
      await runDelegate.updateMany({
        where: { id: runId, workspaceId },
        data: { details: Prisma.DbNull, detailsExpiresAt: null },
      });
      run = await runDelegate.findFirst({
        where: { id: runId, workspaceId },
        select: {
          id: true,
          workspaceId: true,
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
          details: true,
          detailsExpiresAt: true,
          approvedAnswerCount: true,
          approvedContentCount: true,
          failedItems: true,
          applyStatus: true,
          savedItems: true,
          createdAt: true,
          completedAt: true,
          appliedAt: true,
        },
      });
      if (!run) return NextResponse.json({ error: "Learning run not found" }, { status: 404 });
    }
    return NextResponse.json({
      run: {
        ...run,
        details: enrichDetails(run.details, run.savedItems, run.applyStatus),
      },
    });
  } catch (error) {
    console.error("[AUTO_TRAIN_HISTORY_DETAIL]", error);
    const code = error && typeof error === "object" && "code" in error
      ? error.code
      : null;
    if (code === "P2021" || code === "P2022") {
      return NextResponse.json({ code: "history_schema_missing" }, { status: 503 });
    }
    return NextResponse.json({ code: "history_load_failed" }, { status: 500 });
  }
}
