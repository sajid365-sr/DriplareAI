"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { TFunction } from "i18next";
import { ArrowUpRight, Zap } from "lucide-react";

import { getPlansForRegion, resolveLocalStr } from "@/lib/domain/plan-config";
import type { Region } from "@/lib/core/region";
import { cn } from "@/lib/core/utils";

/**
 * QuotaProgress — merchant-এর চলতি billing cycle-এর credit ব্যবহার।
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ Refactor (AGENTS.md §6): আগে props `any` ছিল এবং `bg-red-500` /
 * `bg-emerald-500` এর মতো hard-coded রঙ ব্যবহৃত হত — তাই dark mode-এ ঠিক
 * দেখাত না। এখন সব রঙ `globals.css`-এর CSS variable (`--destructive`,
 * `--success`, `--warning`) থেকে আসে।
 *
 * ➕ নতুন: ৮০% ছাড়ালে একটি inline "Upgrade / Top-up" prompt দেখানো হয়।
 * কারণ ১০০%-এ পৌঁছে গেলে AI reply বন্ধ হয়ে যায় — তখন জানানোর চেয়ে আগে
 * জানানো অনেক কাজে দেয়। (৮০% ও ১০০%-এ merchant email-ও পান —
 * `lib/services/usage-alerts.ts`)।
 */

/** এই component যতটুকু ডেটা ব্যবহার করে। */
interface QuotaData {
  creditsUsedThisCycle?: number;
  creditsRemaining?: number;
  plan?: string;
}

interface QuotaProgressProps {
  data: QuotaData | null;
  t: TFunction;
  /** এই cycle-এর মোট credit (plan + bonus)। Enterprise-এ Infinity হতে পারে। */
  included: number;
  /** ব্যবহৃত credit-এর শতকরা হার (0–100)। */
  pct: number;
  /** কোন region-এর plan তালিকা থেকে upgrade সুপারিশ করা হবে। */
  region: Region;
  /** plan-এর নাম কোন ভাষায় দেখানো হবে ("bn" | "en")। */
  lang: string;
}

/** ৮০% থেকে সতর্কতা — এর নিচে হলে শুধু তথ্য। */
const WARN_THRESHOLD = 80;
/** ৯০% থেকে বার-টি লাল — জরুরি অবস্থা। */
const DANGER_THRESHOLD = 90;

export function QuotaProgress({ data, t, included, pct, region, lang }: QuotaProgressProps) {
  const used = data?.creditsUsedThisCycle ?? 0;
  const isWarning = pct >= WARN_THRESHOLD;
  const isDanger = pct >= DANGER_THRESHOLD;

  // ── Upgrade সুপারিশ ──────────────────────────────────────────────────────────
  // বর্তমান plan-এর চেয়ে বেশি credit দেওয়া পরবর্তী plan-টি খোঁজা হয়।
  // না পেলে (সর্বোচ্চ plan-এ আছেন) top-up-ই একমাত্র পথ।
  const suggestion = getNextPlanSuggestion(data?.plan, region);

  const upgradeHref = suggestion
    ? `/dashboard/payment?plan=${suggestion.key}&reason=${isDanger ? "exhausted" : "threshold"}`
    : `/dashboard/payment?reason=${isDanger ? "exhausted" : "threshold"}`;

  return (
    <div className="rounded-2xl border border-border bg-card bg-gradient-to-r from-primary/5 to-transparent p-6 shadow-sm">
      {/* ── Header ── */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-lg font-bold">{t("usage.quota.usage", "Usage Summary")}</div>
        <div className="text-sm font-bold tabular-nums">
          {used.toLocaleString()}{" "}
          <span className="text-xs font-medium text-muted-foreground">
            / {included === Infinity ? "∞" : included.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="mb-4 h-3 overflow-hidden rounded-full bg-muted shadow-inner">
        <motion.div
          className={cn(
            "h-full rounded-full shadow-sm",
            isDanger ? "bg-destructive" : isWarning ? "bg-warning" : "bg-brand-gradient"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2 italic">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              isDanger ? "animate-pulse bg-destructive" : "bg-success"
            )}
          />
          <span className="truncate">
            {t("usage.quota.left", { count: data?.creditsRemaining ?? 0 })}
          </span>
        </div>
        <div className="shrink-0 tabular-nums">
          {pct}% {t("usage.quota.consumed", "consumed")}
        </div>
      </div>

      {/* ── 80%+ upgrade prompt ── */}
      {isWarning && included !== Infinity && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={cn(
            "mt-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
            isDanger
              ? "border-destructive/30 bg-destructive/5"
              : "border-warning/30 bg-warning/10"
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                isDanger ? "bg-destructive/15 text-destructive" : "bg-warning/20 text-warning"
              )}
            >
              <Zap className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {isDanger
                  ? t("usage.quota.depletedTitle", "Your credits have run out")
                  : t("usage.quota.warnTitle", "You have used 80% of your credits")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isDanger
                  ? t(
                      "usage.quota.depletedDesc",
                      "AI replies stop once the balance is empty. Top up or upgrade to keep your agents running."
                    )
                  : t(
                      "usage.quota.warnDesc",
                      "Top up or upgrade now to avoid any interruption to your AI agents."
                    )}
              </p>
              {suggestion && (
                <p className="mt-1.5 text-[11px] font-medium text-primary">
                  {t("usage.quota.suggested", {
                    plan: resolveLocalStr(suggestion.name, lang),
                    defaultValue: "Suggested: {{plan}}",
                  })}
                </p>
              )}
            </div>
          </div>

          <Link
            href={upgradeHref}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-gradient px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {isDanger
              ? t("usage.quota.ctaTopup", "Top up now")
              : t("usage.quota.ctaUpgrade", "Upgrade or top up")}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      )}
    </div>
  );
}

/**
 * বর্তমান plan-এর চেয়ে বেশি credit দেওয়া পরবর্তী plan-টি ফেরত দেয়।
 * সর্বোচ্চ plan-এ থাকলে (বা plan চেনা না গেলে) `null` — তখন top-up দেখানো হয়।
 */
function getNextPlanSuggestion(currentPlan: string | undefined, region: Region) {
  if (!currentPlan) return null;

  const plans = getPlansForRegion(region);
  const currentIndex = plans.findIndex((p) => p.key === currentPlan);
  if (currentIndex === -1) return null;

  // Infinity (Enterprise) হলে আর upgrade নেই
  const current = plans[currentIndex];
  return plans
    .slice(currentIndex + 1)
    .find((p) => p.includedCredits > current.includedCredits) ?? null;
}
