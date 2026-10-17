"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { RevenueBasis } from "@/lib/domain/plan-revenue";
import { cn } from "@/lib/utils";

/**
 * Margin and profit for one workspace, rendered the same way everywhere.
 *
 * ── Why this is shared ────────────────────────────────────────────────────────
 * The rule it encodes is a correctness rule, not a styling preference: when a
 * plan's price cannot be read, the margin is **unknown**, and the cell must say
 * so in words. The admin workspace table used to print `0%` or `−100%` for every
 * such workspace — two different claims, neither measured, and one of them
 * flags a healthy Enterprise account as bleeding money.
 *
 * That rule now has two callers (the workspace table and the observability
 * page's cost ranking), so it lives in one place. Two copies of a money label is
 * exactly the defect `lib/domain/unit-economics.ts` was created to remove.
 *
 * `namespace`/`keyBase` let each caller pull its own translation strings while
 * sharing the logic and the markup.
 */

/**
 * Why a workspace has no margin, phrased for the three different reasons.
 *
 * They must not look alike: a negotiated Enterprise deal, a plan key the
 * catalogue does not know, and a genuinely free plan are three different
 * situations, and an operator deciding what to do about each needs to tell them
 * apart at a glance.
 */
const MISSING_MARGIN_REASON = {
  custom: {
    key: "marginCustom",
    fallback: "Custom pricing",
    hintKey: "marginCustomHint",
    hint: "Sold by negotiation — no list price",
  },
  unknown: {
    key: "marginUnknownPlan",
    fallback: "Unknown plan",
    hintKey: "marginUnknownPlanHint",
    hint: "Plan key is not in the catalogue",
  },
  plan: {
    key: "marginFreePlan",
    fallback: "Free plan",
    hintKey: "marginFreePlanHint",
    hint: "No subscription revenue",
  },
} as const;

/** Margin colour thresholds, on CSS variables so both themes are covered. */
export function marginTone(marginPercent: number): string {
  if (marginPercent >= 50) return "bg-success/15 text-success border-success/30";
  if (marginPercent >= 0) return "bg-warning/15 text-warning border-warning/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
}

interface MarginCellProps {
  /** `null` when the plan price is not knowable — see `lib/domain/unit-economics.ts`. */
  marginPercent: number | null;
  netProfitBdt: number | null;
  basis: RevenueBasis;
  /** i18next namespace holding the strings. Defaults to the admin namespace. */
  namespace?: string;
  /** Key prefix inside that namespace. Defaults to the workspace table's block. */
  keyBase?: string;
}

export function MarginCell({
  marginPercent,
  netProfitBdt,
  basis,
  namespace = "admin",
  keyBase = "workspaces.table",
}: MarginCellProps) {
  const { t } = useTranslation(namespace);

  if (marginPercent === null || netProfitBdt === null) {
    const reason = MISSING_MARGIN_REASON[basis];

    return (
      <div className="flex flex-col gap-1">
        <Badge
          variant="outline"
          className="w-fit text-[11px] font-medium text-muted-foreground border-border"
        >
          {t(`${keyBase}.${reason.key}`, reason.fallback)}
        </Badge>
        <span className="text-[11px] text-muted-foreground">
          {t(`${keyBase}.${reason.hintKey}`, reason.hint)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Badge className={cn("w-fit text-[11px] font-semibold", marginTone(marginPercent))}>
        {marginPercent}% {t(`${keyBase}.marginSuffix`, "Margin")}
      </Badge>
      <span className="text-[11px] text-muted-foreground">
        {netProfitBdt >= 0
          ? `+৳${netProfitBdt.toLocaleString()}`
          : `-৳${Math.abs(netProfitBdt).toLocaleString()}`}
      </span>
    </div>
  );
}
