"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent } from "@/lib/domain/observability";
import type { ObservabilityReport } from "@/lib/domain/observability";
import { BarTable, type BarTableRow } from "./BarTable";
import { taskLabel } from "./task-labels";

/**
 * Cost by task — where the AI budget actually goes, by kind of work.
 *
 * This is the question the `task` column was added for, and the reason it is
 * worth a panel of its own: charged chats and uncharged background work look
 * identical in a single "API cost" total, but only one of them earns anything.
 *
 * Rows are ranked by cost. The badge column carries the fallback rate, and shows
 * "—" rather than 0% when the rate is undefined for that task.
 */
export function CostByTaskPanel({ report }: { report: ObservabilityReport }) {
  const { t } = useTranslation("observability");

  const rows: BarTableRow[] = report.byTask.map((row) => {
    const label = taskLabel(row.task);

    return {
      key: row.task,
      label: t(label.key, label.fallback),
      hint: t("byTask.hint", "{{calls}} calls · {{tokens}} tokens", {
        calls: row.calls.toLocaleString(),
        tokens: row.totalTokens.toLocaleString(),
      }),
      value: `৳${row.costBdt.toLocaleString()}`,
      magnitude: row.costBdt,
      badge: (
        <FallbackBadge
          rate={row.fallbackRate}
          fallbackCount={row.fallbackCount}
          emptyLabel={t("byTask.fallbackNone", "—")}
        />
      ),
    };
  });

  return (
    <Card className="border-border bg-card/60 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          {t("byTask.title", "Cost by Task")}
        </CardTitle>
        <CardDescription>
          {t(
            "byTask.description",
            "Only Chat is billed to the merchant. Every other row here is spend the platform absorbs.",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BarTable
          rows={rows}
          labelHeading={t("byTask.colTask", "Task")}
          valueHeading={t("byTask.colCost", "Cost (BDT)")}
          badgeHeading={t("byTask.colFallback", "Fallback")}
          emptyMessage={t("byTask.empty", "No AI calls were logged in this window.")}
        />
      </CardContent>
    </Card>
  );
}

/** The fallback rate for one row, or a dash when the rate is undefined. */
function FallbackBadge({
  rate,
  fallbackCount,
  emptyLabel,
}: {
  rate: number | null;
  fallbackCount: number;
  emptyLabel: string;
}) {
  if (rate === null) {
    return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;
  }

  const isNotable = fallbackCount > 0;

  return (
    <Badge
      variant="outline"
      className={
        isNotable
          ? "bg-warning/10 text-warning border-warning/30 text-[11px] font-semibold"
          : "text-muted-foreground border-border text-[11px]"
      }
    >
      {formatPercent(rate)}
    </Badge>
  );
}
