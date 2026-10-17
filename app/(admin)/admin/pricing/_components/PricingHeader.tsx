"use client";

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { RefreshCw, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * `/admin/pricing`-এর শিরোনাম ও ক্রিয়া (১৫.৭)
 * ─────────────────────────────────────────────────────────────────────────────
 * `AISettingsHeader`-এর ছাঁচ অনুসরণ করে — দুটো পর্দাই একই ধরনের কাজ করে (একটি
 * JSON config সম্পাদনা), তাই ব্যবহারকারীর চোখে দুটোকে একরকম দেখানোই সঠিক।
 */
export function PricingHeader({
  saving,
  refreshing,
  dirty,
  onReFetch,
  onSave,
}: {
  saving: boolean;
  refreshing: boolean;
  /** পর্দার মান আর শেষ সেভ-হওয়া মানের ফারাক — থাকলে Save হালকাভাবে জ্বলে ওঠে। */
  dirty: boolean;
  onReFetch: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation("admin");

  // ⚠️ একটি `busy` — কারণ Save পুরো catalogue প্রতিস্থাপন করে, আর ReFetch
  //    DB থেকে টেনে পর্দা বদলে দেয়। দুটো একসাথে চললে last-writer-wins: ReFetch
  //    এনে পুরনো মান বসাত, তারপর Save সেটিই লিখে ফেলত — অর্থাৎ admin-এর
  //    এইমাত্র করা বদল নিঃশব্দে উবে যেত।
  const busy = saving || refreshing;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("pricing.title")}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          {t("pricing.description")}
        </p>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={onReFetch}
          disabled={busy}
          className="h-9 w-full justify-center rounded-xl gap-2 text-xs font-medium sm:w-auto sm:text-sm"
        >
          <RefreshCw className={cn("h-4 w-4 text-muted-foreground", refreshing && "animate-spin")} />
          {t("pricing.refetch")}
        </Button>

        <Button
          size="sm"
          onClick={onSave}
          disabled={busy || !dirty}
          title={dirty ? t("pricing.unsavedHint") : undefined}
          data-testid="pricing-save"
          className={cn(
            "h-9 w-full justify-center rounded-xl gap-2 bg-brand-gradient text-xs font-medium text-primary-foreground shadow-xs hover:opacity-90 sm:w-auto sm:text-sm",
            dirty && !busy && "ring-2 ring-warning/50 ring-offset-1 ring-offset-background"
          )}
        >
          <Save className="h-4 w-4" />
          {saving ? t("pricing.saving") : t("pricing.save")}
        </Button>
      </div>
    </motion.div>
  );
}
