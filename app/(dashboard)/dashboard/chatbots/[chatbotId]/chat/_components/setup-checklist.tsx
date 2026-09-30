"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ListChecks,
  Plug,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/core/utils";

/* ────────────────────────────────────────────────────────────────────────────
 * Dismissal store
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * A tiny external store for the "this viewer hid the checklist" flag.
 *
 * Why not `useState` + `useEffect`: `localStorage` does not exist during SSR, so
 * a lazy `useState` initializer would produce a client value that differs from
 * the server's HTML — a hydration mismatch. `useSyncExternalStore` exists for
 * exactly this case: React renders the server snapshot while hydrating and
 * swaps in the real value immediately after, with no mismatch reported.
 *
 * The listener set is needed because the `storage` event only fires in *other*
 * tabs, so a write made here would otherwise never re-render this component.
 */
const dismissListeners = new Set<() => void>();

function subscribeToDismiss(onStoreChange: () => void) {
  dismissListeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    dismissListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function readDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    // Private windows and blocked site data can throw on access. Treating that
    // as "not dismissed" only costs the viewer a card they can hide again.
    return false;
  }
}

function writeDismissed(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Nothing to do — the card simply returns on the next visit.
  }
  dismissListeners.forEach((notify) => notify());
}

/* ────────────────────────────────────────────────────────────────────────────
 * Checklist
 * ──────────────────────────────────────────────────────────────────────────── */

type StepKey = "created" | "knowledge" | "channel";

interface Step {
  key: StepKey;
  done: boolean;
  /** `null` for a step that is already behind the user and has nowhere to go. */
  href: string | null;
  icon: LucideIcon;
}

interface SetupChecklistProps {
  chatbotId: string;
  /**
   * Sources + FAQs + sample replies, counted by the bot endpoint the playground
   * already calls. Passed in rather than re-fetched so this card costs no extra
   * request on a page that is already the dashboard's heaviest.
   */
  knowledgeCount: number;
}

/**
 * SetupChecklist — the durable "what's left?" card on the playground.
 *
 * It exists because creating an agent is no longer the same act as making it
 * useful. The creation dialog deliberately asks for a name and nothing else, so
 * this card is what tells the merchant where the remaining work lives — and it
 * points every one of those steps at the single owner of that concern, never at
 * a second copy of it.
 *
 * Every row is driven by real data, so the card cannot claim a step is pending
 * after it has been done, and it removes itself entirely once nothing is left.
 */
export function SetupChecklist({ chatbotId, knowledgeCount }: SetupChecklistProps) {
  const { t } = useTranslation("chatbots");

  const [collapsed, setCollapsed] = useState(false);
  /** `null` while the integrations request is in flight or if it failed. */
  const [connectedChannels, setConnectedChannels] = useState<number | null>(null);

  const storageKey = `driplare:setup-checklist:v1:${chatbotId}`;
  const getDismissed = useCallback(() => readDismissed(storageKey), [storageKey]);
  const isDismissed = useSyncExternalStore(subscribeToDismiss, getDismissed, () => false);

  useEffect(() => {
    if (!chatbotId) return;
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(`/api/chatbots/${chatbotId}/integrations`);
        const data = await res.json();
        if (cancelled || !Array.isArray(data)) return;

        // `coming_soon` platforms cannot be connected yet, so counting one as a
        // missing channel would leave the step permanently unreachable.
        setConnectedChannels(
          data.filter((i) => i?.connected && !i?.coming_soon).length
        );
      } catch {
        // Leave the count unknown; the step reads as pending, which is the
        // honest thing to show when we could not find out.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chatbotId]);

  const steps: Step[] = [
    {
      key: "created",
      // Reaching this page at all means the agent exists.
      done: true,
      href: null,
      icon: Sparkles,
    },
    {
      key: "knowledge",
      done: knowledgeCount > 0,
      href: `/dashboard/knowledge-base?botId=${chatbotId}`,
      icon: BookOpen,
    },
    {
      key: "channel",
      done: (connectedChannels ?? 0) > 0,
      href: `/dashboard/chatbots/${chatbotId}/integrations`,
      icon: Plug,
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  const allDone = doneCount === steps.length;
  const firstPendingKey = steps.find((step) => !step.done)?.key ?? null;

  // Hidden once there is nothing left to do, or once the viewer has said so.
  if (isDismissed || allDone) return null;

  const progressPercent = Math.round((doneCount / steps.length) * 100);

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
      data-testid="setup-checklist"
    >
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm shadow-primary/20">
          <ListChecks className="size-5" />
        </span>

        {/* Toggling lives on its own button so the dismiss control beside it can
            stay a real, separately-labelled button rather than a nested one. */}
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {t("setup_checklist.title", "Finish setting up your agent")}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t("setup_checklist.progress", {
                done: doneCount,
                total: steps.length,
                defaultValue: "{{done}} of {{total}} done",
              })}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              !collapsed && "rotate-180"
            )}
          />
        </button>

        <button
          type="button"
          onClick={() => writeDismissed(storageKey)}
          aria-label={t("setup_checklist.dismiss", "Hide this checklist")}
          className="shrink-0 cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* ─── Progress ───────────────────────────────────────────────────── */}
      <div className="h-1 w-full bg-muted">
        <motion.div
          className="h-full bg-brand-gradient"
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>

      {/* ─── Steps ──────────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <ul className="divide-y divide-border/60 border-t border-border/60">
              {steps.map((step) => {
                const Icon = step.icon;
                const isCurrent = step.key === firstPendingKey;

                const row = (
                  <>
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors",
                        step.done
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-border bg-muted text-muted-foreground"
                      )}
                    >
                      {step.done ? <Check className="size-4" /> : <Icon className="size-4" />}
                    </span>

                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span
                        className={cn(
                          "block text-sm font-medium",
                          step.done && "text-muted-foreground"
                        )}
                      >
                        {t(`setup_checklist.steps.${step.key}.title`)}
                      </span>
                      {!step.done && (
                        <span className="block text-xs leading-relaxed text-muted-foreground">
                          {t(`setup_checklist.steps.${step.key}.desc`)}
                        </span>
                      )}
                    </span>

                    {!step.done && step.href && (
                      <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-primary sm:inline-flex">
                        {t("setup_checklist.action", "Start")}
                        <ArrowRight className="size-3.5" />
                      </span>
                    )}
                  </>
                );

                const rowClass = cn(
                  "flex items-center gap-3 px-4 py-3 transition-colors sm:px-5",
                  isCurrent && "bg-primary/5"
                );

                return (
                  <li key={step.key}>
                    {step.href ? (
                      <Link href={step.href} className={cn(rowClass, "hover:bg-muted/60")}>
                        {row}
                      </Link>
                    ) : (
                      <div className={rowClass}>{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
