"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A ranked bar list, built as a table.
 *
 * ── Why a table and not a chart library ──────────────────────────────────────
 * The measurement beside each bar is the point of this panel, and a canvas chart
 * can only show it on hover. Here every value is in a column: readable without a
 * pointer, selectable, printable, and announced correctly by a screen reader.
 * That satisfies the rule that a tooltip may enhance a chart but never be the
 * only way to read it — the tooltip is simply absent because it is not needed.
 *
 * ── Mark specification ───────────────────────────────────────────────────────
 *   • One series, one hue: the bar length already encodes magnitude, so colouring
 *     each row differently would encode the same thing twice.
 *   • The bar grows from a left baseline: the left edge is square, the right end
 *     carries the 4px radius. A radius on the anchored end would detach the mark
 *     from its baseline.
 *   • 8px thin marks on a recessive track, not saturated blocks.
 *   • The bar is `aria-hidden`: the value it depicts is in the next cell, and
 *     reading it out twice is noise.
 */

export interface BarTableRow {
  key: string;
  label: string;
  /** Value column text, already formatted (currency, percent, count…). */
  value: string;
  /** Optional second line under the label — context, not a second measure. */
  hint?: string;
  /** The number that sets this row's bar length, relative to the longest row. */
  magnitude: number;
  /** Optional trailing status badge (icon + label, never colour alone). */
  badge?: ReactNode;
  /** Optional drill-down target for the label. */
  href?: string;
}

interface BarTableProps {
  rows: BarTableRow[];
  /** Heading for the value column — what the number is. */
  valueHeading: string;
  /** Column heading for the labels. Defaults to a generic term. */
  labelHeading?: string;
  /** Bar hue: one of the validated `chart-*` slots. */
  toneClass?: string;
  /** Shown in place of the table when nothing was measured in the window. */
  emptyMessage: string;
  /** Optional third column heading, for rows that carry a badge. */
  badgeHeading?: string;
  className?: string;
}

export function BarTable({
  rows,
  valueHeading,
  labelHeading = "Item",
  toneClass = "bg-chart-1",
  emptyMessage,
  badgeHeading,
  className,
}: BarTableProps) {
  const prefersReducedMotion = useReducedMotion();
  const longest = rows.reduce((max, row) => Math.max(max, row.magnitude), 0);

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="py-3 pr-4 font-semibold">{labelHeading}</th>
            <th className="w-1/3 py-3 pr-4 font-semibold" aria-hidden="true" />
            <th className="py-3 pr-4 text-right font-semibold">{valueHeading}</th>
            {badgeHeading && <th className="py-3 text-right font-semibold">{badgeHeading}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.map((row) => {
            // The longest row fills the track; everything else is proportional to
            // it. A zero row draws nothing rather than a hairline that suggests
            // a measurement where there is none.
            const widthPercent = longest > 0 ? (row.magnitude / longest) * 100 : 0;

            return (
              <tr key={row.key} className="transition-colors hover:bg-muted/30">
                <td className="py-3 pr-4 align-middle">
                  {row.href ? (
                    <Link
                      href={row.href}
                      className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
                    >
                      {row.label}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{row.label}</span>
                  )}
                  {row.hint && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{row.hint}</p>
                  )}
                </td>

                <td className="py-3 pr-4 align-middle" aria-hidden="true">
                  <div className="h-2 w-full overflow-hidden rounded-sm bg-muted/60">
                    <motion.div
                      className={cn("h-full rounded-r-[4px]", toneClass)}
                      initial={prefersReducedMotion ? false : { width: 0 }}
                      animate={{ width: `${widthPercent}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </div>
                </td>

                <td className="py-3 pr-4 text-right align-middle font-medium tabular-nums text-foreground">
                  {row.value}
                </td>

                {badgeHeading && (
                  <td className="py-3 text-right align-middle">{row.badge ?? null}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
