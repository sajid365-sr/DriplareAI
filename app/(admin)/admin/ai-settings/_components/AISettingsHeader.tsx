"use client";

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Download, RefreshCw, Save, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AISettingsHeaderProps {
  validatingModels: boolean;
  fetchingOpenRouter: boolean;
  saving: boolean;
  /** True while the manual ReFetch is in flight — the page stays mounted. */
  refreshing: boolean;
  /**
   * পর্দায় অসেভ করা পরিবর্তন আছে কি না (Catalogue-র Credit ইনপুট, Merchant
   * Active টগল, USD→BDT রেট)। থাকলে Save বাটনটা হালকাভাবে জ্বলে ওঠে — নাহলে
   * admin-এর জানার উপায় নেই যে কিছু সেভ করা বাকি আছে।
   */
  dirty: boolean;
  onValidateModels: () => void;
  onFetchOpenRouterModels: () => void;
  onReFetch: () => void;
  onSave: () => void;
}

export function AISettingsHeader({
  validatingModels,
  fetchingOpenRouter,
  saving,
  refreshing,
  dirty,
  onValidateModels,
  onFetchOpenRouterModels,
  onReFetch,
  onSave,
}: AISettingsHeaderProps) {
  const { t } = useTranslation("admin");

  /**
   * ⚠️ চারটা অপারেশন — Save, ReFetch, Fetch, Validate — সবগুলোই পুরো
   *    `ai_credit_rules` একসাথে লেখে বা তার উপর ভিত্তি করে সিদ্ধান্ত নেয়।
   *    আগে প্রতিটা বাটন কেবল **নিজের** লোডিং state-টা দেখত, তাই Save চলাকালীন
   *    Validate চাপা যেত, বা Validate আর Fetch একসাথে চাপা যেত। তখন
   *    last-writer-wins: Validate-এর deprecated করা মডেল Save-এর পুরনো কপিতে
   *    আবার জীবিত হয়ে উঠত — অর্থাৎ admin-এর চোখের সামনে একটা অপারেশনের ফল
   *    আরেকটা মুছে দিত।
   *
   *    এখন একটা চললে বাকি তিনটাও বন্ধ — প্রতিটা কাজ শেষ পর্যন্ত নিরাপদে যেতে পারে।
   */
  const busy = validatingModels || fetchingOpenRouter || saving || refreshing;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
    >
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {t("aiSettings.title", "AI Model & Credit Rules Engine")}
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          {t("aiSettings.description")}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0 flex-wrap w-full sm:w-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={onValidateModels}
          disabled={busy}
          title={busy ? t("aiSettings.busyHint") : undefined}
          className="rounded-xl gap-2 text-xs sm:text-sm h-9 border-destructive/30 text-destructive hover:bg-destructive/10 font-medium w-full sm:w-auto justify-center"
        >
          <ShieldAlert className={cn("h-4 w-4", validatingModels && "animate-spin")} />
          {t("aiSettings.validateStatus")}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onFetchOpenRouterModels}
          disabled={busy}
          title={busy ? t("aiSettings.busyHint") : undefined}
          className="rounded-xl gap-2 text-xs sm:text-sm h-9 border-primary/20 font-medium w-full sm:w-auto justify-center"
        >
          <Download className={cn("h-4 w-4 text-primary", fetchingOpenRouter && "animate-bounce")} />
          {t("aiSettings.fetchModels")}
        </Button>

        {/* ⚠️ এখানে আগে `saving` চেক করা হত, অথচ `onReFetch` সেট করে `loading`।
            ফলে বাটনটি কখনো নিজের লোডিং দেখাত না — বরং পুরো পেজ unmount হয়ে
            সাদা "Loading…" হয়ে যেত। এখন নিজের `refreshing` state-ই চলে। */}
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl gap-2 text-xs sm:text-sm h-9 font-medium w-full sm:w-auto justify-center"
          onClick={onReFetch}
          disabled={busy}
          title={busy ? t("aiSettings.busyHint") : undefined}
        >
          <RefreshCw className={cn("h-4 w-4 text-muted-foreground", refreshing && "animate-spin")} />
          {t("aiSettings.refetch")}
        </Button>

        <Button
          size="sm"
          className={cn(
            "rounded-xl gap-2 text-xs sm:text-sm h-9 bg-brand-gradient text-primary-foreground hover:opacity-90 font-medium shadow-xs w-full sm:w-auto justify-center",
            // অসেভ করা পরিবর্তন থাকলে হালকা রিং — "এখানে কিছু বাকি আছে"।
            dirty && !busy && "ring-2 ring-warning/50 ring-offset-1 ring-offset-background"
          )}
          onClick={onSave}
          disabled={busy || !dirty}
          title={dirty ? t("aiSettings.unsavedHint") : undefined}
        >
          <Save className="h-4 w-4" />
          {saving ? t("aiSettings.saving") : t("aiSettings.save")}
        </Button>
      </div>
    </motion.div>
  );
}
