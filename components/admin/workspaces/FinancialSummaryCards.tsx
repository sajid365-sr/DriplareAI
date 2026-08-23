"use client";

import { motion } from "framer-motion";
import { DollarSign, AlertTriangle, TrendingUp, Cpu, CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface KpiSummaryData {
  totalWorkspaces: number;
  totalMrrBdt: number;
  totalApiCostUsd: number;
  totalApiCostBdt: number;
  totalNetProfitBdt: number;
  overallMarginPercent: number;
  highCostAlertCount: number;
}

interface FinancialSummaryCardsProps {
  summary: KpiSummaryData;
  loading?: boolean;
}

export function FinancialSummaryCards({ summary, loading = false }: FinancialSummaryCardsProps) {
  const { t } = useTranslation("admin");

  const cards = [
    {
      title: t("workspaces.kpi.mrr", "Total Monthly Revenue (MRR)"),
      value: `৳${summary.totalMrrBdt.toLocaleString()}`,
      subtext: `${summary.totalWorkspaces} active workspaces`,
      icon: DollarSign,
      color: "from-emerald-500/20 to-teal-500/10 text-emerald-500 border-emerald-500/20",
    },
    {
      title: t("workspaces.kpi.apiCost", "Total OpenRouter API Cost"),
      value: `৳${summary.totalApiCostBdt.toLocaleString()}`,
      subtext: `$${summary.totalApiCostUsd.toLocaleString()} USD total`,
      icon: Cpu,
      color: "from-blue-500/20 to-indigo-500/10 text-blue-500 border-blue-500/20",
    },
    {
      title: t("workspaces.kpi.netProfit", "Platform Net Margin"),
      value: `${summary.overallMarginPercent}%`,
      subtext: summary.totalNetProfitBdt >= 0
        ? `+৳${summary.totalNetProfitBdt.toLocaleString()} Net Profit`
        : `-৳${Math.abs(summary.totalNetProfitBdt).toLocaleString()} Loss`,
      icon: TrendingUp,
      color: summary.overallMarginPercent >= 50
        ? "from-violet-500/20 to-purple-500/10 text-violet-500 border-violet-500/20"
        : summary.overallMarginPercent >= 0
        ? "from-amber-500/20 to-yellow-500/10 text-amber-500 border-amber-500/20"
        : "from-rose-500/20 to-red-500/10 text-rose-500 border-rose-500/20",
    },
    {
      title: t("workspaces.kpi.highCostAlerts", "High-Cost Risk Alert"),
      value: `${summary.highCostAlertCount}`,
      subtext: summary.highCostAlertCount > 0
        ? `${summary.highCostAlertCount} workspace(s) exceeding margin limit`
        : "All workspaces healthy",
      icon: AlertTriangle,
      color: summary.highCostAlertCount > 0
        ? "from-rose-500/20 to-amber-500/10 text-rose-500 border-rose-500/30"
        : "from-emerald-500/20 to-emerald-500/10 text-emerald-500 border-emerald-500/20",
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
              "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 backdrop-blur-xl transition-all hover:shadow-lg",
              card.color
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
