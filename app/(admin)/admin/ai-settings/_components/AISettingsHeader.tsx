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
  onValidateModels: () => void;
  onFetchOpenRouterModels: () => void;
  onReFetch: () => void;
  onSave: () => void;
}

export function AISettingsHeader({
  validatingModels,
  fetchingOpenRouter,
  saving,
  onValidateModels,
  onFetchOpenRouterModels,
  onReFetch,
  onSave,
}: AISettingsHeaderProps) {
  const { t } = useTranslation("admin");

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
          Direct OpenRouter live model catalog, auto-pricing calculations, and merchant availability matrix.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0 flex-wrap w-full sm:w-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={onValidateModels}
          disabled={validatingModels}
          className="rounded-xl gap-2 text-xs sm:text-sm h-9 border-destructive/30 text-destructive hover:bg-destructive/10 font-medium w-full sm:w-auto justify-center"
        >
          <ShieldAlert className={cn("h-4 w-4", validatingModels && "animate-spin")} />
          Validate Status
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onFetchOpenRouterModels}
          disabled={fetchingOpenRouter}
          className="rounded-xl gap-2 text-xs sm:text-sm h-9 border-primary/20 font-medium w-full sm:w-auto justify-center"
        >
          <Download className={cn("h-4 w-4 text-primary", fetchingOpenRouter && "animate-bounce")} />
          Fetch OpenRouter Models
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="rounded-xl gap-2 text-xs sm:text-sm h-9 font-medium w-full sm:w-auto justify-center"
          onClick={onReFetch}
          disabled={saving}
        >
          <RefreshCw className={cn("h-4 w-4 text-muted-foreground", saving && "animate-spin")} />
          ReFetch
        </Button>

        <Button
          size="sm"
          className="rounded-xl gap-2 text-xs sm:text-sm h-9 bg-brand-gradient text-primary-foreground hover:opacity-90 font-medium shadow-xs w-full sm:w-auto justify-center"
          onClick={onSave}
          disabled={saving}
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </motion.div>
  );
}
