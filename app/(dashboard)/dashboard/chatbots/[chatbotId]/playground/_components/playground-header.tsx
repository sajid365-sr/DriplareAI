"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Crown, MessageSquare, Settings2, Swords, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/core/utils";

/** Playground-এর দুই কাজ — বটের সাথে কথা বলা, আর মডেলদের লড়াই দেখানো। */
export type PlaygroundMode = "single" | "compare";

interface PlaygroundHeaderProps {
  mode: PlaygroundMode;
  onModeChange: (mode: PlaygroundMode) => void;
}

interface ModeOption {
  key: PlaygroundMode;
  icon: LucideIcon;
  labelKey: string;
  fallback: string;
  hintKey: string;
  hintFallback: string;
  /** PRO চিপ — কেবল Compare-এ */
  pro?: boolean;
}

const MODES: ModeOption[] = [
  {
    key: "single",
    icon: MessageSquare,
    labelKey: "chat_test.mode.liveTitle",
    fallback: "Live Agent Test",
    hintKey: "chat_test.mode.liveHint",
    hintFallback: "Talk to your agent exactly the way a customer would.",
  },
  {
    key: "compare",
    icon: Swords,
    labelKey: "chat_test.mode.compareTitle",
    fallback: "Compare Arena",
    hintKey: "chat_test.mode.compareHint",
    hintFallback: "One question, up to four models, answered side by side.",
    pro: true,
  },
];

/**
 * PlaygroundHeader — পেজের শিরোনাম আর দুই মোডের সুইচার।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ মোড বদলানো **রাউট বদলায় না** (কেবল state)। আগে Compare আলাদা রুটে ছিল
 *    (`/playground/compare`), ফলে মোড বদলাতে গেলে পুরো পেজ আবার মাউন্ট হত:
 *    layout-এর bot আবার fetch হত না বটে, কিন্তু টেস্টারের কথোপকথন, স্ক্রল আর
 *    সিলেক্ট করা মডেল — সব হারাত। এক পেজে দুই মোড থাকলে সেটা হয় না, আর
 *    ব্যবহারকারীর মনে হয় সে একই ডেস্কে দুই ধরনের কাজ করছে।
 *
 * ⚠️ `layoutId` দিয়ে পিলটা এক জায়গা থেকে আরেক জায়গায় সরে — Framer Motion
 *    এটাকে টগলের বদলে একটা নড়াচড়া হিসেবে দেখায়, যা "আমি এখনো একই পাতায় আছি"
 *    কথাটা না বলে বলে দেয়।
 */
export function PlaygroundHeader({ mode, onModeChange }: PlaygroundHeaderProps) {
  const { chatbotId } = useParams();
  const { t } = useTranslation("chatbots");

  const current = MODES.find((m) => m.key === mode) ?? MODES[0];

  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
            {t("chat_test.playgroundTitle", "Playground")}
          </h1>
          <p className="max-w-2xl text-xs text-muted-foreground sm:text-sm">
            {t(current.hintKey, current.hintFallback)}
          </p>
        </div>

        <Link
          href={`/dashboard/chatbots/${chatbotId}/setup`}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-all hover:bg-muted active:scale-95"
          data-testid="open-setup"
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">{t("chat_test.openSetup", "Configure in Setup")}</span>
        </Link>
      </div>

      {/* Segmented switcher */}
      <div
        role="tablist"
        aria-label={t("chat_test.mode.label", "Playground mode")}
        className="inline-flex w-full items-center gap-1 rounded-2xl border border-border bg-muted/40 p-1 sm:w-auto"
      >
        {MODES.map(({ key, icon: Icon, labelKey, fallback, pro }) => {
          const active = mode === key;

          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onModeChange(key)}
              data-testid={`playground-mode-${key}`}
              className={cn(
                "relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors sm:flex-none sm:px-5 sm:text-sm",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="playground-mode-pill"
                  className="absolute inset-0 rounded-xl bg-card shadow-xs ring-1 ring-border/60"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}

              <span className="relative z-10 inline-flex items-center gap-2 whitespace-nowrap">
                <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                {t(labelKey, fallback)}
                {pro && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[9px] font-bold uppercase tracking-wider",
                      active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground"
                    )}
                  >
                    <Crown className="h-2.5 w-2.5" />
                    {t("chat_test.mode.pro", "PRO")}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
