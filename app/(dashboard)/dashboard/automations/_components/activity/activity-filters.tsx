"use client";

import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { RUN_STATUSES } from "@/lib/automations/schema";

import { FILTERABLE_SKIP_REASONS, RANGE_KEYS, type RangeKey } from "./types";

/**
 * The activity log's filter bar.
 *
 * The range is a segmented control rather than a select because it is the one
 * control that is touched constantly, and a dropdown makes "was this 3 or 30
 * days?" a thing you have to open. The other two are selects — set once, then
 * left alone.
 *
 * Two filters are deliberately absent. A free-text search was dropped because
 * the only strings a run carries are an internal session id and a trigger key,
 * neither of which a merchant would type. And filtering to one rule belongs on
 * that rule's own page, not here — offering it in both places would suggest
 * this is the page to ask that question on.
 */

/** Sentinel for "no filter", since a base-ui `Select` has no empty value. */
const ANY = "__any__";

/** Offered in the order a merchant is likely to care about them, not alphabetically. */
const STATUS_OPTIONS = ["sent", "matched", "skipped", "failed", "waiting"].filter((status) =>
  (RUN_STATUSES as readonly string[]).includes(status)
);

interface ActivityFiltersProps {
  range: RangeKey;
  status: string;
  skipReason: string;
  onRangeChange: (range: RangeKey) => void;
  onStatusChange: (status: string) => void;
  onSkipReasonChange: (reason: string) => void;
}

export function ActivityFilters({
  range,
  status,
  skipReason,
  onRangeChange,
  onStatusChange,
  onSkipReasonChange,
}: ActivityFiltersProps) {
  const { t } = useTranslation("automations");

  const dirty = Boolean(status || skipReason);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Segmented range control */}
      <div className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-0.5">
        {RANGE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onRangeChange(key)}
            aria-pressed={range === key}
            data-testid={`range-${key}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              range === key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t(`activity.range.${key}`, key)}
          </button>
        ))}
      </div>

      <Select
        value={status || ANY}
        // base-ui reports `null` when a selection is cleared; the filters model
        // "no filter" as an empty string, so both collapse to the same value.
        onValueChange={(value) => onStatusChange(value && value !== ANY ? value : "")}
      >
        <SelectTrigger className="h-9 w-[9.5rem] text-xs" data-testid="activity-status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{t("activity.anyStatus", "Any result")}</SelectItem>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {t(`status.${option}`, option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={skipReason || ANY}
        onValueChange={(value) => onSkipReasonChange(value && value !== ANY ? value : "")}
      >
        <SelectTrigger className="h-9 w-[11rem] text-xs" data-testid="activity-reason">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{t("activity.anyReason", "Held back for any reason")}</SelectItem>
          {FILTERABLE_SKIP_REASONS.map((reason) => (
            <SelectItem key={reason} value={reason}>
              {t(`skipReasons.${reason}`, reason)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {dirty && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => {
            onStatusChange("");
            onSkipReasonChange("");
          }}
        >
          <RotateCcw />
          {t("activity.clear", "Clear")}
        </Button>
      )}
    </div>
  );
}
