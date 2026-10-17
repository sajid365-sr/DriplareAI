"use client";

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { AlertOctagon, Ban, GitBranch, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { STATUS_CLASSES, statusMeta } from "../types";
import type { ActivityCounts, ActivityFailure } from "./types";
import { relativeTime } from "../format";

/**
 * The run log's headline numbers, plus the last few hard failures.
 *
 * The four tiles are deliberately ordered best-to-worst left to right, so the
 * shape of the row reads as a funnel: replies went out, rules matched without
 * sending, rules were held back, and things broke.
 *
 * Failures get their own strip rather than being folded into the tile count.
 * `failed` is the only status that needs a human to do something, and a bare
 * "3" in a tile gives no clue what broke or whether it is still broken.
 */
export function ActivitySummary({
  counts,
  failures,
  isBn,
  onFilterFailure,
}: {
  counts: ActivityCounts;
  failures: ActivityFailure[];
  isBn: boolean;
  onFilterFailure: () => void;
}) {
  const { t } = useTranslation("automations");

  const tiles: { icon: LucideIcon; label: string; value: number; tone: string }[] = [
    {
      icon: Send,
      label: t("activity.countSent", "Replies sent"),
      value: counts.sent,
      tone: STATUS_CLASSES.active,
    },
    {
      icon: GitBranch,
      label: t("activity.countMatched", "Matched, nothing sent"),
      value: counts.matched,
      tone: STATUS_CLASSES.draft,
    },
    {
      icon: Ban,
      label: t("activity.countSkipped", "Held back"),
      value: counts.skipped,
      tone: STATUS_CLASSES.neutral,
    },
    {
      icon: AlertOctagon,
      label: t("activity.countFailed", "Failed"),
      value: counts.failed,
      tone: STATUS_CLASSES.danger,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile, index) => {
          const Icon = tile.icon;
          return (
            <motion.div
              key={tile.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className={cn("rounded-xl border p-3.5", tile.tone)}
            >
              <div className="flex items-center gap-1.5 opacity-80">
                <Icon className="h-3.5 w-3.5" />
                <span className="truncate text-[10px] font-bold uppercase tracking-wider">
                  {tile.label}
                </span>
              </div>
              <p className="mt-1.5 font-mono text-xl font-bold">{tile.value}</p>
            </motion.div>
          );
        })}
      </div>

      {failures.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-foreground">
              {t("activity.recentFailures", "Recent failures")}
            </p>
            <button
              type="button"
              onClick={onFilterFailure}
              className="text-[11px] font-medium text-destructive underline-offset-2 hover:underline"
            >
              {t("activity.onlyFailed", "Show only these")}
            </button>
          </div>

          <ul className="mt-2 space-y-1.5">
            {failures.map((failure) => (
              <li
                key={failure.id}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px]"
              >
                <span className="text-muted-foreground">
                  {relativeTime(failure.createdAt, isBn)}
                </span>
                <span className="font-mono text-muted-foreground/70">{failure.triggerType}</span>
                <span className="min-w-0 flex-1 truncate text-destructive">
                  {failure.error ?? t("activity.unknownError", "Unknown error")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
