import "server-only";

import { db } from "@/lib/core/db";
import type { EngineRule, EvaluationContext, TriggerEvent } from "./engine";
import {
  actionSchema,
  conditionSchema,
  frequencyCapSchema,
  quietHoursSchema,
  triggerSchema,
} from "./schema";

/**
 * Loads rules out of the database and turns them into what the engine reads.
 *
 * Everything crossing this boundary is validated. The `triggerConfig`,
 * `conditions` and `actions` columns are JSON, so a rule written by an older
 * version of the schema — or by hand — can be structurally wrong. A rule that
 * fails to parse is dropped with a warning rather than thrown: one bad row
 * must not take down message delivery for the whole workspace.
 */

export interface LoadRulesOptions {
  workspaceId: string;
  /** Resolved `Chatbot.chatbotId`. Also matches workspace-wide rules. */
  chatbotId?: string | null;
  /**
   * Live evaluation only ever wants active rules. The builder's dry-run wants
   * the drafts too, so it can explain *why* a rule it is editing is dormant.
   */
  includeInactive?: boolean;
}

/**
 * Rules that apply to a conversation: the ones pinned to this agent, plus the
 * workspace-wide ones (`chatbotId = null`). That NULL is deliberate — see the
 * comment on the `Automation` model — so the `OR` here is the feature, not a
 * loophole.
 */
export async function loadEngineRules(options: LoadRulesOptions): Promise<EngineRule[]> {
  const { workspaceId, chatbotId, includeInactive = false } = options;

  const rows = await db.automation.findMany({
    where: {
      workspaceId,
      ...(includeInactive ? {} : { status: "active" }),
      ...(chatbotId ? { OR: [{ chatbotId: null }, { chatbotId }] } : {}),
    },
    orderBy: { priority: "asc" },
  });

  const rules: EngineRule[] = [];

  for (const row of rows) {
    const trigger = triggerSchema.safeParse({
      type: row.triggerType,
      ...(row.triggerConfig as Record<string, unknown> | null),
    });
    if (!trigger.success) {
      console.warn(
        `[AUTOMATIONS] Skipping rule ${row.automationId}: invalid trigger — ${trigger.error.message}`
      );
      continue;
    }

    const conditions = parseList(row.conditions, conditionSchema);
    const actions = parseList(row.actions, actionSchema);

    rules.push({
      automationId: row.automationId,
      name: row.name,
      kind: row.kind,
      status: row.status,
      priority: row.priority,
      stopOnMatch: row.stopOnMatch,
      matchMode: row.matchMode === "any" ? "any" : "all",
      trigger: trigger.data,
      conditions,
      actions,
      quietHours: quietHoursSchema.parse(row.quietHours ?? {}),
      frequencyCap: frequencyCapSchema.parse(row.frequencyCap ?? {}),
    });
  }

  return rules;
}

/**
 * Parse a JSON array of sub-objects, keeping the entries that validate.
 * Dropping one bad condition is better than dropping the rule: the merchant
 * sees a rule that fires a little too eagerly, which is visible, instead of
 * one that never fires, which is not.
 */
function parseList<T>(
  raw: unknown,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }
): T[] {
  if (!Array.isArray(raw)) return [];
  const parsed: T[] = [];
  for (const entry of raw) {
    const result = schema.safeParse(entry);
    if (result.success) parsed.push(result.data);
  }
  return parsed;
}

// ── Conversation facts ────────────────────────────────────────────────────────

export interface ContextInput {
  workspaceId: string;
  /** Resolved `Chatbot.chatbotId`. */
  chatbotId: string;
  sessionId: string;
  messageText: string;
  channel?: string | null;
  integrationId?: string | null;
  /** When omitted it is derived from the stored message count. */
  isFirstMessage?: boolean;
  now?: Date;
}

interface ExtractionData {
  phone?: string | null;
  address?: string | null;
  district?: string | null;
  cartItems?: unknown[];
}

/**
 * Resolve everything the engine's conditions can ask about.
 *
 * Runs as a handful of parallel queries rather than one deep `include`: the
 * relations here span three schemas, and separate indexed lookups stay cheaper
 * and far more readable than a nested join graph.
 */
export async function buildEvaluationContext(
  input: ContextInput
): Promise<EvaluationContext & { lastInboundAt: Date | null }> {
  const now = input.now ?? new Date();

  const [session, tagRows, userMessageCount, lastInbound, latestOrder] = await Promise.all([
    db.chatSession.findUnique({
      where: { chatbotId_sessionId: { chatbotId: input.chatbotId, sessionId: input.sessionId } },
      select: {
        platform: true,
        integrationId: true,
        leadStatus: true,
        sentiment: true,
        isActive: true,
        aiExtractionData: true,
      },
    }),
    db.sessionTag.findMany({
      where: { chatbotId: input.chatbotId, sessionId: input.sessionId },
      select: { tagId: true },
    }),
    db.chatMessage.count({
      where: { chatbotId: input.chatbotId, sessionId: input.sessionId, role: "user" },
    }),
    db.chatMessage.findFirst({
      where: { chatbotId: input.chatbotId, sessionId: input.sessionId, role: "user" },
      orderBy: { timestamp: "desc" },
      select: { timestamp: true },
    }),
    db.order.findFirst({
      where: { chatbotId: input.chatbotId, sessionId: input.sessionId },
      orderBy: { createdAt: "desc" },
      select: { totalAmount: true },
    }),
  ]);

  const extraction = (session?.aiExtractionData ?? {}) as ExtractionData;
  const lastInboundAt = lastInbound?.timestamp ?? null;

  return {
    chatbotId: input.chatbotId,
    channel: input.channel ?? session?.platform ?? null,
    integrationId: input.integrationId ?? session?.integrationId ?? null,
    // The incoming message has not been persisted yet when the Gate runs, so a
    // stored user-message count of zero means this *is* the first one.
    isFirstMessage: input.isFirstMessage ?? userMessageCount === 0,
    hasPhone: Boolean(extraction.phone),
    hasAddress: Boolean(extraction.address),
    leadStatus: session?.leadStatus ?? null,
    sentiment: session?.sentiment ?? null,
    // Language is not detected server-side yet; the AI pipeline owns that. A
    // `language` condition therefore reports "unknown" until it is wired in,
    // which is honest — better than guessing from the text and being wrong.
    language: null,
    tagIds: tagRows.map((row) => row.tagId),
    orderValue: latestOrder?.totalAmount ?? null,
    minutesSinceLastMessage: lastInboundAt
      ? Math.floor((now.getTime() - lastInboundAt.getTime()) / 60_000)
      : null,
    aiActive: session?.isActive ?? true,
    recentRunsByRule: {}, // filled in by `applyFrequencyCaps`
    now,
    lastInboundAt,
  };
}

// ── Frequency caps ────────────────────────────────────────────────────────────

/**
 * Fill in `recentRunsByRule` — how many times each capped rule already fired
 * for this contact *inside its own window*.
 *
 * One query fetches the recent firing timestamps over the widest window any
 * rule asks for; each rule's count is then tallied in memory against its own
 * window. Grouping in SQL instead would need one grouped query per distinct
 * window, and a `count()` per rule would put N queries on the hot path of
 * every incoming message.
 */
export async function applyFrequencyCaps(
  ctx: EvaluationContext,
  rules: EngineRule[],
  identities: { chatbotId: string; sessionId: string }
): Promise<void> {
  const capped = rules.filter((rule) => rule.frequencyCap.enabled);
  if (capped.length === 0 || !identities.sessionId) return;

  const widestWindowHours = Math.max(...capped.map((rule) => rule.frequencyCap.perWindowHours));
  const since = new Date(ctx.now.getTime() - widestWindowHours * 3_600_000);

  const runs = await db.automationRun.findMany({
    where: {
      automationId: { in: capped.map((rule) => rule.automationId) },
      chatbotId: identities.chatbotId,
      sessionId: identities.sessionId,
      status: { in: ["sent", "matched"] },
      // A skipped run is not a send — counting them would let a rule exhaust
      // its own cap by repeatedly deciding not to fire.
      skipReason: null,
      createdAt: { gte: since },
    },
    select: { automationId: true, createdAt: true },
  });

  const counts: Record<string, number> = {};
  for (const rule of capped) {
    const windowStart = ctx.now.getTime() - rule.frequencyCap.perWindowHours * 3_600_000;
    counts[rule.automationId] = runs.filter(
      (run) => run.automationId === rule.automationId && run.createdAt.getTime() >= windowStart
    ).length;
  }

  ctx.recentRunsByRule = counts;
}

// ── Run log ───────────────────────────────────────────────────────────────────

export interface RecordRunInput {
  workspaceId: string;
  chatbotId?: string | null;
  sessionId?: string | null;
  triggerType: string;
  status: "matched" | "sent" | "skipped" | "failed" | "waiting";
  skipReason?: string | null;
  /** Serialized engine outcomes — the "why didn't it fire" record. */
  matchedRules?: unknown[];
  actionsResult?: unknown[];
  error?: string | null;
  creditsSpent?: number;
}

export async function recordRun(input: RecordRunInput): Promise<string> {
  const run = await db.automationRun.create({
    data: {
      workspaceId: input.workspaceId,
      chatbotId: input.chatbotId ?? null,
      sessionId: input.sessionId ?? null,
      triggerType: input.triggerType,
      status: input.status,
      skipReason: input.skipReason ?? null,
      matchedRules: (input.matchedRules ?? []) as never,
      actionsResult: (input.actionsResult ?? []) as never,
      error: input.error ?? null,
      creditsSpent: input.creditsSpent ?? 0,
    },
    select: { id: true },
  });

  return run.id;
}

/** Bump the denormalized counters the rules list renders. */
export async function touchAutomationStats(automationIds: string[], at: Date): Promise<void> {
  if (automationIds.length === 0) return;
  // `stats` is JSON and its per-rule shape differs, so an atomic increment
  // would need a raw statement per rule. Marking `lastRunAt` only keeps this
  // one cheap UPDATE; the counts are derived from `AutomationRun` when the
  // list page actually needs them.
  await db.automation.updateMany({
    where: { automationId: { in: automationIds } },
    data: { lastRunAt: at },
  });
}

/** Convenience for the event shape the engine consumes. */
export function toTriggerEvent(
  type: TriggerEvent["type"],
  messageText: string,
  payload: Record<string, unknown> = {}
): TriggerEvent {
  return { type, messageText, payload };
}
