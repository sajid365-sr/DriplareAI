"use client";

import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent } from "@/lib/domain/observability";
import type { ObservabilityReport } from "@/lib/domain/observability";
import { BarTable, type BarTableRow } from "./BarTable";

/**
 * Where the cost figures came from — the confidence behind the headline number.
 *
 * ── Why this belongs on a cost dashboard ─────────────────────────────────────
 * `AIUsageLog.costSource` records how each row's cost was arrived at:
 *
 *   `exact`     — the provider told us what it charged.
 *   `estimated` — computed from token counts and a price table.
 *   `allocated` — split across a call that covered several operations.
 *
 * A spend total that is 90% `estimated` is a different kind of number from one
 * that is 90% `exact`, even when the two totals are identical, and an operator
 * deciding whether to trust the margin column above needs to know which one they
 * have. So the provenance is shown as its own breakdown rather than being folded
 * invisibly into the sum.
 */
export function CostSourcePanel({ report }: { report: ObservabilityReport }) {
  const { t } = useTranslation("observability");

  const totalCostBdt = report.byCostSource.reduce((sum, row) => sum + row.costBdt, 0);

  const rows: BarTableRow[] = report.byCostSource.map((row) => {
    const label = COST_SOURCE_LABELS[row.source] ?? {
      key: "costSource.other",
      fallback: row.source,
    };

    return {
      key: row.source,
      label: t(label.key, label.fallback),
      hint: t("costSource.hint", "{{calls}} calls · {{share}} of spend", {
        calls: row.calls.toLocaleString(),
        share: formatPercent(totalCostBdt > 0 ? row.costBdt / totalCostBdt : null) ?? "—",
      }),
      value: `৳${row.costBdt.toLocaleString()}`,
      magnitude: row.costBdt,
    };
  });

  return (
    <Card className="border-border bg-card/60 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          {t("costSource.title", "Cost Provenance")}
        </CardTitle>
        <CardDescription>
          {t(
            "costSource.description",
            "How each cost figure was arrived at. Estimated and allocated totals are computed from token counts rather than reported by the provider.",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BarTable
          rows={rows}
          labelHeading={t("costSource.colSource", "Source")}
          valueHeading={t("costSource.colCost", "Cost (BDT)")}
          toneClass="bg-chart-3"
          emptyMessage={t("costSource.empty", "No cost rows were logged in this window.")}
        />
      </CardContent>
    </Card>
  );
}

/**
 * Display names for `costSource` values. The three the schema writes are known;
 * anything else falls through to its raw value rather than being mislabelled,
 * because a source this code has not heard of must not be given a confident name.
 */
const COST_SOURCE_LABELS: Record<string, { key: string; fallback: string }> = {
  exact: { key: "costSource.exact", fallback: "Exact — provider reported" },
  estimated: { key: "costSource.estimated", fallback: "Estimated — from tokens" },
  allocated: { key: "costSource.allocated", fallback: "Allocated — split across calls" },
};
