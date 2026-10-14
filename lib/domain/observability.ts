/**
 * Observability — the arithmetic behind the cost and reliability panels.
 *
 * ── The rule this module exists to enforce ────────────────────────────────────
 * TASK-06 established it for the health panel: a dashboard an operator trusts
 * must measure, or say nothing. This module is where that is decided for AI
 * usage, and it is pure — no database, no `server-only`, no clock — so the rules
 * can be unit-tested instead of being argued about by eye on a chart.
 *
 * Three consequences run through everything below:
 *
 *   1. **Missing is not zero.** `latencyMs` is `null` on every row written from
 *      outside the app gateway, which today is every real customer reply. Those
 *      rows are excluded from latency statistics and *counted as excluded*, so a
 *      panel can print "p95: 1.2 s (over 43 of 9,812 calls)" rather than
 *      implying it measured all of them.
 *   2. **A rate is computed, never assumed.** A fallback rate is a division with
 *      a real denominator, and it is `null` — not 0% — when the denominator is 0.
 *   3. **Rows written before a column existed still count.** `task` arrived
 *      later, and before it the task name was written into `channel`; both are
 *      read here, so historical spend does not land in an "unknown" bucket.
 */

import { AI_TASKS, isAITask, type AITask } from "@/lib/domain/ai-task";
import type { UnitEconomics } from "@/lib/domain/unit-economics";

/** Task bucket for a usage row whose kind cannot be established from either column. */
export const OTHER_TASK = "other" as const;

export type ObservabilityTask = AITask | typeof OTHER_TASK;

/**
 * Which kind of work a usage row paid for.
 *
 * ⚠️ `channel` is overloaded in historical data. `AIUsageLog.channel` was
 *    originally documented as "facebook, whatsapp, instagram, web", but rows for
 *    background work (`enhance_prompt`, `compare`, `auto_train`, `text_ingest`)
 *    were also written there, because there was nowhere else to put them —
 *    `AI_TASK_POLICY[task].legacyChannel` is that history written down. So when
 *    `task` is absent, a `channel` that names a known task is read as the task.
 *
 * Order matters: a real `task` always wins, because a new row's `channel` is a
 * genuine channel (`facebook`) and never a task name.
 */
export function resolveObservabilityTask(
  task: string | null | undefined,
  channel: string | null | undefined,
): ObservabilityTask {
  if (isAITask(task)) return task;
  if (isAITask(channel)) return channel;

  return OTHER_TASK;
}

/** True when the row's kind had to be read from the overloaded `channel` column. */
export function taskCameFromLegacyChannel(
  task: string | null | undefined,
  channel: string | null | undefined,
): boolean {
  return !isAITask(task) && isAITask(channel);
}

/** Every task bucket a panel can be asked to render, in a stable order. */
export const OBSERVABILITY_TASKS: ObservabilityTask[] = [...AI_TASKS, OTHER_TASK];

/**
 * A percentile from a list of measurements, using linear interpolation between
 * the two nearest ranks (the same method as Postgres' `percentile_cont`).
 *
 * ⚠️ The whole point of p95 over an average is that it does not hide the tail,
 *    so this must not quietly fall back to a mean for small samples. With one
 *    measurement, p50 and p95 are both that measurement — which is honest: the
 *    tail is the whole sample.
 *
 * Returns `null` for an empty list. An empty set has no 95th percentile, and
 * returning 0 would be read as "instant".
 */
export function percentile(values: number[], percentileRank: number): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const clampedRank = Math.min(1, Math.max(0, percentileRank));
  const position = clampedRank * (sorted.length - 1);

  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const weight = position - lowerIndex;

  const lower = sorted[lowerIndex];
  const upper = sorted[upperIndex];

  return lower + (upper - lower) * weight;
}

export interface LatencyStats {
  /** How many rows actually carried a measurement. */
  sampleCount: number;
  /** How many rows were in scope in total, measured or not. */
  totalCount: number;
  /** Share of in-scope rows that carried a measurement, 0–1. */
  coverage: number;
  /** `null` when nothing was measured — never 0, which would read as "instant". */
  avgMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
}

/**
 * Summarise a set of latencies, stating plainly how much of the set was measured.
 *
 * `coverage` is the part that keeps this honest. Only calls made through
 * `lib/ai/gateway.ts` are timed, so on a workspace whose traffic arrives through
 * n8n the sample can be a tiny fraction of the messages — a p95 over 12 calls
 * out of 9,000 is not a p95 of the workspace, and the panel needs the numbers to
 * say so rather than the operator having to guess.
 */
export function summarizeLatency(measurements: Array<number | null | undefined>, totalCount: number): LatencyStats {
  const values = measurements.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const sampleCount = values.length;

  const scope = totalCount > 0 ? totalCount : sampleCount;

  return {
    sampleCount,
    totalCount: scope,
    coverage: scope > 0 ? sampleCount / scope : 0,
    avgMs: sampleCount > 0 ? values.reduce((sum, value) => sum + value, 0) / sampleCount : null,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    maxMs: sampleCount > 0 ? Math.max(...values) : null,
  };
}

export interface RateStats {
  /** `null` when the denominator is 0 — an undefined rate, not a zero one. */
  rate: number | null;
  count: number;
  total: number;
}

/**
 * A share of a whole, or `null` when there is no whole to divide by.
 *
 * Kept separate from the fallback maths so it can be reused for any proportion —
 * measured latency, reconciled cost rows — and tested once.
 */
export function rate(count: number, total: number): RateStats {
  return { rate: total > 0 ? count / total : null, count, total };
}

export interface FallbackStats extends RateStats {
  /**
   * ⚠️ This is **not** a success rate, and the UI must not call it one.
   *
   * A failed call writes no `AIUsageLog` row at all: `lib/ai/gateway.ts` logs
   * only after a model chain resolves, so a call where every model failed is
   * invisible here. A fallback row, by contrast, is a call that was rescued.
   * So the useful measured signal is "how often the first-choice model did not
   * answer" — which is what `fallbackFrom` records — and it says nothing about
   * calls that failed outright. Measuring those needs a failure ledger, which
   * would mean a new table.
   */
  fallbackCount: number;
}

/** How often the first-choice model did not answer, over the rows we have. */
export function summarizeFallbacks(totalCount: number, fallbackCount: number): FallbackStats {
  return { ...rate(fallbackCount, totalCount), fallbackCount };
}

/**
 * Latency as a person reads it: milliseconds below a second, seconds above.
 *
 * `null` in, `null` out — the caller renders a dash. Formatting a missing
 * measurement as "0 ms" is the single most misleading thing this panel could do,
 * because it looks like the fastest possible response.
 */
export function formatLatency(ms: number | null | undefined): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** A share as a display string, or `null` when it is undefined. */
export function formatPercent(value: number | null | undefined, decimals = 1): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${(value * 100).toFixed(decimals)}%`;
}

/** USD to BDT at the live rate, rounded to the two decimals money is shown in. */
export function usdToBdt(costUsd: number, rate: number): number {
  return Math.round(costUsd * rate * 100) / 100;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * The shape of an observability report.
 *
 * These interfaces live here, in the pure module, rather than beside the service
 * that fills them in. The admin UI is a client component, and a client component
 * that imported the report type from `lib/services/observability.ts` would pull
 * that module's `server-only` guard into the browser bundle and fail the build.
 * Declaring the contract on the pure side keeps the service free to use Prisma.
 * ────────────────────────────────────────────────────────────────────────────── */

/** The window a report covers. Always resolved to concrete instants before use. */
export interface ObservabilityRange {
  /** ISO timestamp, inclusive. */
  from: string;
  /** ISO timestamp, inclusive. */
  to: string;
  days: number;
}

/** Why a set of calls exists, as far as the log can tell. */
export interface TaskBreakdownRow {
  task: ObservabilityTask;
  calls: number;
  totalTokens: number;
  costUsd: number;
  costBdt: number;
  fallbackCount: number;
  fallbackRate: number | null;
  latency: LatencyStats;
  /**
   * How many of these rows had their task read out of the legacy `channel`
   * column instead of the `task` column — i.e. how much of this line is history.
   */
  legacyTaskRows: number;
}

export interface ModelBreakdownRow {
  modelId: string;
  modelName: string;
  calls: number;
  totalTokens: number;
  costUsd: number;
  costBdt: number;
  /** Average spend per call — what makes a cheap model used constantly visible. */
  avgCostPerCallUsd: number;
}

export interface CostSourceRow {
  /** `exact` | `estimated` | `allocated` — how the cost figure was arrived at. */
  source: string;
  calls: number;
  costUsd: number;
  costBdt: number;
}

/** One workspace's spend, priced against its own plan. */
export interface WorkspaceCostRow {
  /** The workspace's public id, or `null` for calls not attributed to one. */
  workspaceId: string | null;
  name: string;
  ownerEmail: string | null;
  plan: string | null;
  region: string | null;
  calls: number;
  totalTokens: number;
  costUsd: number;
  costBdt: number;
  /**
   * Revenue, profit and margin for this workspace, from the same helper the
   * workspace admin screens use. `netProfitBdt` and `netMarginPercent` are
   * `null` when the plan price cannot be read.
   */
  economics: UnitEconomics | null;
}

export interface ObservabilityTotals {
  calls: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  costBdt: number;
  creditsDeducted: number;
  /** Workspaces with at least one call in the window. */
  workspaces: number;
  /** How many rows' tasks had to be read from the legacy `channel` column. */
  legacyTaskRows: number;
  fallback: FallbackStats;
  latency: LatencyStats;
}

/** Revenue context for the window, stated with its own uncertainty. */
export interface ObservabilityRevenue {
  /** Sum of plan prices that could be read, in BDT. */
  totalMrrBdt: number;
  /** Workspaces counted in `totalMrrBdt`. */
  pricedWorkspaces: number;
  /** Workspaces left out because their plan price is negotiated or unknown. */
  unpricedWorkspaces: number;
  usdToBdtRate: number;
}

export interface ObservabilityReport {
  range: ObservabilityRange;
  totals: ObservabilityTotals;
  revenue: ObservabilityRevenue;
  byTask: TaskBreakdownRow[];
  byModel: ModelBreakdownRow[];
  byCostSource: CostSourceRow[];
  topWorkspaces: WorkspaceCostRow[];
  /**
   * True when the latency sample hit its cap, so the percentiles describe the
   * most recent N measured calls rather than all of them.
   */
  latencySampleCapped: boolean;
}
