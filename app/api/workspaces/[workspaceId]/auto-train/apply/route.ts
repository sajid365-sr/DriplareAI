import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/core/db";
import { createSourceWithEmbeddings } from "@/lib/ai/source-ingestion";
import { formatBusinessAnswerContent, syncTrainingSource } from "@/lib/ai/qa-training";
import { getWorkspaceAccess } from "@/lib/domain/workspace-access";
import type { AutoTrainEvidence } from "@/lib/ai/auto-train-evidence";

type AnswerDraft = { context: string; answer: string; evidence?: AutoTrainEvidence };
type ContentDraft = { title: string; content: string; evidence?: AutoTrainEvidence };
type ApplyBody = { runId: string; answers: AnswerDraft[]; content: ContentDraft[] };

function isDraftEvidence(value: unknown): value is AutoTrainEvidence {
  if (!value || typeof value !== "object") return false;
  const evidence = value as Partial<AutoTrainEvidence>;
  return typeof evidence.platform === "string"
    && typeof evidence.label === "string"
    && typeof evidence.quote === "string"
    && evidence.quote.trim().length >= 12;
}

function evidenceHash(quote: string): string {
  return createHash("sha256").update(quote.trim()).digest("hex");
}

function draftEvidenceHash(evidence: AutoTrainEvidence): string {
  return createHash("sha256").update(JSON.stringify([
    evidence.platform,
    evidence.label,
    evidence.quote.trim(),
    evidence.agentName ?? "",
  ])).digest("hex");
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  if (!access.canWrite) return NextResponse.json({ error: "Workspace edit access required" }, { status: 403 });

  let body: ApplyBody;
  try {
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    const payload = raw as Partial<ApplyBody>;
    if (typeof payload.runId !== "string" || !Array.isArray(payload.answers) || !Array.isArray(payload.content)) {
      return NextResponse.json({ error: "Invalid learning run payload" }, { status: 400 });
    }
    if (payload.answers.length > 35 || payload.content.length > 12) {
      return NextResponse.json({ error: "Too many suggestions to apply" }, { status: 400 });
    }
    body = payload as ApplyBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const answers = body.answers.filter((item) =>
    item && typeof item.context === "string" && item.context.length <= 2_000
    && typeof item.answer === "string" && item.answer.trim().length > 0 && item.answer.length <= 6_000
    && isDraftEvidence(item.evidence)
  );
  const content = body.content.filter((item) =>
    item && typeof item.title === "string" && item.title.trim().length > 0 && item.title.length <= 200
    && typeof item.content === "string" && item.content.trim().length > 0 && item.content.length <= 20_000
    && isDraftEvidence(item.evidence)
  );
  if (answers.length === 0 && content.length === 0) {
    return NextResponse.json({ error: "Select at least one valid suggestion to apply." }, { status: 400 });
  }

  const run = await db.creditTransaction.findFirst({
    where: {
      userId,
      action_type: "auto_train",
      metadata: { path: ["runId"], equals: body.runId },
    },
    select: { id: true, metadata: true },
  });
  if (!run || !run.metadata || typeof run.metadata !== "object" || Array.isArray(run.metadata)) {
    return NextResponse.json({ error: "Learning run was not found or has expired." }, { status: 404 });
  }
  const metadata = run.metadata as Record<string, unknown>;
  if (metadata.workspaceId !== workspaceId || metadata.status !== "ready") {
    return NextResponse.json({ error: "This learning run cannot be applied again." }, { status: 409 });
  }
  const sources = Array.isArray(metadata.sources)
    ? metadata.sources.filter((source): source is { agentId: string; agentName: string; platform: string } =>
      !!source && typeof source === "object"
      && typeof (source as Record<string, unknown>).agentId === "string"
      && typeof (source as Record<string, unknown>).agentName === "string"
      && typeof (source as Record<string, unknown>).platform === "string")
    : [];
  const evidenceProofs = Array.isArray(metadata.evidenceProofs)
    ? metadata.evidenceProofs.filter((proof): proof is { hash: string; platform: string; label: string; agentName?: string } =>
      !!proof && typeof proof === "object"
      && typeof (proof as Record<string, unknown>).hash === "string"
      && typeof (proof as Record<string, unknown>).platform === "string"
      && typeof (proof as Record<string, unknown>).label === "string")
    : [];
  const validEvidence = (evidence: AutoTrainEvidence | undefined) =>
    !!evidence
    && evidenceProofs.some((proof) =>
      proof.hash === evidenceHash(evidence.quote)
      && proof.platform === evidence.platform
      && proof.label === evidence.label
      && proof.agentName === evidence.agentName
      && sources.some((source) => source.platform === evidence.platform && source.agentName === evidence.agentName)
    );
  if (answers.some((item) => !validEvidence(item.evidence)) || content.some((item) => !validEvidence(item.evidence))) {
    return NextResponse.json({ error: "A suggestion's conversation evidence does not match this learning run." }, { status: 400 });
  }

  const claimed = await db.creditTransaction.updateMany({
    where: {
      id: run.id,
      userId,
      metadata: { path: ["status"], equals: "ready" },
    },
    data: { metadata: { ...metadata, status: "applying" } },
  });
  if (claimed.count !== 1) {
    return NextResponse.json({ error: "This learning run is already being applied or has been used." }, { status: 409 });
  }

  const added = { answers: 0, content: 0 };
  let failed = 0;
  const savedItems: Array<{ id: string; destination: "answers" | "sources"; evidenceHash: string }> = [];
  const runId = body.runId;
  const provenanceFor = (evidence: AutoTrainEvidence) => ({
    runId,
    evidence: [{
      platform: evidence.platform,
      label: evidence.label,
      quote: evidence.quote,
      ...(evidence.agentName ? { agentName: evidence.agentName } : {}),
    }],
  });

  for (const answer of answers) {
    try {
      const context = answer.context.trim();
      const kind = context ? "faq" : "sample_reply";
      const item = await db.workspaceKnowledgeItem.create({
        data: {
          workspaceId,
          kind,
          title: context,
          content: answer.answer.trim(),
        },
      });
      const embedding = await syncTrainingSource({
        workspaceId,
        type: kind,
        name: context || "General response example",
        entityId: item.id,
        content: formatBusinessAnswerContent(context, answer.answer.trim()),
        provenance: provenanceFor(answer.evidence!),
      });
      await db.workspaceKnowledgeItem.update({
        where: { id: item.id },
        data: { sourceId: embedding.sourceId, embeddingStatus: embedding.status },
      });
      if (embedding.status === "failed") failed++;
      added.answers++;
      savedItems.push({ id: item.id, destination: "answers", evidenceHash: draftEvidenceHash(answer.evidence!) });
    } catch (error) {
      console.error("[WORKSPACE_AUTO_TRAIN_ANSWER]", error);
      failed++;
    }
  }

  for (const source of content) {
    try {
      const savedSource = await createSourceWithEmbeddings({
        workspaceId,
        isGlobal: true,
        type: "text",
        name: source.title.trim(),
        content: source.content.trim(),
        provenance: provenanceFor(source.evidence!),
      });
      added.content++;
      savedItems.push({ id: savedSource.sourceId, destination: "sources", evidenceHash: draftEvidenceHash(source.evidence!) });
    } catch (error) {
      console.error("[WORKSPACE_AUTO_TRAIN_CONTENT]", error);
      failed++;
    }
  }

  const status = failed === 0 ? "applied" : added.answers + added.content > 0 ? "partial" : "failed";
  const appliedAt = new Date();
  await db.$transaction([
    db.creditTransaction.update({
      where: { id: run.id },
      data: {
        metadata: {
          ...metadata,
          status,
          appliedAt: appliedAt.toISOString(),
          appliedCounts: added,
          failedItems: failed,
        },
      },
    }),
    db.conversationLearningRun.updateMany({
      where: { id: runId, workspaceId },
      data: {
        approvedAnswerCount: added.answers,
        approvedContentCount: added.content,
        failedItems: failed,
        applyStatus: status,
        savedItems,
        appliedAt,
      },
    }),
  ]);

  return NextResponse.json({ added, failed, status }, { status: failed > 0 ? 207 : 200 });
}
