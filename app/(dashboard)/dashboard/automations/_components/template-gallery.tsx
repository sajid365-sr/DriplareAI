"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  PRESET_FAMILIES,
  presetsForChannels,
  type AutomationPreset,
  type PresetFamily,
} from "@/lib/automations/presets";
import { cn } from "@/lib/utils";

import { iconFor } from "./icons";

/**
 * The starter gallery shown when the workspace has no rules yet.
 *
 * Why this exists at all: a blank "Create Rule" button asks the merchant to
 * design a rules engine from scratch, and most never do. Every comparable
 * product answers "what should I automate?" with a shelf of ready-made
 * automations, so this does the same.
 *
 * Choosing one does **not** save anything — it hands the preset to the rule
 * builder pre-filled, so the merchant reviews and edits before it goes live.
 * A preset fired straight into the database would be a rule nobody read
 * sending messages to real customers.
 */
export function TemplateGallery({
  channels,
  onUse,
  busy,
}: {
  channels: string[];
  onUse: (preset: AutomationPreset) => void;
  busy: boolean;
}) {
  const { t } = useTranslation("automations");
  const [family, setFamily] = useState<PresetFamily>("conversation_starters");

  // A preset needing a Facebook page is hidden when none is connected, rather
  // than offered and then silently unable to fire.
  const available = presetsForChannels(channels);
  const visible = available.filter((preset) => preset.family === family);

  return (
    <section className="space-y-3" data-testid="automation-template-gallery">
      <div>
        <h2 className="text-sm font-bold text-foreground">
          {t("gallery.title", "Start from a template")}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("gallery.subtitle", "Pre-built rules you can adapt in a minute.")}
        </p>
      </div>

      {/* Family tabs — horizontally scrollable on phones rather than wrapping. */}
      <nav className="no-scrollbar flex gap-1.5 overflow-x-auto rounded-xl border border-border/60 bg-muted/30 p-1.5">
        {PRESET_FAMILIES.map((id) => {
          const isActive = id === family;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFamily(id)}
              aria-pressed={isActive}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                isActive
                  ? "bg-card text-primary shadow-xs ring-1 ring-border/60"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
              )}
            >
              {t(`presetFamilies.${id}`, id)}
            </button>
          );
        })}
      </nav>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {visible.map((preset) => {
            const Icon = iconFor(preset.icon);
            return (
              <motion.div
                key={preset.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3.5 shadow-xs transition-colors hover:border-primary/30"
                data-testid={`preset-${preset.id}`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-bold text-foreground">
                    {t(`presets.${preset.id}.name`, preset.id)}
                  </h3>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {t(`presets.${preset.id}.description`, "")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => onUse(preset)}
                  className="w-full border-primary/25 text-primary hover:bg-primary/5"
                  data-testid={`preset-use-${preset.id}`}
                >
                  <Plus />
                  {t("gallery.use", "Use this")}
                </Button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {visible.length === 0 && (
        <p className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
          {t("empty.noMatchHint", "Try clearing the search or choosing another agent.")}
        </p>
      )}
    </section>
  );
}
