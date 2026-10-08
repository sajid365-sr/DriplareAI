"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { STATUS_CLASSES, statusMeta } from "../types";
import { absoluteTime, relativeTime } from "../format";
import type { ActivityRun } from "./types";

/**
 * One row in the run log.
 *
 * Collapsed, it answers the only question a log is scanned for: did this work,
 * and when. Expanded, it answers the follow-up — why not — which is why the
 * detail is inline rather than behind a modal: comparing three rows means
 * opening three of them, and a dialog makes that a three-step dance per row.
 *
 * The raw JSON columns are rendered through narrow readers rather than dumped
 * as pretty-printed JSON. Both columns have a known shape written by our own
 * engine, and showing a merchant `{"type":"send_text","ok":true}` teaches them
 * nothing they can act on.
 */
export function ActivityRow({ run, isBn }: { run: ActivityRun; isBn: boolean }) {
  const { t } = useTranslation("automations");
  const [open, setOpen] = useState(false);

  const meta = statusMeta(run.status);
  const outcomes = readOutcomes(run.matchedRules);
  const actions = readActions(run.actionsResult);
  const hasDetail = outcomes.length > 0 || actions.length > 0 || Boolean(run.error);

  return (
    <div className="rounded-xl border border-border/60 bg-card">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((current) => !current)}
        aria-expanded={hasDetail ? open : undefined}
        data-testid={`run-${run.id}`}
        className={cn(
          "flex w-full items-center gap-2.5 p-3 text-left",
          hasDetail ? "cursor-pointer" : "cursor-default"
        )}
      >
        <Badge
          variant="outline"
          className={cn("shrink-0 border px-2 py-0.5 text-[10px] font-semibold", STATUS_CLASSES[meta.tone])}
        >
          {t(meta.labelKey, run.status)}
        </Badge>

        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
          {run.automationName ?? (
            <span className="font-normal italic text-muted-foreground">
              {t("activity.deletedRule", "Deleted rule")}
            </span>
          )}
        </span>

        {/* The reason a row was held back is the whole point of reading a log,
            so it stays on the collapsed row rather than in the detail. */}
        {run.skipReason && (
          <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
            {t(`skipReasons.${run.skipReason}`, run.skipReason)}
          </span>
        )}

        <time
          dateTime={run.createdAt}
          title={absoluteTime(run.createdAt, isBn)}
          className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
        >
          {relativeTime(run.createdAt, isBn)}
        </time>

        {hasDetail && (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-border/50 p-3">
              {run.error && (
                <Section title={t("activity.error", "Error")}>
                  <p className="font-mono text-[11px] text-destructive">{run.error}</p>
                </Section>
              )}

              {outcomes.length > 0 && (
                <Section title={t("activity.ruleOutcomes", "What each rule decided")}>
                  <ul className="space-y-1">
                    {outcomes.map((outcome) => (
                      <li
                        key={outcome.automationId}
                        className="flex items-start gap-1.5 text-[11px]"
                      >
                        {outcome.matched ? (
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                        ) : (
                          <X className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                        <span className="font-medium text-foreground">{outcome.name}</span>
                        <span className="text-muted-foreground">
                          {outcome.matched
                            ? t("outcome.matched", "Matched")
                            : t(
                                `outcome.${outcome.skipReason ?? "condition_failed"}`,
                                outcome.skipReason ?? "Conditions did not match"
                              )}
                        </span>
                        {outcome.detail && (
                          <span className="truncate font-mono text-muted-foreground/70">
                            {outcome.detail}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {actions.length > 0 && (
                <Section title={t("activity.actionResults", "What ran")}>
                  <ul className="space-y-1">
                    {actions.map((action, index) => (
                      <li key={`${action.type}-${index}`} className="flex items-start gap-1.5 text-[11px]">
                        {action.ok ? (
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                        ) : (
                          <X className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                        )}
                        <span className="font-mono text-foreground">{action.type}</span>
                        {action.detail && (
                          <span
                            className={cn(
                              "truncate",
                              action.ok ? "text-muted-foreground/80" : "text-destructive"
                            )}
                          >
                            {action.detail}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              <Section title={t("activity.context", "Context")}>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-[11px] sm:grid-cols-2">
                  <Row label={t("activity.trigger", "Trigger")} value={run.triggerType} mono />
                  {run.sessionId && (
                    <Row label={t("activity.session", "Conversation")} value={run.sessionId} mono />
                  )}
                  <Row
                    label={t("activity.credits", "AI credits used")}
                    value={String(run.creditsSpent)}
                    mono
                  />
                </dl>
              </Section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 truncate text-foreground", mono && "font-mono")}>{value}</dd>
    </div>
  );
}

// ── Readers for the two JSON columns ──────────────────────────────────────────
//
// The columns are typed `Json` by Prisma, so what comes back is `unknown`. The
// rows were written by `lib/automations/run.ts` and do have these shapes, but a
// run recorded by an older release may not — a reader that trusts the shape
// would turn a stale row into a crashed page.

interface OutcomeView {
  automationId: string;
  name: string;
  matched: boolean;
  skipReason?: string;
  detail?: string;
}

function readOutcomes(value: unknown): OutcomeView[] {
  if (!Array.isArray(value)) return [];

  const outcomes: OutcomeView[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (typeof entry.automationId !== "string" || typeof entry.name !== "string") continue;

    outcomes.push({
      automationId: entry.automationId,
      name: entry.name,
      matched: entry.matched === true,
      skipReason: typeof entry.skipReason === "string" ? entry.skipReason : undefined,
      detail: typeof entry.detail === "string" ? entry.detail : undefined,
    });
  }
  return outcomes;
}

interface ActionView {
  type: string;
  ok: boolean;
  detail?: string;
}

function readActions(value: unknown): ActionView[] {
  if (!Array.isArray(value)) return [];

  const actions: ActionView[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.type !== "string") continue;

    actions.push({
      type: entry.type,
      ok: entry.ok === true,
      detail: typeof entry.detail === "string" ? entry.detail : undefined,
    });
  }
  return actions;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
