"use client";

import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Loader2, ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { ActivityRow } from "./activity-row";
import type { ActivityRun } from "./types";

/**
 * The run rows themselves.
 *
 * Two empty states, not one. "Nothing has ever run" and "nothing matched what
 * you filtered for" look identical in a table and mean opposite things — the
 * first says the automations are not firing, the second says they are and you
 * filtered them away. Collapsing them would send a merchant debugging a
 * product that is working.
 */
export function ActivityLog({
  runs,
  loading,
  loadingMore,
  filtered,
  hasMore,
  isBn,
  onLoadMore,
}: {
  runs: ActivityRun[];
  loading: boolean;
  loadingMore: boolean;
  /** True when a filter is active, which is what decides the empty state's wording. */
  filtered: boolean;
  hasMore: boolean;
  isBn: boolean;
  onLoadMore: () => void;
}) {
  const { t } = useTranslation("automations");

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-10 text-center">
        <ScrollText className="mx-auto h-6 w-6 text-muted-foreground/60" />
        <p className="mt-2.5 text-sm font-semibold text-foreground">
          {filtered
            ? t("activity.emptyFiltered", "No runs match these filters")
            : t("activity.empty", "Nothing has run in this period")}
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          {filtered
            ? t(
                "activity.emptyFilteredHint",
                "Try a longer date range or clear the filters — the runs are there, they just do not match."
              )
            : t(
                "activity.emptyHint",
                "Every time a rule is evaluated it is recorded here, whether it replied or was held back."
              )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {runs.map((run, index) => (
        <motion.div
          key={run.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          // Capped so a page of fifty rows does not stagger for two seconds.
          transition={{ delay: Math.min(index, 8) * 0.02 }}
        >
          <ActivityRow run={run} isBn={isBn} />
        </motion.div>
      ))}

      {hasMore && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="w-full border-dashed"
          data-testid="activity-load-more"
        >
          {loadingMore && <Loader2 className="animate-spin" />}
          {t("runs.loadMore", "Load more")}
        </Button>
      )}
    </div>
  );
}
