"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Zap, Coins, AlertTriangle, Check } from "lucide-react";
import { FacebookIcon } from "@/components/icons/PlatformIcons";
import { PRODUCT_SYNC_FEE } from "@/lib/domain/credit-config";

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnectedProfile = {
  platform: string;
  name: string;
  label: string;
};

type SyncConfig = {
  limit: number;
  since: string | undefined;
};

type SyncConfigPickerProps = {
  profiles: ConnectedProfile[];
  credits: number | null;
  busy: boolean;
  onSync: (config: SyncConfig) => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const POST_COUNT_OPTIONS = [10, 20, 30, 50];

type DateOption = {
  key: string;
  labelKey: string;
  getSince: () => string | undefined;
};

const DATE_OPTIONS: DateOption[] = [
  {
    key: "last7",
    labelKey: "sync.dateOptions.last7",
    getSince: () => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.toISOString().split("T")[0];
    },
  },
  {
    key: "last30",
    labelKey: "sync.dateOptions.last30",
    getSince: () => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split("T")[0];
    },
  },
  {
    key: "last90",
    labelKey: "sync.dateOptions.last90",
    getSince: () => {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      return d.toISOString().split("T")[0];
    },
  },
  {
    key: "all",
    labelKey: "sync.dateOptions.all",
    getSince: () => undefined,
  },
];

/**
 * Step 1 of the sync wizard.
 * Shows connected FB pages, post count selector, date filter,
 * credit fee summary, and the "Sync Products Now" button.
 */
export function SyncConfigPicker({ profiles, credits, busy, onSync }: SyncConfigPickerProps) {
  const { t } = useTranslation("products");

  const [postCount, setPostCount] = useState(20);
  const [dateKey, setDateKey] = useState("last30");

  const notEnoughCredits = credits !== null && credits < PRODUCT_SYNC_FEE;

  function handleStart() {
    const dateOpt = DATE_OPTIONS.find((o) => o.key === dateKey);
    onSync({
      limit: postCount,
      since: dateOpt?.getSince(),
    });
  }

  // No connected FB pages → friendly empty state
  if (profiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card py-16 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Zap className="h-7 w-7" />
        </span>
        <p className="max-w-sm text-sm font-medium text-foreground">
          {t("sync.noFbIntegration")}
        </p>
        <p className="mt-2 max-w-sm text-xs text-muted-foreground">
          Go to <strong>Platforms</strong> to connect your Facebook Page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Platform list (FB only for now) */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">{t("sync.selectPlatform")}</p>
        <p className="text-xs text-muted-foreground -mt-1">{t("sync.selectPlatformDesc")}</p>

        {profiles.map((profile) => (
          <div
            key={profile.platform}
            className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1877F2]/10">
              <FacebookIcon className="h-5 w-5 text-[#1877F2]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{profile.label}</p>
              <p className="truncate text-xs text-muted-foreground">{profile.name}</p>
            </div>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-3.5 w-3.5" />
            </span>
          </div>
        ))}
      </div>

      {/* Post count selector */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{t("sync.postCountLabel")}</p>
        <div className="flex flex-wrap gap-2">
          {POST_COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setPostCount(count)}
              disabled={busy}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                postCount === count
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {count} posts
            </button>
          ))}
        </div>
      </div>

      {/* Date filter */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{t("sync.dateFilterLabel")}</p>
        <div className="flex flex-wrap gap-2">
          {DATE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setDateKey(opt.key)}
              disabled={busy}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                dateKey === opt.key
                  ? "bg-violet-600 text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Credit fee summary */}
      <div className="space-y-2 rounded-xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Coins className="h-4 w-4" />
            {t("sync.feeLabel")}
          </span>
          <span className="font-semibold text-foreground">
            {PRODUCT_SYNC_FEE} credits
          </span>
        </div>
        {credits !== null && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t("sync.creditsAvailable")}</span>
            <span className={notEnoughCredits ? "font-semibold text-destructive" : "text-muted-foreground"}>
              {credits.toLocaleString()}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-xs border-t border-border/40 pt-2 mt-2">
          <span className="text-muted-foreground">Cost per sync run</span>
          <span className="text-primary font-medium">{t("sync.creditsPerProduct")}</span>
        </div>
      </div>

      {/* Insufficient credits warning */}
      {notEnoughCredits && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-xs text-muted-foreground">{t("sync.insufficientCredits")}</p>
        </div>
      )}

      {/* Sync button */}
      <button
        type="button"
        onClick={handleStart}
        disabled={busy || notEnoughCredits}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-5 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Zap className="h-4 w-4" />
        {t("sync.syncButton")}
      </button>
    </div>
  );
}
