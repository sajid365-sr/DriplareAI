"use client";

import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ObservabilityReport } from "@/lib/domain/observability";
import { BarTable, type BarTableRow } from "./BarTable";

/**
 * Cost by model — which model actually consumes the budget.
 *
 * Ranked by total spend, which is not the same as ranked by price: a model can be
 * the cheapest per call and still the largest line here because it answers every
 * message. So the hint under each name carries both numbers, and the panel says
 * out loud that the ranking is total, not unit price — otherwise a reader
 * concludes the top row is the expensive model and optimises the wrong thing.
 */
export function CostByModelPanel({ report }: { report: ObservabilityReport }) {
  const { t } = useTranslation("observability");

  const rows: BarTableRow[] = report.byModel.map((row) => ({
    key: row.modelId,
    label: row.modelName,
    hint: t("byModel.hint", "{{calls}} calls · ৳{{perCall}} avg per call", {
      calls: row.calls.toLocaleString(),
      perCall: (row.avgCostPerCallUsd * report.revenue.usdToBdtRate).toFixed(2),
    }),
    value: `৳${row.costBdt.toLocaleString()}`,
    magnitude: row.costBdt,
  }));

  return (
    <Card className="border-border bg-card/60 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          {t("byModel.title", "Cost by Model")}
        </CardTitle>
        <CardDescription>
          {t(
            "byModel.description",
            "Ranked by total spend, not by price per call — a cheap model answering everything can outrank an expensive one used rarely.",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BarTable
          rows={rows}
          labelHeading={t("byModel.colModel", "Model")}
          valueHeading={t("byModel.colCost", "Cost (BDT)")}
          toneClass="bg-chart-2"
          emptyMessage={t("byModel.empty", "No model spend was logged in this window.")}
        />
      </CardContent>
    </Card>
  );
}
