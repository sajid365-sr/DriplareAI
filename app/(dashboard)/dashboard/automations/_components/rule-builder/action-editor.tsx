"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACTION_CATALOG,
  availableActions,
  type ActionCategory,
} from "@/lib/automations/catalog";
import { ACTION_TYPES, type ActionType } from "@/lib/automations/schema";
import { cn } from "@/lib/utils";

import { iconFor } from "../icons";
import { FieldInput } from "./field-input";
import {
  buttonsToText,
  emptyAction,
  textToButtons,
  type ActionDraft,
} from "./drafts";

/**
 * Step three: what actually happens.
 *
 * Actions are an ordered list, and the order is meaningful — a rule that tags
 * and then hands over to a human reads very differently from one that does it
 * the other way round. Up/down controls rather than drag-and-drop: drag targets
 * are unusable on a phone and this list is never long enough to need them.
 */

const CATEGORIES: ActionCategory[] = ["message", "ai", "crm", "ops"];

interface ActionEditorProps {
  actions: ActionDraft[];
  channels: string[];
  tags: { tagId: string; name: string }[];
  templates: { templateId: string; name: string }[];
  onChange: (actions: ActionDraft[]) => void;
}

export function ActionEditor({
  actions,
  channels,
  tags,
  templates,
  onChange,
}: ActionEditorProps) {
  const { t } = useTranslation("automations");
  const [pickerOpen, setPickerOpen] = useState(actions.length === 0);
  const available = availableActions(channels);

  function update(index: number, patch: Record<string, unknown>) {
    onChange(actions.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= actions.length) return;
    const next = [...actions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function add(type: ActionType) {
    onChange([...actions, emptyAction(type)]);
    setPickerOpen(false);
  }

  /**
   * Swap an action's type in place.
   *
   * The config is discarded rather than merged — carrying `templateId` into
   * `send_text` would save a field the new action does not accept, and the zod
   * schema would then reject the whole rule on save. The row key is kept so the
   * list does not reshuffle under the merchant's cursor.
   */
  function changeType(index: number, type: ActionType) {
    onChange(
      actions.map((entry, i) =>
        i === index ? { ...emptyAction(type), __key: entry.__key } : entry
      )
    );
  }

  return (
    <div className="space-y-3">
      {actions.length === 0 && !pickerOpen && (
        <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
          {t("builder.noActions", "Add at least one action, or the rule can never reply.")}
        </p>
      )}

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {actions.map((action, index) => {
            const type = action.type as ActionType;
            const spec = ACTION_CATALOG[type];
            if (!spec) return null;
            const Icon = iconFor(spec.icon);

            return (
              <motion.li
                key={action.__key}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-xl border border-border/60 bg-card p-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </span>

                  <Select
                    value={type}
                    onValueChange={(value) => changeType(index, value as ActionType)}
                  >
                    <SelectTrigger
                      className="h-8 flex-1 text-xs"
                      data-testid={`action-type-${index}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((candidate) => (
                        <SelectItem key={candidate} value={candidate}>
                          {t(`actions.${candidate}.label`, candidate)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex shrink-0 items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={t("builder.moveUp", "Move up")}
                      className="text-muted-foreground"
                    >
                      <ChevronUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => move(index, 1)}
                      disabled={index === actions.length - 1}
                      aria-label={t("builder.moveDown", "Move down")}
                      className="text-muted-foreground"
                    >
                      <ChevronDown />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onChange(actions.filter((_, i) => i !== index))}
                      aria-label={t("builder.remove", "Remove")}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>

                {spec.fields.length > 0 && (
                  <div className="mt-2.5 space-y-3 border-t border-border/50 pt-2.5">
                    {spec.fields.map((field) => {
                      // A template choice needs the workspace's templates, which
                      // the catalog cannot know about — it is rendered below
                      // instead, with real options.
                      if (type === "send_template" && field.key === "templateId") return null;

                      return (
                        <FieldInput
                          key={field.key}
                          spec={field}
                          group="actionFields"
                          tags={tags}
                          value={
                            field.key === "buttons"
                              ? buttonsToText(action[field.key])
                              : action[field.key]
                          }
                          onChange={(value) =>
                            update(index, {
                              [field.key]: field.key === "buttons" ? textToButtons(value) : value,
                            })
                          }
                        />
                      );
                    })}

                    {type === "send_template" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-foreground">
                          {t("actionFields.templateId", "Template")}
                        </Label>
                        {templates.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-border/60 p-3 text-[11px] text-muted-foreground">
                            {t(
                              "builder.noTemplates",
                              "No templates yet — create one under Templates first."
                            )}
                          </p>
                        ) : (
                          <Select
                            value={String(action.templateId ?? "")}
                            onValueChange={(value) => update(index, { templateId: value })}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {templates.map((template) => (
                                <SelectItem key={template.templateId} value={template.templateId}>
                                  {template.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {/* ── Picker ────────────────────────────────────────────────────────── */}
      {pickerOpen ? (
        <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-3">
          {CATEGORIES.map((category) => {
            const specs = available.filter((spec) => spec.category === category);
            if (specs.length === 0) return null;
            return (
              <div key={category} className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  {t(`actionCategories.${category}`, category)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {specs.map((spec) => {
                    const Icon = iconFor(spec.icon);
                    return (
                      <button
                        key={spec.type}
                        type="button"
                        onClick={() => add(spec.type)}
                        data-testid={`action-option-${spec.type}`}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-2.5 py-1.5",
                          "text-[11px] font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5"
                        )}
                      >
                        <Icon className="h-3 w-3 text-primary" />
                        {t(`actions.${spec.type}.label`, spec.type)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPickerOpen(false)}
            className="w-full text-muted-foreground"
          >
            {t("builder.cancel", "Cancel")}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPickerOpen(true)}
          disabled={actions.length >= 20}
          className="w-full border-dashed"
          data-testid="action-add"
        >
          <Plus />
          {t("builder.addAction", "Add action")}
        </Button>
      )}
    </div>
  );
}
