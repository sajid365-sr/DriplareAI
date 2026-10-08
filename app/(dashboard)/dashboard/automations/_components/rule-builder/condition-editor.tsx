"use client";

import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONDITION_CATALOG, type ConditionFieldSpec, type FieldSpec } from "@/lib/automations/catalog";
import { CONDITION_FIELDS, CONDITION_OPS, type AutomationCondition } from "@/lib/automations/schema";

import { emptyCondition, type ConditionDraft } from "./drafts";
import { FieldInput } from "./field-input";

/**
 * Step two: narrow when the rule applies.
 *
 * Conditions are optional by design — plenty of good rules are a trigger plus an
 * action, and the empty state says so rather than looking like an unfinished
 * form. Operators are limited per field (`orderValue` only offers greater/less
 * than), so the picker cannot produce a comparison the engine cannot evaluate.
 *
 * The two booleans at the top are the rule's own semantics: `matchMode` decides
 * whether conditions are ANDed or ORed, and `stopOnMatch` decides whether a
 * match ends the chain. Both belong next to the conditions rather than in an
 * advanced panel, because they change what the list below them *means*.
 */

interface ConditionEditorProps {
  conditions: ConditionDraft[];
  matchMode: "all" | "any";
  stopOnMatch: boolean;
  tags: { tagId: string; name: string }[];
  onChange: (conditions: ConditionDraft[]) => void;
  onMatchModeChange: (mode: "all" | "any") => void;
  onStopOnMatchChange: (stop: boolean) => void;
}

export function ConditionEditor({
  conditions,
  matchMode,
  stopOnMatch,
  tags,
  onChange,
  onMatchModeChange,
  onStopOnMatchChange,
}: ConditionEditorProps) {
  const { t } = useTranslation("automations");

  function update(index: number, patch: Partial<AutomationCondition>) {
    onChange(conditions.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  function add() {
    onChange([...conditions, emptyCondition()]);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            {t("builder.matchMode", "A conversation must match")}
          </label>
          <Select value={matchMode} onValueChange={(value) => onMatchModeChange(value as "all" | "any")}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("builder.matchAll", "All conditions")}</SelectItem>
              <SelectItem value="any">{t("builder.matchAny", "Any condition")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 self-end rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
          <input
            type="checkbox"
            checked={stopOnMatch}
            onChange={(event) => onStopOnMatchChange(event.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          <span className="text-xs font-medium text-foreground">
            {t("builder.stopOnMatch", "Stop checking other rules after this one matches")}
          </span>
        </label>
      </div>

      {conditions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
          {t("builder.noConditions", "No conditions — this rule runs for every matching trigger.")}
        </p>
      ) : (
        <ul className="space-y-2">
          {conditions.map((condition, index) => {
            const spec = CONDITION_CATALOG[condition.field];
            const ops = spec?.ops ?? CONDITION_OPS;
            // `exists` / `not_exists` are the only operators with no operand.
            const needsValue = condition.op !== "exists" && condition.op !== "not_exists";

            return (
              <li
                key={condition.__key}
                className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-2.5 sm:flex-row sm:items-start"
              >
                <Select
                  value={condition.field}
                  onValueChange={(value) => {
                    // Reset the operator and value together: `contains` on a
                    // boolean, or a leftover text value on a `gt` comparison,
                    // would be saved as a rule that silently never matches.
                    const next = CONDITION_CATALOG[value as keyof typeof CONDITION_CATALOG];
                    update(index, {
                      field: value as AutomationCondition["field"],
                      op: (next?.ops?.[0] ?? "eq") as AutomationCondition["op"],
                      value: next?.valueKind === "number" ? 0 : "",
                    });
                  }}
                >
                  <SelectTrigger className="h-8 text-xs sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_FIELDS.map((field) => (
                      <SelectItem key={field} value={field}>
                        {t(`conditions.${field}.label`, field)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={condition.op}
                  onValueChange={(value) =>
                    update(index, { op: value as AutomationCondition["op"] })
                  }
                >
                  <SelectTrigger className="h-8 text-xs sm:w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ops.map((op) => (
                      <SelectItem key={op} value={op}>
                        {t(`ops.${op}`, op)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="min-w-0 flex-1">
                  {needsValue && spec && (
                    <ConditionValue
                      spec={spec}
                      value={condition.value}
                      tags={tags}
                      onChange={(value) => update(index, { value })}
                    />
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onChange(conditions.filter((_, i) => i !== index))}
                  aria-label={t("builder.remove", "Remove")}
                  className="self-start text-muted-foreground hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        disabled={conditions.length >= 20}
        className="w-full border-dashed"
        data-testid="condition-add"
      >
        <Plus />
        {t("builder.addCondition", "Add condition")}
      </Button>
    </div>
  );
}

/**
 * The right-hand operand.
 *
 * Rendered through the same `FieldInput` the trigger and action editors use,
 * with a spec derived from the condition's value kind — a condition field and
 * an action field of the same kind should never look like two products.
 */
function ConditionValue({
  spec,
  value,
  tags,
  onChange,
}: {
  spec: ConditionFieldSpec;
  value: unknown;
  tags: { tagId: string; name: string }[];
  onChange: (value: AutomationCondition["value"]) => void;
}) {
  const fieldSpec: FieldSpec =
    spec.valueKind === "multiselect"
      ? { key: spec.field, kind: "multiselect", options: spec.options }
      : spec.valueKind === "select" || spec.valueKind === "boolean"
        ? { key: spec.field, kind: "select", options: spec.options }
        : spec.valueKind === "number"
          ? { key: spec.field, kind: "number" }
          : spec.valueKind === "tag"
            ? { key: spec.field, kind: "tag" }
            : { key: spec.field, kind: "text" };

  return (
    <FieldInput
      spec={fieldSpec}
      group="conditions"
      labelKey={`conditions.${spec.field}.label`}
      // The row's first select already names the field; repeating it here would
      // push the actual value input down for no gain.
      hideLabel
      tags={tags}
      value={value}
      // `FieldInput` is the untyped boundary — it yields whatever the spec kind
      // implies — so the narrowing belongs here, once, rather than as a cast at
      // every call site of `ConditionValue`.
      onChange={(next) => onChange(next as AutomationCondition["value"])}
    />
  );
}
