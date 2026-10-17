"use client";

import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";

import {
  TRIGGER_CATALOG,
  triggersByFamily,
  type TriggerSpec,
} from "@/lib/automations/catalog";
import type { TriggerFamily, TriggerType } from "@/lib/automations/schema";
import { cn } from "@/lib/utils";

import { iconFor } from "../icons";
import { FieldInput } from "./field-input";

/**
 * Step one: pick what starts the rule, then fill in that trigger's config.
 *
 * Triggers are grouped by family rather than listed flat, because "Comment on a
 * post" and "Order status changed" are answers to different questions and a
 * flat list of fourteen makes the merchant read all of them.
 *
 * Triggers a channel-restricted to something this agent has not connected are
 * not shown at all — offering one that can never fire is how a merchant ends up
 * with a rule list full of things that quietly do nothing.
 */

const FAMILIES: TriggerFamily[] = ["messaging", "social", "time", "commerce", "inbox"];

interface TriggerPickerProps {
  channels: string[];
  type: TriggerType;
  config: Record<string, unknown>;
  onSelect: (type: TriggerType) => void;
  onConfigChange: (config: Record<string, unknown>) => void;
  tags: { tagId: string; name: string }[];
}

export function TriggerPicker({
  channels,
  type,
  config,
  onSelect,
  onConfigChange,
  tags,
}: TriggerPickerProps) {
  const { t } = useTranslation("automations");
  const grouped = triggersByFamily(channels);
  const spec = TRIGGER_CATALOG[type];

  return (
    <div className="space-y-4">
      {FAMILIES.map((family) => {
        const specs = grouped[family];
        if (specs.length === 0) return null;

        return (
          <div key={family} className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
              {t(`families.${family}`, family)}
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {specs.map((item) => (
                <TriggerOption
                  key={item.type}
                  spec={item}
                  selected={item.type === type}
                  label={t(`triggers.${item.type}.label`, item.type)}
                  description={t(`triggers.${item.type}.description`, "")}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* The chosen trigger's own config, revealed underneath. */}
      <AnimatePresence mode="wait">
        {spec.fields.length > 0 && (
          <motion.div
            key={type}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-3.5">
              {spec.fields.map((field) => (
                <FieldInput
                  key={field.key}
                  spec={field}
                  group="triggerFields"
                  tags={tags}
                  value={
                    // `keywords` and `buttons` are stored as arrays but edited
                    // as comma-separated text — one input beats a chip editor
                    // that needs a click per Bengali keyword.
                    field.key === "keywords" ? listText(config[field.key]) : config[field.key]
                  }
                  onChange={(value) =>
                    onConfigChange({
                      ...config,
                      [field.key]: field.key === "keywords" ? splitList(value) : value,
                    })
                  }
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TriggerOption({
  spec,
  selected,
  label,
  description,
  onSelect,
}: {
  spec: TriggerSpec;
  selected: boolean;
  label: string;
  description: string;
  onSelect: (type: TriggerType) => void;
}) {
  const Icon = iconFor(spec.icon);

  return (
    <button
      type="button"
      onClick={() => onSelect(spec.type)}
      aria-pressed={selected}
      data-testid={`trigger-option-${spec.type}`}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all",
        selected
          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
          : "border-border/60 hover:border-primary/25 hover:bg-muted/40"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-xs font-semibold text-foreground">{label}</span>
          {selected && <Check className="h-3 w-3 shrink-0 text-primary" />}
        </span>
        {description && (
          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </button>
  );
}

function listText(value: unknown): string {
  return Array.isArray(value) ? value.map(String).join(", ") : "";
}

function splitList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
