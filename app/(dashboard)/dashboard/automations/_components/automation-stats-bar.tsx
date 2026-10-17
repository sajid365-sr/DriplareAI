"use client";

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Activity, Percent, Sparkles, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * The four numbers that answer "is this tab doing anything?".
 *
 * `runsToday` counts every evaluation, not just replies — a rule that is
 * evaluated and skips is exactly the case a merchant needs to see, because the
 * count with no replies is what points them at the run log.
 *
 * `creditsSaved` is the reply count: a canned reply short-circuits the RAG
 * lookup and the LLM call, so every one of them is an AI turn that never
 * happened. It is deliberately labelled as a count of calls, not a credit
 * figure — the credit resolver (`lib/ai/credit-resolver.ts`) owns pricing and
 * guessing at it here would put a second, wrong number in front of the user.
 */
export interface AutomationStats {
  activeRules: number;
  runsToday: number;
  sentToday: number;
  loaded: boolean;
}

export function AutomationStatsBar({ stats }: { stats: AutomationStats }) {
  const { t } = useTranslation("automations");

  const replyRate =
    stats.runsToday > 0 ? Math.round((stats.sentToday / stats.runsToday) * 100) : 0;

  const tiles: { icon: LucideIcon; label: string; value: string }[] = [
    {
      icon: Zap,
      label: t("stats.activeRules", "Active Rules"),
      value: String(stats.activeRules),
    },
    {
      icon: Activity,
      label: t("stats.runsToday", "Runs Today"),
      value: String(stats.runsToday),
    },
    {
      icon: Percent,
      label: t("stats.replyRate", "Reply Rate"),
      value: `${replyRate}%`,
    },
    {
      icon: Sparkles,
      label: t("stats.creditsSaved", "AI Calls Skipped"),
      value: String(stats.sentToday),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile, index) => {
        const Icon = tile.icon;
        return (
          <motion.div
            key={tile.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="rounded-xl border border-border/60 bg-card p-3.5"
          >
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Icon className="h-3.5 w-3.5 text-primary" />
              <span className="truncate text-[10px] font-bold uppercase tracking-wider">
                {tile.label}
              </span>
            </div>
            {stats.loaded ? (
              <p className="mt-1.5 font-mono text-xl font-bold text-foreground">{tile.value}</p>
            ) : (
              <Skeleton className="mt-2 h-6 w-12" />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
