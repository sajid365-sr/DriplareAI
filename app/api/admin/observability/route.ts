import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/core/admin-auth";
import { OBSERVABILITY_TASKS, type ObservabilityTask } from "@/lib/domain/observability";
import { getObservabilityChannels, getObservabilityReport } from "@/lib/services/observability";

/**
 * GET /api/admin/observability
 *
 * The report behind `/admin/observability`. Read-only: it issues no writes and
 * touches no schema.
 *
 * Query parameters — all optional:
 *   days     window length, default 30, capped at 365
 *   from/to  explicit ISO bounds, overriding `days`
 *   task     one task bucket, including "other"
 *   channel  one channel value, as stored
 *
 * Unrecognised values are ignored rather than rejected, so a stale bookmark
 * showing a task that no longer exists still renders a page instead of an error.
 * The response carries the channel list so the UI can build its filter from real
 * data rather than a hardcoded list that drifts.
 */

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;
const MS_PER_DAY = 86_400_000;

export async function GET(req: Request) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const url = new URL(req.url);
    const parsedDays = parseInt(url.searchParams.get("days") ?? "", 10);
    const days = Number.isFinite(parsedDays)
      ? Math.min(MAX_DAYS, Math.max(1, parsedDays))
      : DEFAULT_DAYS;

    const to = parseInstant(url.searchParams.get("to")) ?? new Date();
    let from = parseInstant(url.searchParams.get("from")) ?? new Date(to.getTime() - days * MS_PER_DAY);

    // An inverted window would return nothing and look like an outage, so the
    // bounds are put back in order instead of being passed through.
    if (from.getTime() > to.getTime()) from = new Date(to.getTime() - days * MS_PER_DAY);

    const taskParam = url.searchParams.get("task");
    const task =
      taskParam && OBSERVABILITY_TASKS.includes(taskParam as ObservabilityTask)
        ? (taskParam as ObservabilityTask)
        : undefined;

    // Empty string means "no filter", not "the channel whose name is empty".
    const channel = url.searchParams.get("channel")?.trim() || undefined;

    const [report, channels] = await Promise.all([
      getObservabilityReport({ from, to, task, channel }, days),
      getObservabilityChannels({ from, to }),
    ]);

    return NextResponse.json({ ...report, channels });
  } catch (error) {
    console.error("[ADMIN_OBSERVABILITY_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

/** Parse an ISO instant, or `null` when the value is missing or not a date. */
function parseInstant(value: string | null): Date | null {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
