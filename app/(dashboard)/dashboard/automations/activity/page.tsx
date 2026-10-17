"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ScrollText } from "lucide-react";
import { toast } from "sonner";

import { AutomationGateBanner } from "../_components/automation-gate-banner";
import { SectionHeader } from "../_components/section-header";
import { ActivityFilters } from "../_components/activity/activity-filters";
import { ActivityLog } from "../_components/activity/activity-log";
import { ActivitySummary } from "../_components/activity/activity-summary";
import type {
  ActivityCounts,
  ActivityFailure,
  ActivityPayload,
  ActivityRun,
  RangeKey,
} from "../_components/activity/types";

/**
 * The Activity Log: every time a rule was evaluated, and what came of it.
 *
 * This is the tab that makes the other three debuggable. A merchant whose rule
 * "does nothing" has three possible problems — the engine was never called, the
 * rule was evaluated and held back, or the send failed — and this page is the
 * only place that can tell them apart.
 *
 * The first page and "load more" are separate fetches because they are separate
 * intentions: changing a filter should replace the list, and loading more
 * should extend it. Sharing one loader would make a filter change append the
 * new results to the old ones.
 */

const EMPTY_COUNTS: ActivityCounts = { sent: 0, matched: 0, skipped: 0, failed: 0, waiting: 0 };

export default function AutomationActivityPage() {
  const { t, i18n } = useTranslation("automations");
  const isBn = i18n.language === "bn";

  const [runs, setRuns] = useState<ActivityRun[]>([]);
  const [counts, setCounts] = useState<ActivityCounts>(EMPTY_COUNTS);
  const [failures, setFailures] = useState<ActivityFailure[]>([]);
  const [gateLastSeenAt, setGateLastSeenAt] = useState<string | null>(null);
  const [activeRuleCount, setActiveRuleCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [range, setRange] = useState<RangeKey>("7d");
  const [status, setStatus] = useState("");
  const [skipReason, setSkipReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Only the very first load shows the skeleton; a filter change keeps the
  // previous rows on screen so the page does not blink on every select.
  const loadedOnce = useRef(false);

  const buildQuery = useCallback(
    (cursor: string | null) => {
      const params = new URLSearchParams({ range });
      if (status) params.set("status", status);
      if (skipReason) params.set("skipReason", skipReason);
      if (cursor) params.set("cursor", cursor);
      return params.toString();
    },
    [range, status, skipReason]
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!loadedOnce.current) setLoading(true);

      try {
        const response = await fetch(`/api/automations/activity?${buildQuery(null)}`, { signal });
        const data = (await response.json()) as ActivityPayload;
        if (!response.ok) {
          toast.error(t("activity.loadFailed", "Could not load the activity log."));
          return;
        }

        setRuns(data.runs);
        setCounts(data.counts);
        setFailures(data.recentFailures);
        setGateLastSeenAt(data.gateLastSeenAt);
        setActiveRuleCount(data.activeRuleCount);
        setNextCursor(data.nextCursor);
        loadedOnce.current = true;
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") return;
        toast.error(t("activity.loadFailed", "Could not load the activity log."));
      } finally {
        setLoading(false);
      }
    },
    [buildQuery, t]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/automations/activity?${buildQuery(nextCursor)}`);
      const data = (await response.json()) as ActivityPayload;
      if (!response.ok) {
        toast.error(t("activity.loadFailed", "Could not load the activity log."));
        return;
      }
      // Append, and guard against a duplicate id: a run created between the two
      // requests can shift the cursor window and hand us a row we already have,
      // which React would render twice under the same key.
      setRuns((current) => {
        const seen = new Set(current.map((run) => run.id));
        return [...current, ...data.runs.filter((run) => !seen.has(run.id))];
      });
      setNextCursor(data.nextCursor);
    } catch {
      toast.error(t("activity.loadFailed", "Could not load the activity log."));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <SectionHeader
        icon={ScrollText}
        title={t("activity.title", "Activity Log")}
        subtitle={t(
          "activity.subtitle",
          "Every rule that was checked, what it decided, and why it stayed quiet."
        )}
      />

      <AutomationGateBanner
        gateLastSeenAt={gateLastSeenAt}
        activeRuleCount={activeRuleCount}
        explainNoRules
      />

      <ActivitySummary
        counts={counts}
        failures={failures}
        isBn={isBn}
        onFilterFailure={() => {
          setSkipReason("");
          setStatus("failed");
        }}
      />

      <ActivityFilters
        range={range}
        status={status}
        skipReason={skipReason}
        onRangeChange={setRange}
        onStatusChange={setStatus}
        onSkipReasonChange={setSkipReason}
      />

      <ActivityLog
        runs={runs}
        loading={loading}
        loadingMore={loadingMore}
        filtered={Boolean(status || skipReason)}
        hasMore={nextCursor !== null}
        isBn={isBn}
        onLoadMore={loadMore}
      />
    </motion.div>
  );
}
