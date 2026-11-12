import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { ensureConversationLearningJobRunsInDevelopment } from "@/lib/ai/conversation-learning-jobs";
import { db } from "@/lib/core/db";
import { getWorkspaceAccess } from "@/lib/domain/workspace-access";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId, jobId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const job = await db.conversationLearningJob.findFirst({
    where: { id: jobId, workspaceId },
    select: {
      id: true,
      userId: true,
      status: true,
      state: true,
      drafts: true,
      error: true,
      totalConversations: true,
      processedConversations: true,
      currentSource: true,
      selections: true,
      expiresAt: true,
      updatedAt: true,
    },
  });
  if (!job) return NextResponse.json({ error: "Conversation learning job not found." }, { status: 404 });
  if (job.userId !== userId && !access.canWrite) {
    return NextResponse.json({ error: "You cannot view this learning job." }, { status: 403 });
  }
  if (job.status === "queued" || job.status === "running") {
    ensureConversationLearningJobRunsInDevelopment(job.id);
  }

  const selections = Array.isArray(job.selections) ? job.selections : [];
  const state = isRecord(job.state) ? job.state : {};
  const drafts = isRecord(job.drafts) ? job.drafts : null;
  const credits = job.status === "completed"
    ? await db.creditTransaction.findFirst({
      where: {
        userId: job.userId,
        action_type: "auto_train",
        metadata: { path: ["runId"], equals: job.id },
      },
      select: { credits_spent: true },
    })
    : null;

  return NextResponse.json({
    job: {
      id: job.id,
      status: job.status,
      error: job.error,
      currentSource: job.currentSource,
      totalSources: selections.length,
      totalConversations: job.totalConversations,
      processedConversations: job.processedConversations,
      failedSources: Array.isArray(state.failures) ? state.failures.length : 0,
      truncatedSources: typeof state.truncatedSources === "number" ? state.truncatedSources : 0,
      transcriptCount: typeof state.transcriptCount === "number" ? state.transcriptCount : 0,
      inputTruncated: state.inputTruncated === true,
      drafts,
      creditsSpent: credits?.credits_spent ?? 0,
      expiresAt: job.expiresAt,
      updatedAt: job.updatedAt,
    },
  });
}
