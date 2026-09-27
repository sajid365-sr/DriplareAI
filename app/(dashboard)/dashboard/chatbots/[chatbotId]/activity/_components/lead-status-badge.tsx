"use client";

import { cn } from "@/lib/utils";

export type LeadStatus =
  | "high_prospect"
  | "priority"
  | "risky"
  | "successful"
  | "top_client"
  | "low_prospect"
  | "attention"
  | "none";

interface LeadStatusBadgeProps {
  status: LeadStatus | string;
  className?: string;
}

const STATUS_STYLES: Record<string, string> = {
  high_prospect: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  priority:      "bg-violet-500/15 text-violet-400 border-violet-500/30",
  risky:         "bg-rose-500/15 text-rose-400 border-rose-500/30",
  successful:    "bg-emerald-600/20 text-emerald-300 border-emerald-600/40",
  top_client:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
  low_prospect:  "bg-amber-500/15 text-amber-400 border-amber-500/30",
  attention:     "bg-orange-500/15 text-orange-400 border-orange-500/30",
  none:          "bg-muted/50 text-muted-foreground border-border/40",
};

const STATUS_LABELS: Record<string, string> = {
  high_prospect: "High Prospect",
  priority:      "Priority",
  risky:         "Risky",
  successful:    "Successful",
  top_client:    "Top Client",
  low_prospect:  "Low Prospect",
  attention:     "Attention",
  none:          "",
};

export function LeadStatusBadge({ status, className }: LeadStatusBadgeProps) {
  const key = status || "none";
  if (key === "none") return null;

  const styles = STATUS_STYLES[key] ?? STATUS_STYLES.none;
  const label  = STATUS_LABELS[key] ?? key;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border tracking-wide whitespace-nowrap",
        styles,
        className
      )}
    >
      {label}
    </span>
  );
}
