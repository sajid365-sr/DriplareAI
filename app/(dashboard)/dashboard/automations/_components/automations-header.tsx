"use client";

import { useTranslation } from "react-i18next";
import { Plus, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Page header for the Automations rules list.
 *
 * The subtitle is the one place the product explains what this tab is *for* —
 * the previous version promised "social engagements, Comment-to-DM triggers and
 * custom workflow rules" while the page held three static cards.
 */
export function AutomationsHeader({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation("automations");

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Zap className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {t("header.title", "Automations")}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {t(
              "header.subtitle",
              "Rules that answer, tag, and follow up on their own — so your team only handles what needs a human."
            )}
          </p>
        </div>
      </div>

      <Button
        onClick={onCreate}
        className="gap-2 border-none bg-brand-gradient text-white hover:opacity-90"
        data-testid="create-automation-btn"
      >
        <Plus className="h-4 w-4" />
        {t("header.create", "Create Rule")}
      </Button>
    </header>
  );
}
