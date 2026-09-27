import type { FeedbackStatus } from "@/lib/domain/feedback-constants";

/**
 * Presentation for feedback statuses.
 * ─────────────────────────────────────────────────────────────────────────────
 * One map, shared by the merchant history list, the thread view and the admin
 * queue — so "in progress" can never be amber in one place and blue in another.
 *
 * Colours come from the theme tokens (`--success`, `--warning`, `--primary`),
 * never from literal Tailwind palette classes.
 */
export const FEEDBACK_STATUS_STYLES: Record<FeedbackStatus, string> = {
  open: "bg-primary/10 text-primary border-primary/20",
  in_progress: "bg-warning/10 text-warning border-warning/20",
  resolved: "bg-success/10 text-success border-success/20",
  closed: "bg-muted text-muted-foreground border-border",
};

/** Fallback style for a status that somehow isn't in the union (e.g. legacy data). */
export const FEEDBACK_STATUS_FALLBACK = "bg-muted text-muted-foreground border-border";

/** Resolves the badge class for a status, tolerating unknown strings from the DB. */
export function feedbackStatusClass(status: string): string {
  return FEEDBACK_STATUS_STYLES[status as FeedbackStatus] ?? FEEDBACK_STATUS_FALLBACK;
}

/** All statuses in workflow order — used for filters and status pickers. */
export const FEEDBACK_STATUS_ORDER: FeedbackStatus[] = [
  "open",
  "in_progress",
  "resolved",
  "closed",
];
