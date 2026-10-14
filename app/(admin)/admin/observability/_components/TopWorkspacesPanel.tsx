"use client";

import { AlertTriangle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarginCell } from "@/components/admin/workspaces/MarginCell";
import type { ObservabilityReport } from "@/lib/domain/observability";

/**
 * The workspaces spending the most on AI, priced against what they pay.
 *
 * ── Why this is the panel that matters ───────────────────────────────────────
 * Cost on its own is not a problem; cost against revenue is. A workspace can be
 * the largest line on this page and still be the healthiest account, which is why
 * revenue and margin sit in the same row rather than on another screen — reading
 * two pages to answer one question is how a wrong conclusion gets made.
 *
 * ── Honesty rules carried from the workspace screens ─────────────────────────
 *   • A workspace whose plan price cannot be read shows a stated reason, not
 *     `0%` — see `MarginCell`. Its cost still counts, because cost is measured.
 *   • Calls that carry no workspace id are kept as their own row rather than
 *     dropped: unattributed spend is a fact about the platform, and hiding it
 *     would make the ranked list sum to less than the total above it.
 *   • A list is shown only for the top N; the description says so, and the total
 *     row above is the full figure, so no reader mistakes this for the whole.
 */
export function TopWorkspacesPanel({ report }: { report: ObservabilityReport }) {
  const { t } = useTranslation("observability");

  return (
    <Card className="border-border bg-card/60 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          {t("topWorkspaces.title", "Top Workspaces by Cost")}
        </CardTitle>
        <CardDescription>
          {t(
            "topWorkspaces.description",
            "The {{total}} workspaces spending the most in this window, against the plan each one pays for.",
            { total: report.topWorkspaces.length },
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {report.topWorkspaces.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("topWorkspaces.empty", "No workspace spend was logged in this window.")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-3 pr-4 font-semibold">
                    {t("topWorkspaces.colWorkspace", "Workspace")}
                  </th>
                  <th className="py-3 pr-4 text-right font-semibold">
                    {t("topWorkspaces.colCalls", "Calls")}
                  </th>
                  <th className="py-3 pr-4 text-right font-semibold">
                    {t("topWorkspaces.colCost", "Cost")}
                  </th>
                  <th className="py-3 pr-4 text-right font-semibold">
                    {t("topWorkspaces.colRevenue", "Plan Revenue")}
                  </th>
                  <th className="py-3 pr-4 font-semibold">
                    {t("topWorkspaces.colMargin", "Profit / Margin")}
                  </th>
                  <th className="py-3 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {report.topWorkspaces.map((row) => {
                  const economics = row.economics;
                  const isHighCost = economics?.isHighCostAlert === true;
                  // Calls the pipeline could not attribute to a workspace keep a
                  // row of their own — see the note above — and have nothing to
                  // link to.
                  const key = row.workspaceId ?? "__unattributed__";

                  return (
                    <tr key={key} className="transition-colors hover:bg-muted/30">
                      <td className="py-3 pr-4 align-middle">
                        <div className="flex items-center gap-2">
                          {row.workspaceId ? (
                            <Link
                              href={`/admin/workspaces/${row.workspaceId}`}
                              className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
                            >
                              {row.name}
                            </Link>
                          ) : (
                            <span className="font-medium text-muted-foreground">{row.name}</span>
                          )}
                          {isHighCost && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-warning/30 bg-warning/10 text-[10px] font-semibold text-warning"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {t("topWorkspaces.highCost", "High Cost")}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {row.ownerEmail
                            ? `${row.ownerEmail} · ${row.plan ?? "—"}`
                            : t("topWorkspaces.unattributed", "No workspace id on these calls")}
                        </p>
                      </td>

                      <td className="py-3 pr-4 text-right align-middle tabular-nums text-muted-foreground">
                        {row.calls.toLocaleString()}
                      </td>

                      <td className="py-3 pr-4 text-right align-middle font-medium tabular-nums text-foreground">
                        ৳{row.costBdt.toLocaleString()}
                      </td>

                      <td className="py-3 pr-4 text-right align-middle tabular-nums text-foreground">
                        {economics && economics.revenueBasis === "plan"
                          ? `৳${economics.revenueBdt.toLocaleString()}`
                          : "—"}
                      </td>

                      <td className="py-3 pr-4 align-middle">
                        {economics ? (
                          <MarginCell
                            marginPercent={economics.netMarginPercent}
                            netProfitBdt={economics.netProfitBdt}
                            basis={economics.revenueBasis}
                            namespace="observability"
                            keyBase="topWorkspaces"
                          />
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {t("topWorkspaces.noPlan", "No owner plan on record")}
                          </span>
                        )}
                      </td>

                      <td className="py-3 text-right align-middle">
                        {row.workspaceId && (
                          <Link
                            href={`/admin/workspaces/${row.workspaceId}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            {t("topWorkspaces.open", "Open")}
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
