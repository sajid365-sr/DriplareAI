import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/core/db";
import {
  buildTranscriptsFromChatMessages,
  parseConversationsToDrafts,
  type AutoTrainDrafts,
  type ConversationTranscript,
} from "@/lib/ai/auto-train";
import {
  fetchFacebookConversationMessages,
  fetchFacebookConversationPage,
  type FacebookConversationMessage,
} from "@/lib/services/facebook";
import { getActionCredits } from "@/lib/ai/credit-resolver";
import { redactConversationPersonalData } from "@/lib/ai/auto-train-evidence";
import {
  getConversationDateBounds,
  getConversationLimit,
  isWithinConversationDateBounds,
  type ConversationFetchMode,
} from "@/lib/ai/conversation-window";

export type ConversationLearningSelection = {
  agentId: string;
  integrationId: string;
  platform: "facebook" | "whatsapp" | "instagram";
  count: number;
  mode: ConversationFetchMode;
  fromDate?: string;
  toDate?: string;
};

type SourceState = {
  conversationIds: string[];
  cursor?: string;
  scanned: number;
  listed: boolean;
  processed: number;
};

type LearningState = {
  sources: SourceState[];
  failures: Array<{ agentId: string; platform: string; code: string }>;
  truncatedSources: number;
  transcriptCount: number;
  inputTruncated: boolean;
};

type LearningJob = {
  id: string;
  workspaceId: string;
  userId: string;
  selections: unknown;
  state: unknown;
  transcripts: unknown;
  totalConversations: number;
  processedConversations: number;
  currentSource: number;
};

type FacebookIntegrationConfig = {
  pageId?: string;
  pageToken?: string;
};

const BATCH_SIZE = 2;
const MAX_FACEBOOK_SCAN = 500;
const MAX_FACEBOOK_MESSAGE_PAGES = 5;
const MAX_JOB_TRANSCRIPT_CHARS = 40_000;
const RUN_DETAILS_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const LEASE_MS = 8 * 60 * 1000;
const FACEBOOK_ALIASES = ["facebook", "n8n_facebook"];
const AUTO_TRAIN_FEE = getActionCredits("auto_train");
const developmentWorkers = new Set<string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readSelections(value: unknown): ConversationLearningSelection[] {
  if (!Array.isArray(value)) throw new Error("Conversation learning job selections are invalid.");
  return value as ConversationLearningSelection[];
}

function readState(value: unknown, sourceCount: number): LearningState {
  const record = isRecord(value) ? value : {};
  const sources = Array.isArray(record.sources) ? record.sources : [];
  return {
    sources: Array.from({ length: sourceCount }, (_, index) => {
      const source = isRecord(sources[index]) ? sources[index] : {};
      return {
        conversationIds: Array.isArray(source.conversationIds)
          ? source.conversationIds.filter((id): id is string => typeof id === "string")
          : [],
        ...(typeof source.cursor === "string" ? { cursor: source.cursor } : {}),
        scanned: typeof source.scanned === "number" ? source.scanned : 0,
        listed: source.listed === true,
        processed: typeof source.processed === "number" ? source.processed : 0,
      };
    }),
    failures: Array.isArray(record.failures)
      ? record.failures.filter((item): item is { agentId: string; platform: string; code: string } =>
        isRecord(item)
        && typeof item.agentId === "string"
        && typeof item.platform === "string"
        && typeof item.code === "string")
      : [],
    truncatedSources: typeof record.truncatedSources === "number" ? record.truncatedSources : 0,
    transcriptCount: typeof record.transcriptCount === "number" ? record.transcriptCount : 0,
    inputTruncated: record.inputTruncated === true,
  };
}

function emptyDrafts(): AutoTrainDrafts {
  return { faqs: [], sampleReplies: [], content: [] };
}

function getSafeSourceFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("INTEGRATION_ENCRYPTION_KEY")) {
    return "source_credentials_decryption_failed";
  }
  if (message.includes("credentials are unavailable")) {
    return "facebook_credentials_unavailable";
  }
  return "conversation_source_unavailable";
}

function appendBoundedTranscripts(
  existing: ConversationTranscript[],
  incoming: ConversationTranscript[],
  state: LearningState
): ConversationTranscript[] {
  const result = [...existing];
  let remaining = Math.max(0, MAX_JOB_TRANSCRIPT_CHARS - result.reduce((sum, item) => sum + item.text.length, 0));
  for (const transcript of incoming) {
    if (remaining === 0) {
      state.inputTruncated = true;
      break;
    }
    if (transcript.text.length > remaining) {
      result.push({ ...transcript, text: transcript.text.slice(0, remaining) });
      state.inputTruncated = true;
      remaining = 0;
      break;
    }
    result.push(transcript);
    remaining -= transcript.text.length;
  }
  return result;
}

function isWithinSelectionDate(value: string | Date, selection: ConversationLearningSelection): boolean {
  const bounds = getConversationDateBounds(selection.mode, selection.fromDate, selection.toDate);
  return isWithinConversationDateBounds(value, bounds);
}

function buildFacebookTranscript(messages: FacebookConversationMessage[], pageId: string, selection: ConversationLearningSelection): string {
  return [...messages]
    .sort((left, right) => new Date(left.created_time).getTime() - new Date(right.created_time).getTime())
    .filter((message) =>
      message.message?.trim()
      && message.from?.id
      && (selection.mode !== "date_range" || isWithinSelectionDate(message.created_time, selection))
    )
    .map((message) =>
      `${message.from?.id === pageId ? "Owner" : "Customer"}: ${redactConversationPersonalData(message.message ?? "")}`
    )
    .join("\n");
}

function evidenceHash(quote: string): string {
  return createHash("sha256").update(quote.trim()).digest("hex");
}

async function getSourceIntegration(selection: ConversationLearningSelection) {
  return db.integration.findFirst({
    where: {
      chatbotId: selection.agentId,
      integrationId: selection.integrationId,
      platform: { in: selection.platform === "facebook" ? FACEBOOK_ALIASES : [selection.platform] },
      connected: true,
      status: "active",
    },
    select: { integrationId: true, config: true },
  });
}

async function collectSourceConversationIds(
  selection: ConversationLearningSelection,
  sourceState: SourceState
): Promise<{ source: SourceState; added: number; complete: boolean; truncated: boolean }> {
  const integration = await getSourceIntegration(selection);
  if (!integration) throw new Error("Conversation source is no longer connected.");
  const targetCount = getConversationLimit(selection.mode, selection.count);
  const conversationIds = [...sourceState.conversationIds];
  if (selection.platform === "facebook") {
    const config = integration.config as FacebookIntegrationConfig;
    if (!config.pageId || !config.pageToken) throw new Error("Facebook page credentials are unavailable.");
    const page = await fetchFacebookConversationPage(
      config.pageId,
      config.pageToken,
      sourceState.cursor,
      100
    );
    let scanned = sourceState.scanned;
    for (const conversation of page.data) {
      scanned++;
      if (selection.mode !== "date_range"
        || (conversation.updated_time && isWithinSelectionDate(conversation.updated_time, selection))) {
        conversationIds.push(conversation.id);
      }
      if (conversationIds.length >= targetCount || scanned >= MAX_FACEBOOK_SCAN) break;
    }
    const cursor = page.paging?.cursors?.after;
    const complete = conversationIds.length >= targetCount || !cursor || page.data.length < 100;
    const truncated = !complete && scanned >= MAX_FACEBOOK_SCAN;
    return {
      source: {
        conversationIds,
        ...(cursor && !complete ? { cursor } : {}),
        scanned,
        listed: complete || truncated,
        processed: sourceState.processed,
      },
      added: Math.max(0, conversationIds.length - sourceState.conversationIds.length),
      complete,
      truncated,
    };
  }

  if (sourceState.listed) {
    return { source: sourceState, added: 0, complete: true, truncated: false };
  }
  const bounds = getConversationDateBounds(selection.mode, selection.fromDate, selection.toDate);
  const sessions = await db.chatSession.findMany({
    where: {
      chatbotId: selection.agentId,
      platform: selection.platform,
      OR: [{ integrationId: integration.integrationId }, { integrationId: null }],
      ...(bounds.from && bounds.to ? { updatedAt: { gte: bounds.from, lte: bounds.to } } : {}),
    },
    take: targetCount,
    orderBy: { updatedAt: "desc" },
    select: { sessionId: true },
  });
  const ids = sessions.map((session) => session.sessionId);
  return {
    source: { conversationIds: ids, scanned: ids.length, listed: true, processed: 0 },
    added: ids.length,
    complete: true,
    truncated: false,
  };
}

async function processConversationBatch(
  job: LearningJob,
  selection: ConversationLearningSelection,
  sourceState: SourceState,
  agentName: string
): Promise<{ source: SourceState; transcripts: ConversationTranscript[] }> {
  const integration = await getSourceIntegration(selection);
  if (!integration) throw new Error("Conversation source is no longer connected.");
  const ids = sourceState.conversationIds.slice(sourceState.processed, sourceState.processed + BATCH_SIZE);
  if (ids.length === 0) return { source: { ...sourceState, processed: sourceState.conversationIds.length }, transcripts: [] };
  const sourceId = `${selection.agentId}:${selection.platform}`;

  if (selection.platform === "facebook") {
    const config = integration.config as FacebookIntegrationConfig;
    if (!config.pageId || !config.pageToken) throw new Error("Facebook page credentials are unavailable.");
    const transcripts: ConversationTranscript[] = [];
    for (const conversationId of ids) {
      let after: string | undefined;
      const messages: FacebookConversationMessage[] = [];
      const maxPages = selection.mode === "date_range" ? MAX_FACEBOOK_MESSAGE_PAGES : 1;
      for (let pageNumber = 0; pageNumber < maxPages; pageNumber++) {
        const page = await fetchFacebookConversationMessages(conversationId, config.pageToken, after, 100);
        messages.push(...page.data);
        after = page.paging?.cursors?.after;
        if (!after || page.data.length < 100) break;
      }
      const text = buildFacebookTranscript(messages, config.pageId, selection);
      if (text.trim()) {
        transcripts.push({
          platform: selection.platform,
          label: `Facebook conversation ${conversationId.slice(-6)}`,
          text,
          sourceId,
          agentName,
        });
      }
    }
    return {
      source: { ...sourceState, processed: Math.min(sourceState.processed + ids.length, sourceState.conversationIds.length) },
      transcripts,
    };
  }

  const messages = await db.chatMessage.findMany({
    where: {
      chatbotId: selection.agentId,
      sessionId: { in: ids },
      ...(selection.mode === "date_range" ? {
        timestamp: {
          gte: getConversationDateBounds(selection.mode, selection.fromDate, selection.toDate).from,
          lte: getConversationDateBounds(selection.mode, selection.fromDate, selection.toDate).to,
        },
      } : {}),
    },
    select: { sessionId: true, role: true, content: true, sentByHuman: true, timestamp: true },
  });
  const messagesBySession = new Map<string, typeof messages>();
  for (const message of messages) {
    const current = messagesBySession.get(message.sessionId) ?? [];
    current.push(message);
    messagesBySession.set(message.sessionId, current);
  }
  const sessions = ids.map((sessionId) => ({ sessionId, platform: selection.platform, guestName: null }));
  const transcripts = buildTranscriptsFromChatMessages(sessions, messagesBySession)
    .filter((transcript) => transcript.text.trim())
    .map((transcript) => ({ ...transcript, sourceId, agentName }));
  return {
    source: { ...sourceState, processed: Math.min(sourceState.processed + ids.length, sourceState.conversationIds.length) },
    transcripts,
  };
}

async function finishJob(job: LearningJob, state: LearningState, drafts: AutoTrainDrafts, agentNames: Map<string, string>) {
  const allDrafts = drafts;
  const answerDraftCount = allDrafts.faqs.length + allDrafts.sampleReplies.length;
  const contentDraftCount = allDrafts.content.length;
  const totalDrafts = answerDraftCount + contentDraftCount;
  const completedAt = new Date();
  const detailsExpiresAt = new Date(completedAt.getTime() + RUN_DETAILS_RETENTION_MS);
  const totalConversations = state.sources.reduce((total, source) => total + source.conversationIds.length, 0);
  const processedConversations = state.sources.reduce((total, source) => total + source.processed, 0);
  const runSummary = {
    status: "completed",
    totalConversations,
    processedConversations,
    transcriptCount: state.transcriptCount,
    answerDraftCount,
    contentDraftCount,
    failedSources: state.failures.length,
    truncatedSources: state.truncatedSources,
    inputTruncated: state.inputTruncated,
    error: null,
    details: { drafts: { ...allDrafts, runId: job.id } },
    detailsExpiresAt,
    completedAt,
  };
  if (totalDrafts === 0) {
    const failed = state.failures.length > 0;
    const error = failed ? state.failures[0].code : "No verifiable suggestions were found.";
    const finished = await db.conversationLearningJob.updateMany({
      where: { id: job.id, status: "running" },
      data: {
        status: failed ? "failed" : "completed",
        drafts: { ...allDrafts, runId: job.id },
        transcripts: Prisma.DbNull,
        state,
        error,
        completedAt,
        lockedUntil: null,
      },
    });
    if (finished.count !== 1) return;
    await db.conversationLearningRun.update({
      where: { id: job.id },
      data: { ...runSummary, status: failed ? "failed" : "completed", error },
    });
    return;
  }

  const existing = await db.workspaceKnowledgeItem.findMany({
    where: { workspaceId: job.workspaceId, archived: false },
    select: { title: true, content: true },
    take: 500,
  });
  const existingSources = await db.source.findMany({
    where: { workspaceId: job.workspaceId, isGlobal: true },
    select: { name: true, content: true },
    take: 500,
  });
  const known = [...existing, ...existingSources.map((source) => ({ title: source.name, content: source.content ?? "" }))];
  const hasDuplicate = (title: string, content: string) => {
    const normalize = (value: string) => new Set(value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean));
    const left = normalize(title);
    const right = normalize(content);
    return known.find((item) => {
      const itemTitle = normalize(item.title);
      const itemContent = normalize(item.content);
      const intersectionTitle = [...left].filter((token) => itemTitle.has(token)).length;
      const intersectionContent = [...right].filter((token) => itemContent.has(token)).length;
      const titleScore = left.size ? intersectionTitle / new Set([...left, ...itemTitle]).size : 0;
      const contentScore = right.size ? intersectionContent / new Set([...right, ...itemContent]).size : 0;
      return Math.max(titleScore, contentScore) >= 0.72;
    })?.title;
  };
  const reviewed: AutoTrainDrafts = {
    faqs: allDrafts.faqs.map((item) => {
      const duplicateOf = hasDuplicate(item.question, item.answer);
      known.push({ title: item.question, content: item.answer });
      return duplicateOf ? { ...item, duplicateOf } : item;
    }),
    sampleReplies: allDrafts.sampleReplies.map((item) => {
      const duplicateOf = hasDuplicate(item.customerMessage, item.reply);
      known.push({ title: item.customerMessage, content: item.reply });
      return duplicateOf ? { ...item, duplicateOf } : item;
    }),
    content: allDrafts.content.map((item) => {
      const duplicateOf = hasDuplicate(item.title, item.content);
      known.push({ title: item.title, content: item.content });
      return duplicateOf ? { ...item, duplicateOf } : item;
    }),
  };
  const user = await db.user.findUnique({ where: { userId: job.userId }, select: { creditsBalance: true } });
  if (!user || user.creditsBalance < AUTO_TRAIN_FEE) {
    const failed = await db.conversationLearningJob.updateMany({
      where: { id: job.id, status: "running" },
      data: { status: "failed", error: "Insufficient credits", drafts: reviewed, state, lockedUntil: null },
    });
    if (failed.count !== 1) return;
    await db.conversationLearningRun.update({
      where: { id: job.id },
      data: { ...runSummary, status: "failed", error: "Insufficient credits", details: { drafts: { ...reviewed, runId: job.id } } },
    });
    return;
  }

  let charged = false;
  try {
    charged = await db.$transaction(async (transaction) => {
      const currentJob = await transaction.conversationLearningJob.findFirst({
        where: { id: job.id, status: "running" },
        select: { id: true },
      });
      if (!currentJob) return false;
      const debit = await transaction.user.updateMany({
        where: { userId: job.userId, creditsBalance: { gte: AUTO_TRAIN_FEE } },
        data: {
          creditsBalance: { decrement: AUTO_TRAIN_FEE },
          creditsUsedThisCycle: { increment: AUTO_TRAIN_FEE },
        },
      });
      if (debit.count !== 1) return false;
      const selections = readSelections(job.selections);
      await transaction.creditTransaction.create({
        data: {
          userId: job.userId,
          chatbotId: selections[0]?.agentId,
          action_type: "auto_train",
          model_tier: null,
          credits_spent: AUTO_TRAIN_FEE,
          metadata: {
            runId: job.id,
            status: "ready",
            workspaceId: job.workspaceId,
            sources: selections.map((selection) => ({
              ...selection,
              agentName: agentNames.get(selection.agentId) ?? "AI Agent",
            })),
            transcriptCount: state.transcriptCount,
            failedSources: state.failures.length,
            truncatedSources: state.truncatedSources,
            evidenceProofs: [...reviewed.faqs, ...reviewed.sampleReplies, ...reviewed.content]
              .flatMap((draft) => draft.evidence ? [{
                hash: evidenceHash(draft.evidence.quote),
                platform: draft.evidence.platform,
                label: draft.evidence.label,
                ...(draft.evidence.agentName ? { agentName: draft.evidence.agentName } : {}),
              }] : []),
            draftCounts: {
              answers: reviewed.faqs.length + reviewed.sampleReplies.length,
              content: reviewed.content.length,
            },
          },
        },
      });
      const completed = await transaction.conversationLearningJob.updateMany({
        where: { id: job.id, status: "running" },
        data: {
          status: "completed",
          drafts: { ...reviewed, runId: job.id },
          transcripts: Prisma.DbNull,
          state,
          completedAt: new Date(),
          lockedUntil: null,
          error: state.failures.length ? "Some selected sources could not be read." : null,
        },
      });
      if (completed.count !== 1) throw new Error("Conversation learning job changed before finalization.");
      await transaction.conversationLearningRun.update({
        where: { id: job.id },
        data: {
          ...runSummary,
          details: { drafts: { ...reviewed, runId: job.id } },
          error: state.failures.length ? "Some selected sources could not be read." : null,
        },
      });
      return true;
    });
  } catch (error) {
    console.error("[CONVERSATION_LEARNING_FINALIZE]", { jobId: job.id, error });
    throw error;
  }
  if (!charged) {
    const failed = await db.conversationLearningJob.updateMany({
      where: { id: job.id, status: "running" },
      data: { status: "failed", error: "Insufficient credits", drafts: reviewed, state, lockedUntil: null },
    });
    if (failed.count === 1) {
      await db.conversationLearningRun.update({
        where: { id: job.id },
        data: { ...runSummary, status: "failed", error: "Insufficient credits", details: { drafts: { ...reviewed, runId: job.id } } },
      });
    }
  }
}

async function processJob(job: LearningJob): Promise<void> {
  const selections = readSelections(job.selections);
  const state = readState(job.state, selections.length);
  const drafts = emptyDrafts();
  const transcripts = Array.isArray(job.transcripts)
    ? job.transcripts.filter((item): item is ConversationTranscript =>
      isRecord(item)
      && typeof item.platform === "string"
      && typeof item.label === "string"
      && typeof item.text === "string")
    : [];
  const agents = await db.chatbot.findMany({
    where: {
      workspaceId: job.workspaceId,
      chatbotId: { in: [...new Set(selections.map((selection) => selection.agentId))] },
    },
    select: { chatbotId: true, name: true },
  });
  const agentNames = new Map(agents.map((agent) => [agent.chatbotId, agent.name]));
  if (agents.length !== new Set(selections.map((selection) => selection.agentId)).size) {
    throw new Error("A selected Agent no longer belongs to this workspace.");
  }
  const syncRunProgress = async () => {
    await db.conversationLearningRun.updateMany({
      where: { id: job.id, status: { in: ["queued", "running"] } },
      data: {
        status: "running",
        totalConversations: state.sources.reduce((total, source) => total + source.conversationIds.length, 0),
        processedConversations: state.sources.reduce((total, source) => total + source.processed, 0),
        transcriptCount: state.transcriptCount,
        failedSources: state.failures.length,
        truncatedSources: state.truncatedSources,
        inputTruncated: state.inputTruncated,
      },
    });
  };

  let sourceIndex = job.currentSource;
  while (sourceIndex < selections.length) {
    const selection = selections[sourceIndex];
    const sourceState = state.sources[sourceIndex];
    if (!sourceState.listed) {
      try {
        const collected = await collectSourceConversationIds(selection, sourceState);
        state.sources[sourceIndex] = collected.source;
        state.truncatedSources += collected.truncated ? 1 : 0;
        if (collected.added > 0) {
          await db.conversationLearningJob.updateMany({
            where: { id: job.id, status: "running" },
            data: {
              state,
              totalConversations: { increment: collected.added },
            },
          });
        }
        await syncRunProgress();
      } catch (error) {
        const code = getSafeSourceFailureCode(error);
        console.error("[CONVERSATION_LEARNING_LIST]", { jobId: job.id, agentId: selection.agentId, code });
        state.failures.push({ agentId: selection.agentId, platform: selection.platform, code });
        state.sources[sourceIndex] = { ...sourceState, listed: true };
        await syncRunProgress();
      }
      if (!state.sources[sourceIndex].listed) {
        await db.conversationLearningJob.updateMany({
          where: { id: job.id, status: "running" },
          data: { state, currentSource: sourceIndex },
        });
        return;
      }
    }

    const currentSourceState = state.sources[sourceIndex];
    if (currentSourceState.processed < currentSourceState.conversationIds.length) {
      try {
        const batch = await processConversationBatch(
          job,
          selection,
          currentSourceState,
          agentNames.get(selection.agentId) ?? "AI Agent"
        );
        state.sources[sourceIndex] = batch.source;
        const buffered = appendBoundedTranscripts(transcripts, batch.transcripts, state);
        const updated = await db.conversationLearningJob.updateMany({
          where: { id: job.id, status: "running" },
          data: {
            state,
            transcripts: buffered,
            currentSource: sourceIndex,
            processedConversations: { increment: batch.source.processed - currentSourceState.processed },
          },
        });
        transcripts.splice(0, transcripts.length, ...buffered);
        state.transcriptCount += batch.transcripts.length;
        if (updated.count === 1) await syncRunProgress();
      } catch (error) {
        const code = getSafeSourceFailureCode(error);
        console.error("[CONVERSATION_LEARNING_BATCH]", { jobId: job.id, agentId: selection.agentId, code });
        state.failures.push({ agentId: selection.agentId, platform: selection.platform, code });
        state.sources[sourceIndex] = {
          ...state.sources[sourceIndex],
          processed: state.sources[sourceIndex].conversationIds.length,
        };
        const updated = await db.conversationLearningJob.updateMany({
          where: { id: job.id, status: "running" },
          data: { state, currentSource: sourceIndex },
        });
        if (updated.count === 1) await syncRunProgress();
      }
      return;
    }
    sourceIndex++;
  }

  if (transcripts.length === 0) {
    await finishJob(job, state, drafts, agentNames);
    return;
  }
  const extracted = await parseConversationsToDrafts(transcripts, {
    userId: job.userId,
    workspaceId: job.workspaceId,
    requireEvidence: true,
    throwOnFailure: true,
  });
  await finishJob(job, state, extracted, agentNames);
}

export async function processConversationLearningJobs(jobId?: string): Promise<{ processed: number; failed: number }> {
  const now = new Date();
  const expiredJobs = await db.conversationLearningJob.findMany({
    where: { expiresAt: { lte: now } },
    select: { id: true },
    take: 100,
  });
  if (expiredJobs.length > 0) {
    const expiredIds = expiredJobs.map((job) => job.id);
    await db.conversationLearningRun.updateMany({
      where: { id: { in: expiredIds }, status: { in: ["queued", "running", "paused"] } },
      data: { status: "failed", error: "The learning run expired before completion." },
    });
    await db.conversationLearningJob.deleteMany({ where: { id: { in: expiredIds } } });
  }
  await db.conversationLearningRun.updateMany({
    where: { detailsExpiresAt: { lte: now } },
    data: { details: Prisma.DbNull, detailsExpiresAt: null },
  });
  const candidate = await db.conversationLearningJob.findFirst({
    where: {
      ...(jobId ? { id: jobId } : {}),
      status: { in: ["queued", "running"] },
      OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return { processed: 0, failed: 0 };

  const claim = await db.conversationLearningJob.updateMany({
    where: {
      id: candidate.id,
      status: { in: ["queued", "running"] },
      OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
    },
    data: { status: "running", lockedUntil: new Date(now.getTime() + LEASE_MS) },
  });
  if (claim.count !== 1) return { processed: 0, failed: 0 };
  await db.conversationLearningRun.updateMany({
    where: { id: candidate.id, status: "queued" },
    data: { status: "running" },
  });

  try {
    await processJob(candidate);
    await db.conversationLearningJob.updateMany({
      where: { id: candidate.id, status: "running" },
      data: { lockedUntil: null },
    });
    return { processed: 1, failed: 0 };
  } catch (error) {
    console.error("[CONVERSATION_LEARNING_JOB]", { jobId: candidate.id, error });
    const failedJob = await db.conversationLearningJob.updateMany({
      where: { id: candidate.id, status: "running" },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : "Conversation learning failed.",
        lockedUntil: null,
      },
    });
    if (failedJob.count === 1) {
      await db.conversationLearningRun.update({
        where: { id: candidate.id },
        data: { status: "failed", error: "Conversation learning failed. Check the channel connection and retry." },
      });
    }
    return { processed: 1, failed: 1 };
  }
}

export async function processConversationLearningJobInDevelopment(jobId: string): Promise<void> {
  const maxBatches = 50;
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const result = await processConversationLearningJobs(jobId);
    if (result.processed === 0) return;

    const job = await db.conversationLearningJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    if (!job || job.status !== "queued" && job.status !== "running") return;
  }

  console.warn("[CONVERSATION_LEARNING_DEV_WORKER] Batch limit reached.", { jobId, maxBatches });
}

export function ensureConversationLearningJobRunsInDevelopment(jobId: string): void {
  if (process.env.NODE_ENV !== "development" || developmentWorkers.has(jobId)) return;
  developmentWorkers.add(jobId);
  void processConversationLearningJobInDevelopment(jobId)
    .catch((error: unknown) => {
      console.error("[CONVERSATION_LEARNING_DEV_WORKER]", { jobId, error });
    })
    .finally(() => developmentWorkers.delete(jobId));
}
