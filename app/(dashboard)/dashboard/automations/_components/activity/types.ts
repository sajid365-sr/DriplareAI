/**
 * Shapes returned by `GET /api/automations/activity`.
 *
 * Kept separate from `../types.ts` because the two answer different questions:
 * that file describes a *rule*, this one describes what a rule *did*. Only the
 * activity log ever needs a run row, and folding both into one module would
 * mean every rule card imports the run-log contract it never reads.
 */

export interface ActivityRun {
  id: string;
  /** `null` when the rule has since been deleted — `onDelete: SetNull` keeps the history. */
  automationId: string | null;
  automationName: string | null;
  sessionId: string | null;
  triggerType: string;
  status: string;
  skipReason: string | null;
  matchedRules: unknown;
  actionsResult: unknown;
  error: string | null;
  creditsSpent: number;
  createdAt: string;
}

export interface ActivityFailure {
  id: string;
  error: string | null;
  triggerType: string;
  sessionId: string | null;
  createdAt: string;
}

export interface ActivityCounts {
  sent: number;
  skipped: number;
  failed: number;
  matched: number;
  waiting: number;
}

export interface ActivityPayload {
  runs: ActivityRun[];
  nextCursor: string | null;
  counts: ActivityCounts;
  recentFailures: ActivityFailure[];
  gateLastSeenAt: string | null;
  /**
   * How many rules could fire right now. Read together with `gateLastSeenAt`:
   * with zero rules the engine records nothing, so a null timestamp there means
   * "nothing to evaluate yet" rather than "the gate never called".
   */
  activeRuleCount: number;
  range: string;
}

/** The windows the API accepts, in the order the tabs render them. */
export const RANGE_KEYS = ["24h", "7d", "30d"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

/**
 * The skip reasons worth offering as a filter.
 *
 * Only the ones a merchant can act on: `condition_failed` and `lower_priority`
 * mean the rules are working, and filtering for them is a debugging step, not a
 * routine one — they stay discoverable in the row detail instead of cluttering
 * the filter bar.
 */
export const FILTERABLE_SKIP_REASONS = [
  "quiet_hours",
  "frequency_cap",
  "ai_muted",
  "outside_messaging_window",
  "missing_credentials",
] as const;
