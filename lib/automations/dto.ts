/**
 * Serialization between `Automation` rows and the API.
 *
 * The JSON columns leave the database as `Prisma.JsonValue`, which is
 * deliberately untyped. Two rules apply when shaping a response:
 *
 *  - never return the raw column, because the client cannot narrow it either
 *    and would end up re-implementing these defaults;
 *  - always apply the schema's defaults, so a row written before a default
 *    existed still reaches the builder fully populated.
 *
 * The second point is what stops the rule builder from rendering a blank
 * "match mode" for every rule created in an earlier release.
 */

import {
  actionSchema,
  conditionSchema,
  frequencyCapSchema,
  quietHoursSchema,
  triggerSchema,
  type AutomationAction,
  type AutomationCondition,
  type FrequencyCapConfig,
  type QuietHoursConfig,
  type Trigger,
} from "./schema";

export interface AutomationRunStats {
  runsToday: number;
  /** Runs today that ended in `sent` — i.e. the AI never had to answer. */
  sentToday: number;
  runsTotal: number;
  lastRunAt: string | null;
}

export interface AutomationDto {
  automationId: string;
  chatbotId: string | null;
  name: string;
  description: string | null;
  kind: string;
  status: string;
  priority: number;
  stopOnMatch: boolean;
  matchMode: "all" | "any";
  trigger: Trigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  graph: { nodes: unknown[]; edges: unknown[] } | null;
  quietHours: QuietHoursConfig;
  frequencyCap: FrequencyCapConfig;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  runs: AutomationRunStats;
}

/** The subset of an `Automation` row this module needs. */
export interface AutomationRowLike {
  automationId: string;
  chatbotId: string | null;
  name: string;
  description: string | null;
  kind: string;
  status: string;
  priority: number;
  stopOnMatch: boolean;
  matchMode: string;
  triggerType: string;
  triggerConfig: unknown;
  conditions: unknown;
  actions: unknown;
  graph: unknown;
  quietHours: unknown;
  frequencyCap: unknown;
  lastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function parseJsonArray<T>(
  raw: unknown,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }
): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const result = schema.safeParse(entry);
    return result.success ? [result.data] : [];
  });
}

function parseGraph(raw: unknown): AutomationDto["graph"] {
  if (!raw || typeof raw !== "object") return null;
  const graph = raw as { nodes?: unknown; edges?: unknown };
  return {
    nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
    edges: Array.isArray(graph.edges) ? graph.edges : [],
  };
}

export function toAutomationDto(
  row: AutomationRowLike,
  runs: AutomationRunStats = { runsToday: 0, sentToday: 0, runsTotal: 0, lastRunAt: null }
): AutomationDto {
  // A trigger that no longer validates (its type was removed, or its config
  // predates a required field) still has to render, or the rule becomes
  // impossible to open and therefore impossible to fix. `message.received` is
  // the safest stand-in: it is the least specific trigger and always valid.
  const trigger = triggerSchema.safeParse({
    type: row.triggerType,
    ...(typeof row.triggerConfig === "object" && row.triggerConfig !== null
      ? (row.triggerConfig as Record<string, unknown>)
      : {}),
  });

  return {
    automationId: row.automationId,
    chatbotId: row.chatbotId,
    name: row.name,
    description: row.description,
    kind: row.kind,
    status: row.status,
    priority: row.priority,
    stopOnMatch: row.stopOnMatch,
    matchMode: row.matchMode === "any" ? "any" : "all",
    trigger: trigger.success ? trigger.data : { type: "message.received" },
    conditions: parseJsonArray(row.conditions, conditionSchema),
    actions: parseJsonArray(row.actions, actionSchema),
    graph: parseGraph(row.graph),
    quietHours: quietHoursSchema.parse(row.quietHours ?? {}),
    frequencyCap: frequencyCapSchema.parse(row.frequencyCap ?? {}),
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    runs,
  };
}
