"use client";

import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FieldSpec } from "@/lib/automations/catalog";
import { cn } from "@/lib/utils";

/** Which i18n group holds this field's label and hint. */
export type FieldGroup = "triggerFields" | "actionFields" | "conditions";

interface FieldInputProps {
  spec: FieldSpec;
  group: FieldGroup;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Tag choices, needed only for `kind: "tag"`. */
  tags?: { tagId: string; name: string }[];
  disabled?: boolean;
  /**
   * Overrides the derived `<group>.<field>` label key. The condition editor
   * needs this because its labels are nested (`conditions.channel.label`) —
   * reading the parent key would return an object, not a string.
   */
  labelKey?: string;
  /** Hides the label where the surrounding row already names the field. */
  hideLabel?: boolean;
}

/**
 * One generic renderer for every trigger and action field.
 *
 * The catalog decides which input a field gets (`FieldKind`), so adding a
 * trigger means adding a catalog entry — not another hand-written form. The
 * label always comes from the locale, keyed `<group>.<field>`.
 */
export function FieldInput({
  spec,
  group,
  value,
  onChange,
  tags = [],
  disabled,
  labelKey,
  hideLabel,
}: FieldInputProps) {
  const { t } = useTranslation("automations");

  const label = labelKey
    ? t(labelKey, humanize(spec.key))
    : t(`${group}.${spec.key}`, humanize(spec.key));
  const hint = spec.hintKey ? t(`${group}.${spec.hintKey}`, "") : "";

  return (
    <div className="space-y-1.5">
      {/* A switch reads better with its label inline than stacked above it. */}
      {spec.kind === "switch" ? (
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
          <span className="text-xs font-medium text-foreground">{label}</span>
          <Switch
            checked={value === true}
            onCheckedChange={(checked) => onChange(checked)}
            disabled={disabled}
            aria-label={label}
          />
        </label>
      ) : (
        !hideLabel && <Label className="text-xs font-medium text-foreground">{label}</Label>
      )}

      {spec.kind === "textarea" && (
        <Textarea
          value={asString(value)}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          maxLength={spec.max}
          disabled={disabled}
          className="text-sm"
        />
      )}

      {(spec.kind === "text" || spec.kind === "url") && (
        <Input
          value={asString(value)}
          onChange={(event) => onChange(event.target.value)}
          maxLength={spec.max}
          disabled={disabled}
          inputMode={spec.kind === "url" ? "url" : undefined}
          className="text-sm"
        />
      )}

      {spec.kind === "number" && (
        <Input
          type="number"
          value={typeof value === "number" ? String(value) : asString(value)}
          min={spec.min}
          max={spec.max}
          onChange={(event) => {
            const raw = event.target.value;
            onChange(raw === "" ? undefined : Number(raw));
          }}
          disabled={disabled}
          className="text-sm"
        />
      )}

      {spec.kind === "time" && (
        <Input
          type="time"
          value={asString(value)}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="text-sm"
        />
      )}

      {spec.kind === "select" && (
        <Select
          value={asString(value) || (spec.options?.[0]?.value ?? "")}
          onValueChange={(next) => onChange(next)}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(spec.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {optionLabel(t, group, spec.key, option.value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {spec.kind === "multiselect" && (
        <div className="flex flex-wrap gap-1.5">
          {(spec.options ?? []).map((option) => {
            const selected = asArray(value).includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => {
                  const next = selected
                    ? asArray(value).filter((entry) => entry !== option.value)
                    : [...asArray(value), option.value];
                  onChange(next);
                }}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  selected
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {optionLabel(t, group, spec.key, option.value)}
              </button>
            );
          })}
        </div>
      )}

      {spec.kind === "tag" && (
        <Select
          value={asString(value) || ""}
          onValueChange={(next) => onChange(next)}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {tags.map((tag) => (
              <SelectItem key={tag.tagId} value={tag.tagId}>
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function asString(value: unknown): string {
  return typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
}

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

/**
 * Enum labels.
 *
 * Most values are technical by design — `Shipped`, `image`, `POST`,
 * `high_prospect` — and AGENTS.md keeps technical terms in English even in the
 * Bangla UI, so a plain humanised fallback is the right default. A locale may
 * override any single value with `<group>.<field>.options.<value>`.
 */
function optionLabel(
  t: ReturnType<typeof useTranslation>["t"],
  group: FieldGroup,
  key: string,
  value: string
): string {
  const override = t(`${group}.${key}.options.${value}`, "");
  if (override) return override;
  if (group === "triggerFields" && key === "matchMode") {
    return t(`matchModes.${value}`, humanize(value));
  }
  return humanize(value);
}

function humanize(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
