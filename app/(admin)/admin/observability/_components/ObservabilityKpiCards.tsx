"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Activity, Coins, Cpu, GitBranch } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatPercent } from "@/lib/domain/observability";
import type { ObservabilityReport } from "@/lib/domain/observability";
import { cn } from "@/lib/utils";

/**
 * The four headline numbers for the window.
 *
 * These are stat tiles, not charts: each one is a single number, and drawing a
 * plot around a lone figure is the most common way a dashboard misses its point.
 * Values use proportional figures, because equal-width digits make a large number
 * look loose at display size.
 *
 * ⚠️ The fallback tile is labelled as a **fallback** rate, never a success rate.
 *    A call where every model failed writes no usage row at all, so it cannot
 *    appear in this or any other figure on the page — see the note in
 *    `lib/domain/observability.ts`.
 */
export function ObservabilityKpiCards({ report }: { report: ObservabilityReport }) {
  const { t } = useTranslation("observability");
  const prefersReducedMotion = useReducedMotion();

  const { totals, revenue } = report;
  const fallbackRate = formatPercent(totals.fallback.rate);

  const cards = [
    {
      key: "cost",
      title: t("kpi.costTitle", "Total AI Cost"),
      value: `৳${totals.costBdt.toLocaleString()}`,
      hint: t("kpi.costHint", "${{usd}} USD metered at ৳{{rate}}/USD", {
        usd: totals.costUsd.toFixed(2),
        rate: revenue.usdToBdtRate,
      }),
      icon: Coins,
      tone: "text-info",
    },
    {
      key: "calls",
      title: t("kpi.callsTitle", "AI Calls"),
      value: totals.calls.toLocaleString(),
      // `total`, not `count`: i18next reads a `count` variable as a request for
      // plural forms, and this label does not need a plural table in two
      // languages to say "Across 3 workspace(s)".
      hint: t("kpi.callsHint", "Across {{total}} workspace(s)", { total: totals.workspaces }),
      icon: Cpu,
      tone: "text-primary",
    },
    {
      key: "tokens",
      title: t("kpi.tokensTitle", "Tokens Processed"),
      value: totals.totalTokens.toLocaleString(),
      hint: t("kpi.tokensHint", "{{prompt}} in / {{completion}} out", {
        prompt: totals.promptTokens.toLocaleString(),
        completion: totals.completionTokens.toLocaleString(),
      }),
      icon: Activity,
      tone: "text-chart-1",
    },
    {
      key: "fallback",
      title: t("kpi.fallbackTitle", "Fallback Rate"),
      // "—" rather than 0%: with no calls logged in the window there is no rate,
      // and 0% would claim the first-choice model always answered.
      value: fallbackRate ?? "—",
      hint:
        totals.fallback.rate === null
          ? t("kpi.fallbackNoCalls", "No calls logged in this window")
          : t("kpi.fallbackHint", "{{count}} of {{total}} logged calls", {
              count: totals.fallback.count,
              total: totals.fallback.total.toLocaleString(),
            }),
      icon: GitBranch,
      tone: totals.fallback.count > 0 ? "text-warning" : "text-muted-foreground",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => {
        const Icon = card.icon;

        return (
          <motion.div
            key={card.key}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: prefersReducedMotion ? 0 : index * 0.05 }}
            className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-xl transition-colors hover:border-primary/30"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {card.title}
              </p>
              <Icon className={cn("h-4 w-4 shrink-0", card.tone)} />
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
