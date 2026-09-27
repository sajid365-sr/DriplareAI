"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type AISettingsData } from "./types";
import { ModelCombobox } from "./ModelCombobox";

interface QuickSetupPresetsProps {
  settings: AISettingsData;
  onUpdateQuickSetup: (key: "fastModel" | "smartModel" | "geniusModel", value: string) => void;
  /** Credit বদলালে সেটা model catalogue-তেই লেখা হয় — এক জায়গায় থাকলেই দুটো মিলবে। */
  onUpdateCreditCost: (modelId: string, credits: number) => void;
  /** ড্যাশবোর্ডের টেস্ট চ্যাটে প্রযোজ্য গুণক (১ = গ্রাহকের সমান)। */
  onUpdateTestChatMultiplier: (value: number) => void;
}

type PresetKey = "fastModel" | "smartModel" | "geniusModel";

/**
 * তিনটি কার্ডের স্থির অংশ। Credit-এর সংখ্যা কোথাও লেখা নেই — সেটা
 * বাছা মডেলের `credits` থেকে আসে, যা আসলে বিলেও ব্যবহৃত হয়।
 */
const PRESET_CARDS: Array<{
  key: PresetKey;
  label: string;
  hint: string;
  titleClass: string;
  inputClass: string;
}> = [
  {
    key: "fastModel",
    label: "Fast Model",
    hint: "High-speed, low-cost responses",
    titleClass: "text-success",
    inputClass: "border-success/30 text-success",
  },
  {
    key: "smartModel",
    label: "Smart Model",
    hint: "Balanced intelligence & speed",
    titleClass: "text-primary",
    inputClass: "border-primary/30 text-primary",
  },
  {
    key: "geniusModel",
    label: "Genius Model",
    hint: "Top-tier reasoning & accuracy",
    titleClass: "text-warning",
    inputClass: "border-warning/30 text-warning",
  },
];

export function QuickSetupPresets({
  settings,
  onUpdateQuickSetup,
  onUpdateCreditCost,
  onUpdateTestChatMultiplier,
}: QuickSetupPresetsProps) {
  const multiplier = settings.testChatMultiplier;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className="w-full rounded-2xl border border-primary/20 bg-card p-4 sm:p-5 shadow-xs space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Quick Setup Presets (Default Tier Mapping)</h3>
            <p className="text-xs text-muted-foreground">
              The model and the credit cost behind each Fast / Smart / Genius preset. Changing a
              credit here is the same as changing it in the catalogue below — the dashboard reads
              this same value, so what merchants see is what they are charged.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {PRESET_CARDS.map((card) => {
          const modelId = settings.quickSetup[card.key];
          const model = settings.models.find((m) => m.id === modelId);
          const effective = model ? Math.round(model.credits * multiplier) : 0;

          return (
            <div
              key={card.key}
              className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor={`preset-credit-${card.key}`}
                  className={cn("text-xs sm:text-sm font-bold", card.titleClass)}
                >
                  {card.label}
                </label>

                <div className="flex items-center gap-1.5">
                  <Input
                    id={`preset-credit-${card.key}`}
                    type="number"
                    min="1"
                    max="50"
                    disabled={!model}
                    value={model?.credits ?? ""}
                    onChange={(e) => {
                      if (!model) return;
                      onUpdateCreditCost(model.id, parseInt(e.target.value) || 1);
                    }}
                    aria-label={`${card.label} credit cost`}
                    className={cn(
                      "h-8 w-16 text-center font-bold text-xs sm:text-sm rounded-xl bg-background",
                      card.inputClass
                    )}
                  />
                  <span className="text-[11px] font-semibold text-muted-foreground">Cr</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">{card.hint}</p>

              <ModelCombobox
                models={settings.models}
                value={modelId}
                onSelect={(val) => onUpdateQuickSetup(card.key, val)}
                placeholder={`Select ${card.label.replace(" Model", "")} model...`}
              />

              {!model ? (
                <p className="flex items-center gap-1.5 text-[11px] text-warning">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {modelId ? "Not in the catalogue — please pick another model." : "No model selected yet."}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  A merchant using this preset is charged{" "}
                  <span className="font-bold text-foreground">{effective} credit{effective === 1 ? "" : "s"}</span>{" "}
                  per reply
                  {multiplier === 1 ? (
                    "."
                  ) : (
                    <>
                      {" "}
                      ({model.credits} × {multiplier} test-chat multiplier).
                    </>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Test Chat Multiplier ────────────────────────────────────────────
          এই গুণকটা লুকানো থাকলে বিপদ: ড্যাশবোর্ডে "৫ credit" দেখিয়ে গোপনে
          ১০ কাটা যেত, আর কেউ ধরতে পারত না। তাই এটা এখানে স্পষ্ট করে দেখানো
          হয় — আর সাথে সাথেই প্রতিটি কার্ডে তার প্রভাবও লেখা থাকে। */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
        <div className="min-w-0">
          <label htmlFor="test-chat-multiplier" className="text-xs sm:text-sm font-bold text-foreground">
            Test Chat Multiplier
          </label>
          <p className="text-[11px] text-muted-foreground">
            Test chats from the dashboard are charged this many times the credit above.
            1 means a test reply costs exactly what a real customer reply costs.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-muted-foreground">×</span>
          <Input
            id="test-chat-multiplier"
            type="number"
            min="1"
            max="10"
            value={multiplier}
            onChange={(e) =>
              onUpdateTestChatMultiplier(parseInt(e.target.value) || 1)
            }
            className="h-8 w-16 text-center font-bold text-xs sm:text-sm rounded-xl border-primary/20 bg-background text-primary"
          />
        </div>
      </div>
    </motion.div>
  );
}
