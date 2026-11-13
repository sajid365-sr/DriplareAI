import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { ensureConversationLearningJobRunsInDevelopment } from "@/lib/ai/conversation-learning-jobs";
import { db } from "@/lib/core/db";
import { getConversationLimit, isDateOnly, isValidDateRange, type ConversationFetchMode } from "@/lib/ai/conversation-window";
import { getWorkspaceAccess } from "@/lib/domain/workspace-access";

type SelectionInput = {
  agentId: string;
  integrationId: string;
  platform: string;
  count: number;
  mode?: ConversationFetchMode;
  fromDate?: string;
  toDate?: string;
};

const PLATFORMS = new Set(["facebook", "whatsapp", "instagram"]);

function isSelection(value: unknown): value is SelectionInput {
  if (!value || typeof value !== "object") return false;
  const selection = value as Partial<SelectionInput>;
  return typeof selection.agentId === "string"
    && typeof selection.integrationId === "string"
    && typeof selection.platform === "string"
    && PLATFORMS.has(selection.platform)
    && Number.isFinite(Number(selection.count))
    && (selection.mode === undefined || ["recent", "date_range", "all_available"].includes(selection.mode))
    && (selection.fromDate === undefined || isDateOnly(selection.fromDate))
    && (selection.toDate === undefined || isDateOnly(selection.toDate));
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  if (!access.canWrite) return NextResponse.json({ error: "Workspace edit access required" }, { status: 403 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const rawSelections = payload && typeof payload === "object" && "selections" in payload
    ? (payload as { selections?: unknown }).selections
    : undefined;
  if (!Array.isArray(rawSelections) || rawSelections.length === 0 || !rawSelections.every(isSelection)) {
    return NextResponse.json({ error: "Select at least one valid conversation source." }, { status: 400 });
  }
  if (rawSelections.length > 12) {
    return NextResponse.json({ error: "Select no more than 12 conversation sources per run." }, { status: 400 });
  }
  if (rawSelections.some((selection) =>
    selection.mode === "date_range" && !isValidDateRange(selection.fromDate, selection.toDate)
  )) {
    return NextResponse.json({ error: "Choose a valid start and end date for every date-range source." }, { status: 400 });
  }

  const selections = rawSelections.map((selection) => ({
    agentId: selection.agentId,
    integrationId: selection.integrationId,
    platform: selection.platform as "facebook" | "whatsapp" | "instagram",
    count: getConversationLimit(selection.mode, Number(selection.count)),
    mode: selection.mode ?? "recent",
    ...(selection.fromDate ? { fromDate: selection.fromDate } : {}),
    ...(selection.toDate ? { toDate: selection.toDate } : {}),
  }));
  const uniqueKeys = new Set(selections.map((selection) => `${selection.agentId}:${selection.integrationId}`));
  if (uniqueKeys.size !== selections.length) {
    return NextResponse.json({ error: "A conversation source was selected more than once." }, { status: 400 });
  }

  const agentIds = [...new Set(selections.map((selection) => selection.agentId))];
  const agents = await db.chatbot.findMany({
    where: { workspaceId, chatbotId: { in: agentIds } },
    select: { chatbotId: true, name: true },
  });
  if (agents.length !== agentIds.length) {
    return NextResponse.json({ error: "One or more selected Agents do not belong to this workspace." }, { status: 403 });
  }
  const integrations = await db.integration.findMany({
    where: {
      chatbotId: { in: agentIds },
      integrationId: { in: selections.map((selection) => selection.integrationId) },
      connected: true,
      status: "active",
    },
    select: { chatbotId: true, integrationId: true, platform: true, config: true },
  });
  const validIntegrations = new Map(integrations.map((integration) => [
    `${integration.chatbotId}:${integration.integrationId}`,
    integration,
  ]));
  if (selections.some((selection) => {
    const integration = validIntegrations.get(`${selection.agentId}:${selection.integrationId}`);
    return !integration || (selection.platform === "facebook"
      ? !["facebook", "n8n_facebook"].includes(integration.platform)
      : integration.platform !== selection.platform);
  })) {
    return NextResponse.json({ error: "One or more selected conversation sources are no longer connected." }, { status: 400 });
  }

  const agentNames = new Map(agents.map((agent) => [agent.chatbotId, agent.name]));
  const sourceSnapshots = selections.map((selection) => {
    const integration = validIntegrations.get(`${selection.agentId}:${selection.integrationId}`);
    const config = integration?.config && typeof integration.config === "object" && !Array.isArray(integration.config)
      ? integration.config as Record<string, unknown>
      : {};
    const label = [config.pageName, config.instagramUsername, config.verifiedName, config.displayPhoneNumber]
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);
    return {
      ...selection,
      agentName: agentNames.get(selection.agentId) ?? "AI Agent",
      sourceName: typeof label === "string" ? label : selection.platform,
    };
  });

  const jobId = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const job = await db.$transaction(async (transaction) => {
    const createdJob = await transaction.conversationLearningJob.create({
      data: {
        id: jobId,
        workspaceId,
        userId,
        status: "queued",
        selections,
        state: {},
        expiresAt,
      },
      select: { id: true, status: true, expiresAt: true },
    });
    await transaction.conversationLearningRun.create({
      data: {
        id: jobId,
        workspaceId,
        userId,
        status: "queued",
        sources: sourceSnapshots,
      },
    });
    return createdJob;
  });
  if (process.env.NODE_ENV === "development") {
    ensureConversationLearningJobRunsInDevelopment(job.id);
  }
  return NextResponse.json({ jobId: job.id, status: job.status, expiresAt: job.expiresAt }, { status: 202 });
}
