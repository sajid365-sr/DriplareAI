"use client";

import { motion } from "framer-motion";
import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OBSERVABILITY_TASKS, type ObservabilityTask } from "@/lib/domain/observability";
import { cn } from "@/lib/utils";
import { taskLabel } from "./task-labels";

/**
 * The controls that scope every panel on the page.
 *
 * They sit in **one row above everything they affect**, never one per panel:
 * two windows on one screen invite a reader to compare numbers that were
 * measured over different periods, which is the most common way a dashboard
 * produces a confident wrong answer.
 *
 * The window is a fixed set of presets rather than a free date picker. Every
 * panel below aggregates over the whole window, so an arbitrary pair of dates
 * would create partitions an operator would then read as trends; presets keep
 * windows comparable to each other.
 */

/** How far back the panels look. Values are days. */
export const RANGE_PRESETS = [7, 30, 90, 365] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

/**
 * `SelectItem` cannot carry an empty value, so "no channel filter" travels as a
 * sentinel and is converted back to an empty query parameter at the edges.
 */
const ALL_CHANNELS = "__all__";

interface ObservabilityFiltersProps {
  days: RangePreset;
  onDaysChange: (days: RangePreset) => void;
  task: ObservabilityTask | "all";
  onTaskChange: (task: ObservabilityTask | "all") => void;
  channel: string;
  onChannelChange: (channel: string) => void;
  /** Channels seen in the data, for the filter's options. */
  channels: string[];
  onRefresh: () => void;
  loading: boolean;
}

export function ObservabilityFilters({
  days,
  onDaysChange,
  task,
  onTaskChange,
  channel,
  onChannelChange,
  channels,
  onRefresh,
  loading,
}: ObservabilityFiltersProps) {
  const { t } = useTranslation("observability");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-4 backdrop-blur-xl lg:flex-row lg:items-end lg:justify-between"
    >
      <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* ── Window ──────────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="observability-range" className="text-xs font-semibold text-muted-foreground">
            {t("filters.range", "Time window")}
          </Label>
          <Select
            value={String(days)}
            onValueChange={(value) => onDaysChange(Number(value) as RangePreset)}
          >
            <SelectTrigger id="observability-range" className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_PRESETS.map((preset) => (
                <SelectItem key={preset} value={String(preset)}>
                  {t("filters.lastDays", "Last {{days}} days", { days: preset })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── Task ────────────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="observability-task" className="text-xs font-semibold text-muted-foreground">
            {t("filters.task", "Task")}
          </Label>
          <Select value={task} onValueChange={(value) => onTaskChange(value as ObservabilityTask | "all")}>
            <SelectTrigger id="observability-task" className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allTasks", "All tasks")}</SelectItem>
              {OBSERVABILITY_TASKS.map((candidate) => {
                const label = taskLabel(candidate);

                return (
                  <SelectItem key={candidate} value={candidate}>
                    {t(label.key, label.fallback)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* ── Channel ─────────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="observability-channel" className="text-xs font-semibold text-muted-foreground">
            {t("filters.channel", "Channel")}
          </Label>
          <Select
            value={channel || ALL_CHANNELS}
            // `null` (the cleared state) means the same thing as the sentinel:
            // no channel filter. Both collapse to `""` before leaving this file.
            onValueChange={(value) =>
              onChannelChange(value === null || value === ALL_CHANNELS ? "" : value)
            }
          >
            <SelectTrigger id="observability-channel" className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CHANNELS}>{t("filters.allChannels", "All channels")}</SelectItem>
              {channels.map((name) => (
                // Channel names stay as stored (`facebook`, `whatsapp`) even in
                // Bengali: they are integration identifiers, not prose.
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:inline-flex">
          <SlidersHorizontal className="h-3 w-3" />
          {t("filters.appliesTo", "Applies to every panel")}
        </span>
        <Button variant="outline" size="icon" onClick={onRefresh} className="rounded-xl">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>
    </motion.div>
  );
}
