"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Info, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ObservabilityReport, ObservabilityTask } from "@/lib/domain/observability";
import { CostByModelPanel } from "./_components/CostByModelPanel";
import { CostByTaskPanel } from "./_components/CostByTaskPanel";
import { CostSourcePanel } from "./_components/CostSourcePanel";
import { ObservabilityFilters, type RangePreset } from "./_components/ObservabilityFilters";
import { ObservabilityKpiCards } from "./_components/ObservabilityKpiCards";
import { ReliabilityPanel } from "./_components/ReliabilityPanel";
import { TopWorkspacesPanel } from "./_components/TopWorkspacesPanel";

/** What `GET /api/admin/observability` returns: the report plus the channel list. */
interface ObservabilityApiResponse extends ObservabilityReport {
  channels: string[];
}

/**
 * Platform observability — what the AI layer cost and how it behaved.
 *
 * ── Why the number of panels is small ────────────────────────────────────────
 * Every panel here answers a question that the others cannot, and each one names
 * what it does **not** measure. AI usage was logged for months without ever
 * being read; the risk in opening it up is not too little information but a wall
 * of figures nobody can act on. So the page shows cost by task, by model, by
 * workspace, and by provenance, then the two reliability signals the log can
 * support — and stops.
 *
 * ── Honesty rules this page is built on ──────────────────────────────────────
 *   • A missing measurement renders as "—", never as 0.
 *   • A rate with no denominator renders as "—", never as 0%.
 *   • A workspace whose plan price is unknown shows *why*, not a margin.
 *   • Fallback is labelled a fallback rate, never a success rate — a failed call
 *     writes no row, so success cannot be computed from this table at all.
 *
 * Read-only throughout: it issues no writes and no schema changes.
 */
export default function AdminObservabilityPage() {
  const { t } = useTranslation("observability");

  const [days, setDays] = useState<RangePreset>(30);
  const [task, setTask] = useState<ObservabilityTask | "all">("all");
  const [channel, setChannel] = useState("");
  const [report, setReport] = useState<ObservabilityApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (task !== "all") params.set("task", task);
      if (channel) params.set("channel", channel);

      const res = await fetch(`/api/admin/observability?${params}`);
      if (!res.ok) throw new Error(`Observability request failed with ${res.status}`);

      setReport((await res.json()) as ObservabilityApiResponse);
      setFailed(false);
    } catch {
      // The previous report is deliberately left on screen — a failed refresh
      // should not turn a page an operator was reading into an empty one.
      setFailed(true);
      toast.error(t("loadError", "Failed to load observability data"));
    } finally {
      setLoading(false);
    }
  }, [days, task, channel, t]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const showSkeleton = loading && !report;

  return (
    <div className="space-y-6">
      {/* ── Page title ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("title", "AI Observability")}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t(
            "description",
            "What every AI call cost, which model and workspace it belongs to, and how the pipeline behaved.",
          )}
        </p>
      </motion.div>

      {/* ── Filters: one row, above everything they scope ──────────────────── */}
      <ObservabilityFilters
        days={days}
        onDaysChange={setDays}
        task={task}
        onTaskChange={setTask}
        channel={channel}
        onChannelChange={setChannel}
        channels={report?.channels ?? []}
        onRefresh={() => void fetchReport()}
        loading={loading}
      />

      {failed && (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-destructive">
            {t(
              "loadErrorDetail",
              "The latest figures could not be loaded. Anything shown below is from the previous successful request.",
            )}
          </p>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void fetchReport()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {t("retry", "Retry")}
          </Button>
        </div>
      )}

      {showSkeleton ? (
        <ObservabilitySkeleton />
      ) : !report ? (
        <Card className="border-border bg-card/60 backdrop-blur-xl">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t("emptyNoReport", "No observability data is available for this window.")}
          </CardContent>
        </Card>
      ) : (
        <>
          <ObservabilityKpiCards report={report} />

          {/* Historical rows recorded the task name in the `channel` column
              before `task` existed. The service reconciles the two so this spend
              is not lost — and says here how much of the window that affected,
              because a figure whose provenance is hidden is a figure nobody can
              audit. */}
          {report.totals.legacyTaskRows > 0 && (
            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              {t(
                "legacyRowsNotice",
                "{{rows}} older rows predate the task column; their task was read from the channel field they were stored in.",
                { rows: report.totals.legacyTaskRows.toLocaleString() },
              )}
            </p>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            <CostByTaskPanel report={report} />
            <CostByModelPanel report={report} />
          </div>

          <TopWorkspacesPanel report={report} />

          <ReliabilityPanel report={report} />

          <CostSourcePanel report={report} />
        </>
      )}
    </div>
  );
}

/** Placeholder geometry that matches the loaded page, to avoid a layout jump. */
function ObservabilitySkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <Skeleton className="h-72 rounded-2xl" />
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}
