"use client";

import { useMemo } from "react";
import { Clock } from "lucide-react";

interface SnoozeBadgeProps {
  snoozeUntil: string | null | undefined;
  className?: string;
  showIcon?: boolean;
}

export function formatSnoozeTime(dateStr: string): string {
  const target = new Date(dateStr);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) return "Due now";

  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }
  if (diffHours < 24) {
    return `${diffHours}h`;
  }
  if (diffDays === 1) {
    return "Tomorrow";
  }
  if (diffDays < 7) {
    return `${diffDays}d`;
  }
  return target.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const SnoozeBadge = ({ snoozeUntil, className = "", showIcon = true }: SnoozeBadgeProps) => {
  const timeLabel = useMemo(() => {
    if (!snoozeUntil) return null;
    return formatSnoozeTime(snoozeUntil);
  }, [snoozeUntil]);

  if (!snoozeUntil || !timeLabel) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 ${className}`}
      title={`Snoozed until: ${new Date(snoozeUntil).toLocaleString()}`}
    >
      {showIcon && <Clock className="w-2.5 h-2.5 shrink-0" />}
      <span>{timeLabel}</span>
    </span>
  );
};

