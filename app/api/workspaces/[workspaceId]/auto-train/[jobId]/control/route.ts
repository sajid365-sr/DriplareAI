import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/core/db";
import { getWorkspaceAccess } from "@/lib/domain/workspace-access";

type JobAction = "pause" | "resume" | "cancel" | "retry";

const transitions: Record<JobAction, { from: string[]; to: string }> = {
  pause: { from: ["queued", "running"], to: "paused" },
  resume: { from: ["paused"], to: "queued" },
  cancel: { from: ["queued", "running", "paused"], to: "cancelled" },
  retry: { from: ["failed"], to: "queued" },
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId, jobId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  if (!access.canWrite) return NextResponse.json({ error: "Workspace edit access required" }, { status: 403 });

  let action: JobAction;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("action" in body)
      || !["pause", "resume", "cancel", "retry"].includes(String(body.action))) {
      return NextResponse.json({ error: "Choose a valid job action." }, { status: 400 });
    }
    action = body.action as JobAction;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const job = await db.conversationLearningJob.findFirst({
    where: { id: jobId, workspaceId },
    select: { id: true, status: true, userId: true, selections: true },
  });
  if (!job) return NextResponse.json({ error: "Conversation learning job not found." }, { status: 404 });
  if (job.userId !== userId) return NextResponse.json({ error: "Only the job creator can manage it." }, { status: 403 });
  if (!transitions[action].from.includes(job.status)) {
    return NextResponse.json({ error: `Cannot ${action} a ${job.status} job.` }, { status: 409 });
  }

  const data: Prisma.ConversationLearningJobUpdateManyMutationInput = action === "retry"
    ? {
      status: "queued",
      error: null,
      state: {},
      transcripts: Prisma.DbNull,
      drafts: Prisma.DbNull,
      currentSource: 0,
      totalConversations: 0,
      processedConversations: 0,
      lockedUntil: null,
      completedAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }
    : {
      status: transitions[action].to,
      lockedUntil: null,
      ...(action === "cancel"
        ? { state: {}, transcripts: Prisma.DbNull, drafts: Prisma.DbNull, error: "Cancelled by user." }
        : {}),
    };
  const updated = await db.conversationLearningJob.updateMany({
    where: { id: job.id, status: job.status },
    data,
  });
  if (updated.count !== 1) {
    return NextResponse.json({ error: "The job changed while this action was being applied. Refresh and retry." }, { status: 409 });
  }
  await db.conversationLearningRun.updateMany({
    where: { id: job.id, workspaceId },
    data: action === "retry"
      ? {
        status: "queued",
        error: null,
        totalConversations: 0,
        processedConversations: 0,
        transcriptCount: 0,
        answerDraftCount: 0,
        contentDraftCount: 0,
        failedSources: 0,
        truncatedSources: 0,
        inputTruncated: false,
        details: Prisma.DbNull,
        detailsExpiresAt: null,
        approvedAnswerCount: 0,
        approvedContentCount: 0,
        failedItems: 0,
        applyStatus: "not_applied",
        savedItems: [],
        completedAt: null,
        appliedAt: null,
      }
      : {
        status: transitions[action].to,
        ...(action === "cancel" ? { error: "Cancelled by user.", details: Prisma.DbNull, detailsExpiresAt: null } : {}),
      },
  });

  const latest = await db.conversationLearningJob.findUnique({
    where: { id: job.id },
    select: { status: true },
  });
  return NextResponse.json({ status: latest?.status });
}
