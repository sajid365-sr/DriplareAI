import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/core/db";
import { getUsdToBdtRate } from "@/lib/ai/credit-resolver";
import { AI_TASKS } from "@/lib/domain/ai-task";
import {
  OTHER_TASK,
  OBSERVABILITY_TASKS,
  resolveObservabilityTask,
  summarizeFallbacks,
  summarizeLatency,
  taskCameFromLegacyChannel,
  usdToBdt,
  type CostSourceRow,
  type ModelBreakdownRow,
  type ObservabilityReport,
  type ObservabilityTask,
  type TaskBreakdownRow,
  type WorkspaceCostRow,
} from "@/lib/domain/observability";
import { computeUnitEconomics } from "@/lib/domain/unit-economics";

/**
 * Observability queries
 * ─────────────────────────────────────────────────────────────────────────────
 * Everything the observability screens show is derived here, in the database,
 * and the reason is scale rather than taste: `app/api/usage/route.ts` aggregates
 * a single merchant's logs in memory, which is fine for one merchant, but this
 * panel covers every workspace at once. `AIUsageLog` gets a row per AI call.
 *
 * ── What this module deliberately does not do ─────────────────────────────────
 *   • It never sums the stored `costBdt`. That column is written at the rate in
 *     force on the day of the call, so summing it mixes rates. Only `costUsd` is
 *     summed, and it is converted to BDT once, at read time, at the live rate.
 *   • It writes nothing. Read-only by construction — every call below is a
 *     `find`, `count`, `aggregate` or `groupBy`.
 *   • It does not compute a success or failure rate, because the data cannot
 *     support one: `lib/ai/gateway.ts` writes a row only after a model chain
 *     succeeds, so failed calls leave no trace. `summarizeFallbacks` is the
 *     measurable substitute and says so.
 */

/**
 * Ceiling on the latency sample fetched for percentile calculation.
 *
 * ⚠️ Percentiles are computed in `lib/domain/observability.ts` rather than with
 *    Postgres' `percentile_cont`, on purpose: one filter definition would
 *    otherwise have to be expressed twice — once as a Prisma `where` and once as
 *    raw SQL — and two definitions of "the same rows" drift apart silently, which
 *    is the class of bug this whole task is about. The measured set is small by
 *    construction anyway (only app-gateway calls are timed). If n8n ever sends
 *    `latencyMs`, this belongs in the database and this constant is the signal
 *    that the time has come.
 */
const MAX_LATENCY_SAMPLE = 20_000;

/** How many workspaces the "costliest" list shows. The rest are still totalled. */
const TOP_WORKSPACES = 10;

export interface ObservabilityFilters {
  from: Date;
  to: Date;
  /** Restrict to one task bucket. `"other"` is a valid bucket (see the domain module). */
  task?: ObservabilityTask;
  /** Restrict to one channel value, as stored. */
  channel?: string;
}

export async function getObservabilityReport(
  filters: ObservabilityFilters,
  days: number,
): Promise<ObservabilityReport> {
  const where = buildUsageWhere(filters);
  const usdToBdtRate = await getUsdToBdtRate();

  const [totalsAgg, taskRows, fallbackRows, modelRows, workspaceRows, costSourceRows, latencyRows] =
    await Promise.all([
      db.aIUsageLog.aggregate({
        where,
        _sum: {
          totalTokens: true,
          promptTokens: true,
          completionTokens: true,
          costUsd: true,
          creditsDeducted: true,
        },
        _count: { id: true },
      }),
      db.aIUsageLog.groupBy({
        where,
        by: ["task", "channel"],
        _sum: { totalTokens: true, costUsd: true },
        _count: { id: true },
      }),
      // Only fallback rows, so the numerator is counted by the database rather
      // than derived by filtering a large list in memory.
      db.aIUsageLog.groupBy({
        where: { ...where, fallbackFrom: { not: null } },
        by: ["task", "channel"],
        _count: { id: true },
      }),
      db.aIUsageLog.groupBy({
        where,
        by: ["modelId", "model"],
        _sum: { totalTokens: true, costUsd: true },
        _count: { id: true },
        orderBy: { _sum: { costUsd: "desc" } },
      }),
      db.aIUsageLog.groupBy({
        where,
        by: ["workspaceId"],
        _sum: { totalTokens: true, costUsd: true },
        _count: { id: true },
      }),
      db.aIUsageLog.groupBy({
        where,
        by: ["costSource"],
        _sum: { costUsd: true },
        _count: { id: true },
      }),
      db.aIUsageLog.findMany({
        where: { ...where, latencyMs: { not: null } },
        select: { latencyMs: true, task: true, channel: true },
        orderBy: { createdAt: "desc" },
        take: MAX_LATENCY_SAMPLE,
      }),
    ]);

  const totalCalls = totalsAgg._count.id ?? 0;
  const totalCostUsd = totalsAgg._sum.costUsd ?? 0;

  // ── Totals ─────────────────────────────────────────────────────────────────
  const latencyValues = latencyRows.map((row) => row.latencyMs);
  const latency = summarizeLatency(latencyValues, totalCalls);

  // ── By task ────────────────────────────────────────────────────────────────
  // Tasks are resolved from `task ?? channel` on the JS side: the fold is the
  // same rule the domain module tests, and a `groupBy(["task"])` in SQL could
  // not express it without a CASE expression — a second definition of the same
  // rule, which is what we are avoiding.
  const taskAccumulator = new Map<
    ObservabilityTask,
    { calls: number; totalTokens: number; costUsd: number; fallbackCount: number; legacyTaskRows: number }
  >();

  const bucket = (task: ObservabilityTask) => {
    const existing = taskAccumulator.get(task);
    if (existing) return existing;

    const created = { calls: 0, totalTokens: 0, costUsd: 0, fallbackCount: 0, legacyTaskRows: 0 };
    taskAccumulator.set(task, created);
    return created;
  };

  for (const row of taskRows) {
    const resolved = resolveObservabilityTask(row.task, row.channel);
    const entry = bucket(resolved);

    entry.calls += row._count.id ?? 0;
    entry.totalTokens += row._sum.totalTokens ?? 0;
    entry.costUsd += row._sum.costUsd ?? 0;
    if (taskCameFromLegacyChannel(row.task, row.channel)) {
      entry.legacyTaskRows += row._count.id ?? 0;
    }
  }

  for (const row of fallbackRows) {
    const resolved = resolveObservabilityTask(row.task, row.channel);
    bucket(resolved).fallbackCount += row._count.id ?? 0;
  }

  // Latency per task comes from the same sample the overall percentiles use, so
  // the two can never disagree about what was measured.
  const latencyByTask = new Map<ObservabilityTask, number[]>();
  for (const row of latencyRows) {
    if (typeof row.latencyMs !== "number") continue;

    const resolved = resolveObservabilityTask(row.task, row.channel);
    const values = latencyByTask.get(resolved) ?? [];
    values.push(row.latencyMs);
    latencyByTask.set(resolved, values);
  }

  const byTask: TaskBreakdownRow[] = OBSERVABILITY_TASKS.filter((task) => taskAccumulator.has(task)).map(
    (task) => {
      const entry = taskAccumulator.get(task)!;
      const fallbacks = summarizeFallbacks(entry.calls, entry.fallbackCount);

      return {
        task,
        calls: entry.calls,
        totalTokens: entry.totalTokens,
        costUsd: round(entry.costUsd, 4),
        costBdt: usdToBdt(entry.costUsd, usdToBdtRate),
        fallbackCount: entry.fallbackCount,
        fallbackRate: fallbacks.rate,
        latency: summarizeLatency(latencyByTask.get(task) ?? [], entry.calls),
        legacyTaskRows: entry.legacyTaskRows,
      };
    },
  );

  // ── By model ───────────────────────────────────────────────────────────────
  const byModel: ModelBreakdownRow[] = modelRows.map((row) => {
    const calls = row._count.id ?? 0;
    const costUsd = row._sum.costUsd ?? 0;

    return {
      modelId: row.modelId || row.model || "unknown",
      modelName: row.model || row.modelId || "Unknown model",
      calls,
      totalTokens: row._sum.totalTokens ?? 0,
      costUsd: round(costUsd, 4),
      costBdt: usdToBdt(costUsd, usdToBdtRate),
      avgCostPerCallUsd: calls > 0 ? round(costUsd / calls, 6) : 0,
    };
  });

  // ── Cost provenance ────────────────────────────────────────────────────────
  const byCostSource: CostSourceRow[] = costSourceRows
    .map((row) => ({
      source: row.costSource || "unknown",
      calls: row._count.id ?? 0,
      costUsd: round(row._sum.costUsd ?? 0, 4),
      costBdt: usdToBdt(row._sum.costUsd ?? 0, usdToBdtRate),
    }))
    .sort((a, b) => b.costUsd - a.costUsd);

  // ── Workspaces ─────────────────────────────────────────────────────────────
  // Loaded by public id because `AIUsageLog.workspaceId` stores that, not the
  // row id. Owners are included so each line can be priced against its own plan.
  const workspaceIds = workspaceRows
    .map((row) => row.workspaceId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const workspaces = workspaceIds.length
    ? await db.workspace.findMany({
        where: { workspaceId: { in: workspaceIds } },
        select: {
          workspaceId: true,
          name: true,
          user: { select: { email: true, plan: true, region: true } },
        },
      })
    : [];

  const workspaceById = new Map(workspaces.map((workspace) => [workspace.workspaceId, workspace]));

  const allWorkspaces: WorkspaceCostRow[] = workspaceRows.map((row) => {
    const workspace = row.workspaceId ? workspaceById.get(row.workspaceId) : undefined;
    const costUsd = row._sum.costUsd ?? 0;

    return {
      workspaceId: row.workspaceId,
      // A call with no workspace is not a missing name — it is spend that cannot
      // be charged to anyone, which is worth seeing rather than hiding.
      name: workspace?.name ?? (row.workspaceId ? row.workspaceId : "Unattributed"),
      ownerEmail: workspace?.user.email ?? null,
      plan: workspace?.user.plan ?? null,
      region: workspace?.user.region ?? null,
      calls: row._count.id ?? 0,
      totalTokens: row._sum.totalTokens ?? 0,
      costUsd: round(costUsd, 4),
      costBdt: usdToBdt(costUsd, usdToBdtRate),
      economics: workspace
        ? computeUnitEconomics({
            plan: workspace.user.plan,
            region: workspace.user.region,
            usdToBdtRate,
            costUsd,
          })
        : null,
    };
  });

  const topWorkspaces = [...allWorkspaces].sort((a, b) => b.costUsd - a.costUsd).slice(0, TOP_WORKSPACES);

  // Platform revenue context, from every workspace in the window, not just the
  // ten on screen — and stated with the number we could not price.
  const priced = allWorkspaces.filter((row) => row.economics?.revenueBasis === "plan");

  return {
    range: {
      from: filters.from.toISOString(),
      to: filters.to.toISOString(),
      days,
    },
    totals: {
      calls: totalCalls,
      totalTokens: totalsAgg._sum.totalTokens ?? 0,
      promptTokens: totalsAgg._sum.promptTokens ?? 0,
      completionTokens: totalsAgg._sum.completionTokens ?? 0,
      costUsd: round(totalCostUsd, 4),
      costBdt: usdToBdt(totalCostUsd, usdToBdtRate),
      creditsDeducted: totalsAgg._sum.creditsDeducted ?? 0,
      workspaces: workspaceIds.length,
      legacyTaskRows: byTask.reduce((sum, row) => sum + row.legacyTaskRows, 0),
      fallback: summarizeFallbacks(
        totalCalls,
        fallbackRows.reduce((sum, row) => sum + (row._count.id ?? 0), 0),
      ),
      latency,
    },
    revenue: {
      totalMrrBdt: round(
        priced.reduce((sum, row) => sum + (row.economics?.revenueBdt ?? 0), 0),
        2,
      ),
      pricedWorkspaces: priced.length,
      unpricedWorkspaces: allWorkspaces.length - priced.length,
      usdToBdtRate,
    },
    byTask,
    byModel,
    byCostSource,
    topWorkspaces,
    latencySampleCapped: latencyRows.length >= MAX_LATENCY_SAMPLE,
  };
}

/** Every distinct channel value in the window, for the channel filter control. */
export async function getObservabilityChannels(filters: Pick<ObservabilityFilters, "from" | "to">): Promise<string[]> {
  const rows = await db.aIUsageLog.groupBy({
    where: { createdAt: { gte: filters.from, lte: filters.to } },
    by: ["channel"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  return rows.map((row) => row.channel).filter((channel): channel is string => Boolean(channel));
}

/**
 * The Prisma filter for one observability window.
 *
 * ⚠️ The task filter has to reproduce the `task ?? channel` rule **in SQL**, and
 *    it is the one place where that rule is written a second time. It is written
 *    this way — rather than filtered in JS — because the totals, the model
 *    breakdown and the workspace breakdown all have to be scoped to the same
 *    rows: filtering only the by-task table would leave the headline figures
 *    describing a different set of calls than the table beneath them. The
 *    `resolveObservabilityTask` unit tests cover the rule itself; the SQL below
 *    must agree with it, which is what `legacyTaskRows` makes visible on screen.
 */
function buildUsageWhere(filters: ObservabilityFilters): Prisma.AIUsageLogWhereInput {
  const conditions: Prisma.AIUsageLogWhereInput[] = [
    { createdAt: { gte: filters.from, lte: filters.to } },
  ];

  if (filters.channel) {
    conditions.push({ channel: filters.channel });
  }

  if (filters.task) {
    conditions.push(usageTaskFilter(filters.task));
  }

  return { AND: conditions };
}

/** The rows whose `task` column is either empty or not a task we recognise. */
const TASK_COLUMN_IS_UNSET: Prisma.AIUsageLogWhereInput = {
  OR: [{ task: null }, { task: { notIn: [...AI_TASKS] } }],
};

function usageTaskFilter(task: ObservabilityTask): Prisma.AIUsageLogWhereInput {
  if (task === OTHER_TASK) {
    // Neither column names a task: the row's kind is genuinely unknown.
    return {
      AND: [TASK_COLUMN_IS_UNSET, { channel: { notIn: [...AI_TASKS] } }],
    };
  }

  return {
    OR: [
      { task },
      // Historical rows: the task name was stored in `channel`.
      { AND: [TASK_COLUMN_IS_UNSET, { channel: task }] },
    ],
  };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
