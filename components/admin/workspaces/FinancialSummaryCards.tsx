"use client";

import { motion } from "framer-motion";
import { DollarSign, AlertTriangle, TrendingUp, Cpu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface KpiSummaryData {
  totalWorkspaces: number;
  /** Sum of plan prices we could actually read. See `revenueUnknownCount`. */
  totalMrrBdt: number;
  totalApiCostUsd: number;
  totalApiCostBdt: number;
  totalNetProfitBdt: number;
  /**
   * `null` when no workspace on this page had a knowable price, so there is no
   * revenue base to divide by. A percentage of nothing is not 0%, and it is
   * certainly not −100%.
   */
  overallMarginPercent: number | null;
  highCostAlertCount: number;
  /** Workspaces left out of MRR because their pricing is negotiated or unknown. */
  revenueUnknownCount: number;
}

interface FinancialSummaryCardsProps {
  summary: KpiSummaryData;
  loading?: boolean;
}

/**
 * Colour for the margin card.
 *
 * `null` gets the muted treatment rather than the red one, because "we cannot
 * measure this" is not the same message as "this is losing money" — colouring it
 * red would tell the operator to go and fix a problem that may not exist.
 */
function marginTone(marginPercent: number | null): string {
  if (marginPercent === null) {
    return "bg-gradient-to-br from-muted/40 to-transparent text-muted-foreground border-border";
  }
  if (marginPercent >= 50) {
    return "bg-gradient-to-br from-primary/15 to-transparent text-primary border-primary/25";
  }
  if (marginPercent >= 0) {
    return "bg-gradient-to-br from-warning/15 to-transparent text-warning border-warning/25";
  }
  return "bg-gradient-to-br from-destructive/15 to-transparent text-destructive border-destructive/25";
}

/**
 * Platform-wide unit economics.
 *
 * Every colour here comes from a CSS variable (`--success`, `--info`,
 * `--warning`, `--destructive`) so the cards follow the global theme in both
 * light and dark mode, as the project's styling rules require.
 */
export function FinancialSummaryCards({ summary, loading = false }: FinancialSummaryCardsProps) {
  const { t } = useTranslation("admin");

  const marginPercent = summary.overallMarginPercent;

  const cards = [
    {
      title: t("workspaces.kpi.mrr", "Total Monthly Revenue (MRR)"),
      value: `৳${summary.totalMrrBdt.toLocaleString()}`,
      subtext:
        summary.revenueUnknownCount > 0
          ? t("workspaces.kpi.mrrExcluded", "{{total}} workspace(s) excluded — custom pricing", {
              total: summary.revenueUnknownCount,
            })
          : t("workspaces.kpi.mrrCount", "Across {{total}} active workspace(s)", {
              total: summary.totalWorkspaces,
            }),
      icon: DollarSign,
      tone: "bg-gradient-to-br from-success/15 to-transparent text-success border-success/25",
    },
    {
      title: t("workspaces.kpi.apiCost", "Total OpenRouter API Cost"),
      value: `৳${summary.totalApiCostBdt.toLocaleString()}`,
      subtext: t("workspaces.kpi.apiCostSub", "${{usd}} USD metered", {
        usd: summary.totalApiCostUsd.toLocaleString(),
      }),
      icon: Cpu,
      tone: "bg-gradient-to-br from-info/15 to-transparent text-info border-info/25",
    },
    {
      title: t("workspaces.kpi.netProfit", "Platform Net Margin"),
      value: marginPercent === null ? "—" : `${marginPercent}%`,
      subtext:
        marginPercent === null
          ? t("workspaces.kpi.marginUnknown", "Not measurable — no readable plan pricing")
          : summary.totalNetProfitBdt >= 0
            ? t("workspaces.kpi.profitSub", "+৳{{amount}} net profit", {
                amount: summary.totalNetProfitBdt.toLocaleString(),
              })
            : t("workspaces.kpi.lossSub", "-৳{{amount}} net loss", {
                amount: Math.abs(summary.totalNetProfitBdt).toLocaleString(),
              }),
      icon: TrendingUp,
      tone: marginTone(marginPercent),
    },
    {
      title: t("workspaces.kpi.highCostAlerts", "High-Cost Risk Alert"),
      value: `${summary.highCostAlertCount}`,
      subtext:
        summary.highCostAlertCount > 0
          ? t("workspaces.kpi.alertsSome", "{{total}} workspace(s) exceeding margin limit", {
              total: summary.highCostAlertCount,
            })
          : t("workspaces.kpi.alertsNone", "All workspaces healthy"),
      icon: AlertTriangle,
      tone:
        summary.highCostAlertCount > 0
          ? "bg-gradient-to-br from-destructive/15 to-transparent text-destructive border-destructive/25"
          : "bg-gradient-to-br from-success/15 to-transparent text-success border-success/25",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;

        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: idx * 0.05 }}
            className={cn(
              "relative overflow-hidden rounded-2xl border p-5 backdrop-blur-xl transition-all hover:shadow-lg",
              card.tone
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {card.title}
              </p>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background/80 shadow-sm backdrop-blur-md">
                <Icon className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-3">
              {loading ? (
                <div className="h-8 w-24 animate-pulse rounded-lg bg-muted/60" />
              ) : (
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {card.value}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{card.subtext}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
