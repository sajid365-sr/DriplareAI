"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ChevronDown, ChevronLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AutomationPreset } from "@/lib/automations/presets";
import {
  DEFAULT_FREQUENCY_CAP,
  DEFAULT_QUIET_HOURS,
  type AutomationCondition,
  type AutomationWriteData,
  type FrequencyCapConfig,
  type QuietHoursConfig,
  type TriggerType,
} from "@/lib/automations/schema";
import { cn } from "@/lib/utils";

import type { Automation, AutomationAgent } from "../types";
import { ActionEditor } from "./action-editor";
import { ConditionEditor } from "./condition-editor";
import {
  emptyAction,
  emptyTrigger,
  keyActions,
  keyConditions,
  parseActionDraft,
  parseConditionDraft,
  parseTriggerDraft,
  type ActionDraft,
  type ConditionDraft,
} from "./drafts";
import { TriggerPicker } from "./trigger-picker";

/**
 * The rule builder: Trigger › Conditions › Actions, with the rarely-touched
 * knobs (quiet hours, frequency cap, priority) folded into an Advanced panel.
 *
 * It writes the *whole* rule on save, matching `PATCH /api/automations/:id`,
 * which deliberately refuses a partial merge — see the note in that route.
 *
 * Every step validates with the same zod schema the engine reads, so a rule
 * that the builder accepts is a rule the runtime can evaluate. The trigger and
 * the action rows stay loose while editing — typing "https://" into a URL field
 * passes through states no schema accepts — so validation happens at the edge
 * of each step rather than on every keystroke.
 */

const STEPS = ["trigger", "conditions", "actions"] as const;
type Step = (typeof STEPS)[number];

const STATUSES = ["draft", "active", "paused"] as const;
type RuleStatus = (typeof STATUSES)[number];

interface RuleBuilderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The rule being edited. `null` starts a new one. */
  automation: Automation | null;
  /** A gallery template to start from. Ignored when `automation` is set. */
  preset: AutomationPreset | null;
  agents: AutomationAgent[];
  /** Connected channels per agent, used to hide impossible triggers. */
  channelsByAgent: Record<string, string[]>;
  tags: { tagId: string; name: string }[];
  templates: { templateId: string; name: string }[];
  /** Called after a successful save so the list can refetch. */
  onSaved: (automation: Automation) => void;
}

export function RuleBuilderSheet({
  open,
  onOpenChange,
  automation,
  preset,
  agents,
  channelsByAgent,
  tags,
  templates,
  onSaved,
}: RuleBuilderSheetProps) {
  const { t } = useTranslation("automations");
  // Computed once: it assigns each row its stable React key, and re-running it
  // would mint new keys on every render.
  const [initial] = useState(() => buildInitial(automation, preset));

  const [step, setStep] = useState<Step>("trigger");
  const [name, setName] = useState(
    () => initial.name || (preset ? t(`presets.${preset.id}.name`, "") : "")
  );
  const [description, setDescription] = useState(initial.description);
  const [chatbotId, setChatbotId] = useState<string | null>(initial.chatbotId);
  const [status, setStatus] = useState<RuleStatus>(initial.status);
  const [priority, setPriority] = useState(initial.priority);
  const [trigger, setTrigger] = useState<Record<string, unknown>>(initial.trigger);
  const [conditions, setConditions] = useState<ConditionDraft[]>(initial.conditions);
  const [matchMode, setMatchMode] = useState<"all" | "any">(initial.matchMode);
  const [stopOnMatch, setStopOnMatch] = useState(initial.stopOnMatch);
  const [actions, setActions] = useState<ActionDraft[]>(initial.actions);
  const [quietHours, setQuietHours] = useState<QuietHoursConfig>(initial.quietHours);
  const [frequencyCap, setFrequencyCap] = useState<FrequencyCapConfig>(initial.frequencyCap);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // A workspace-wide rule (no agent) can still fire on any channel any agent
  // has connected, so the picker unions them rather than showing nothing.
  const channels = chatbotId
    ? channelsByAgent[chatbotId] ?? []
    : Array.from(new Set(Object.values(channelsByAgent).flat()));

  const triggerType = (trigger.type ?? "keyword.match") as TriggerType;
  const stepIndex = STEPS.indexOf(step);

  /** Advance only if the current step is valid, so errors surface where they are. */
  function goNext() {
    if (step === "trigger") {
      if (!name.trim()) {
        setProblem(t("builder.nameRequired", "Give the rule a name."));
        return;
      }
      const parsed = parseTriggerDraft(trigger);
      if (!parsed.success) {
        setProblem(issueText(parsed.error.issues));
        return;
      }
    }

    if (step === "conditions") {
      for (const draft of conditions) {
        const parsed = parseConditionDraft(draft);
        if (!parsed.success) {
          setProblem(issueText(parsed.error.issues));
          return;
        }
      }
    }

    setProblem(null);
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  }

  async function save() {
    if (!name.trim()) {
      setStep("trigger");
      setProblem(t("builder.nameRequired", "Give the rule a name."));
      return;
    }

    const parsedTrigger = parseTriggerDraft(trigger);
    if (!parsedTrigger.success) {
      setStep("trigger");
      setProblem(issueText(parsedTrigger.error.issues));
      return;
    }

    const parsedConditions: AutomationCondition[] = [];
    for (const draft of conditions) {
      const parsed = parseConditionDraft(draft);
      if (!parsed.success) {
        setStep("conditions");
        setProblem(issueText(parsed.error.issues));
        return;
      }
      parsedConditions.push(parsed.data);
    }

    const parsedActions: AutomationWriteData["actions"] = [];
    for (const draft of actions) {
      const parsed = parseActionDraft(draft);
      if (!parsed.success) {
        setStep("actions");
        setProblem(issueText(parsed.error.issues));
        return;
      }
      parsedActions.push(parsed.data);
    }

    if (parsedActions.length === 0) {
      setStep("actions");
      setProblem(t("builder.noActions", "Add at least one action, or the rule can never reply."));
      return;
    }

    const payload: AutomationWriteData = {
      name: name.trim(),
      description: description.trim() || null,
      chatbotId,
      kind: "rule",
      status,
      priority,
      stopOnMatch,
      matchMode,
      trigger: parsedTrigger.data,
      conditions: parsedConditions,
      actions: parsedActions,
      quietHours,
      frequencyCap,
    };

    setSaving(true);
    setProblem(null);
    try {
      const response = await fetch(
        automation ? `/api/automations/${automation.automationId}` : "/api/automations",
        {
          method: automation ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? t("toast.saveFailed", "Could not save the rule."));
        setProblem(data.error ?? null);
        return;
      }
      toast.success(
        automation
          ? t("toast.updated", "Rule updated.")
          : t("toast.created", "Rule created.")
      );
      onSaved(data.automation as Automation);
      onOpenChange(false);
    } catch {
      toast.error(t("toast.saveFailed", "Could not save the rule."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {automation ? t("builder.titleEdit", "Edit rule") : t("builder.titleNew", "New rule")}
          </SheetTitle>
          <SheetDescription>
            {t(
              "builder.subtitle",
              "Three steps: what starts it, what it must match, and what happens."
            )}
          </SheetDescription>
        </SheetHeader>

        {/* ── Stepper ───────────────────────────────────────────────────────── */}
        <nav className="mt-4 grid grid-cols-3 gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-1.5">
          {STEPS.map((id, index) => {
            const isActive = id === step;
            // Later steps stay reachable so a merchant can jump straight to the
            // actions of a rule they already know rather than re-walking it.
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setProblem(null);
                  setStep(id);
                }}
                aria-current={isActive}
                data-testid={`builder-step-${id}`}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all",
                  isActive
                    ? "bg-card text-primary shadow-xs ring-1 ring-border/60"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20"
                  )}
                >
                  {index + 1}
                </span>
                <span className="truncate">{t(`builder.step${capitalize(id)}`, id)}</span>
              </button>
            );
          })}
        </nav>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div className="mt-4 flex-1 space-y-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {step === "trigger" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="rule-name" className="text-xs font-medium text-foreground">
                      {t("builder.basics", "Rule name")}
                    </Label>
                    <Input
                      id="rule-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={t("builder.namePlaceholder", "e.g. Price question → send catalog")}
                      maxLength={120}
                      className="text-sm"
                      data-testid="builder-name"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rule-description" className="text-xs font-medium text-foreground">
                      {t("builder.description", "Description")}
                    </Label>
                    <Textarea
                      id="rule-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder={t("builder.descriptionPlaceholder", "What is this rule for? (optional)")}
                      rows={2}
                      maxLength={500}
                      className="text-sm"
                    />
                  </div>

                  {agents.length > 1 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-foreground">
                        {t("builder.appliesTo", "Applies to")}
                      </Label>
                      <Select
                        value={chatbotId ?? "__all__"}
                        onValueChange={(value) => setChatbotId(value === "__all__" ? null : value)}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">
                            {t("filters.allAgents", "All AI Agents")}
                          </SelectItem>
                          {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="border-t border-border/50 pt-4">
                    <TriggerPicker
                      channels={channels}
                      type={triggerType}
                      config={trigger}
                      tags={tags}
                      onSelect={(type) => setTrigger(emptyTrigger(type))}
                      onConfigChange={setTrigger}
                    />
                  </div>
                </>
              )}

              {step === "conditions" && (
                <ConditionEditor
                  conditions={conditions}
                  matchMode={matchMode}
                  stopOnMatch={stopOnMatch}
                  tags={tags}
                  onChange={setConditions}
                  onMatchModeChange={setMatchMode}
                  onStopOnMatchChange={setStopOnMatch}
                />
              )}

              {step === "actions" && (
                <>
                  <ActionEditor
                    actions={actions}
                    channels={channels}
                    tags={tags}
                    templates={templates}
                    onChange={setActions}
                  />

                  <div className="border-t border-border/50 pt-3">
                    <button
                      type="button"
                      onClick={() => setAdvancedOpen((open) => !open)}
                      aria-expanded={advancedOpen}
                      className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-xs font-semibold text-foreground"
                      data-testid="builder-advanced-toggle"
                    >
                      {t("builder.advanced", "Advanced")}
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 text-muted-foreground transition-transform",
                          advancedOpen && "rotate-180"
                        )}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {advancedOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 space-y-4 rounded-xl border border-border/60 bg-muted/20 p-3.5">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-foreground">
                                {t("builder.status", "Status")}
                              </Label>
                              <div className="flex gap-1.5">
                                {STATUSES.map((value) => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => setStatus(value)}
                                    aria-pressed={status === value}
                                    className={cn(
                                      "flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors",
                                      status === value
                                        ? "border-primary/40 bg-primary/10 text-primary"
                                        : "border-border text-muted-foreground hover:bg-muted"
                                    )}
                                  >
                                    {t(`status.${value}`, value)}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label htmlFor="rule-priority" className="text-xs font-medium text-foreground">
                                {t("builder.priority", "Priority")}
                              </Label>
                              <Input
                                id="rule-priority"
                                type="number"
                                min={1}
                                max={10000}
                                value={String(priority)}
                                onChange={(event) =>
                                  setPriority(Number(event.target.value) || 100)
                                }
                                className="text-sm"
                              />
                              <p className="text-[11px] text-muted-foreground">
                                {t("builder.priorityHint", "Lower numbers are evaluated first.")}
                              </p>
                            </div>

                            <Toggle
                              label={t("builder.quietHoursEnabled", "Enable quiet hours")}
                              hint={t("builder.quietHoursHint", "Rules stay silent during these hours.")}
                              checked={quietHours.enabled}
                              onChange={(enabled) =>
                                setQuietHours((current) => ({ ...current, enabled }))
                              }
                            />
                            {quietHours.enabled && (
                              <div className="flex items-center gap-2 pl-1">
                                <Input
                                  type="time"
                                  value={quietHours.from}
                                  onChange={(event) =>
                                    setQuietHours((current) => ({
                                      ...current,
                                      from: event.target.value,
                                    }))
                                  }
                                  className="h-9 text-sm"
                                  aria-label={t("builder.quietFrom", "From")}
                                />
                                <span className="text-xs text-muted-foreground">→</span>
                                <Input
                                  type="time"
                                  value={quietHours.to}
                                  onChange={(event) =>
                                    setQuietHours((current) => ({
                                      ...current,
                                      to: event.target.value,
                                    }))
                                  }
                                  className="h-9 text-sm"
                                  aria-label={t("builder.quietTo", "To")}
                                />
                              </div>
                            )}

                            <Toggle
                              label={t("builder.frequencyCapEnabled", "Enable frequency cap")}
                              hint={t(
                                "builder.frequencyCapHint",
                                "Stops one customer being messaged repeatedly."
                              )}
                              checked={frequencyCap.enabled}
                              onChange={(enabled) =>
                                setFrequencyCap((current) => ({ ...current, enabled }))
                              }
                            />
                            {frequencyCap.enabled && (
                              <div className="grid grid-cols-1 gap-3 pl-1 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                  <Label className="text-[11px] text-muted-foreground">
                                    {t("builder.perContact", "Messages per customer")}
                                  </Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={String(frequencyCap.perContact)}
                                    onChange={(event) =>
                                      setFrequencyCap((current) => ({
                                        ...current,
                                        perContact: Number(event.target.value) || 1,
                                      }))
                                    }
                                    className="h-9 text-sm"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-[11px] text-muted-foreground">
                                    {t("builder.perWindowHours", "Within (hours)")}
                                  </Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={8760}
                                    value={String(frequencyCap.perWindowHours)}
                                    onChange={(event) =>
                                      setFrequencyCap((current) => ({
                                        ...current,
                                        perWindowHours: Number(event.target.value) || 24,
                                      }))
                                    }
                                    className="h-9 text-sm"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {problem && (
            <p
              className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-[11px] text-destructive"
              data-testid="builder-problem"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 break-words">{problem}</span>
            </p>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <SheetFooter className="mt-4">
          {stepIndex > 0 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setProblem(null);
                setStep(STEPS[stepIndex - 1]);
              }}
              disabled={saving}
              className="gap-1.5"
            >
              <ChevronLeft />
              {t("builder.back", "Back")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {t("builder.cancel", "Cancel")}
            </Button>
          )}

          {step === "actions" ? (
            <Button
              type="button"
              onClick={save}
              disabled={saving}
              className="gap-2 border-none bg-brand-gradient text-white hover:opacity-90"
              data-testid="builder-save"
            >
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {saving ? t("builder.saving", "Saving…") : t("builder.save", "Save rule")}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={goNext}
              className="border-none bg-brand-gradient text-white hover:opacity-90"
              data-testid="builder-next"
            >
              {t("builder.next", "Next")}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────────

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-2">
      <span className="min-w-0">
        <span className="block text-xs font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Initial form state, from whichever source applies.
 *
 * The caller mounts this component with a `key`, so these values are read once
 * per rule — there is no render-phase reset to keep in sync.
 */
function buildInitial(automation: Automation | null, preset: AutomationPreset | null) {
  if (automation) {
    return {
      name: automation.name,
      description: automation.description ?? "",
      chatbotId: automation.chatbotId,
      status: asRuleStatus(automation.status),
      priority: automation.priority,
      trigger: {
        ...emptyTrigger(automation.trigger.type),
        ...(automation.trigger as unknown as Record<string, unknown>),
      },
      conditions: keyConditions(automation.conditions),
      matchMode: automation.matchMode,
      stopOnMatch: automation.stopOnMatch,
      actions: keyActions(automation.actions as unknown as Record<string, unknown>[]),
      quietHours: automation.quietHours,
      frequencyCap: automation.frequencyCap,
    };
  }

  const rule = preset?.rule;
  const presetTrigger = rule?.trigger as Record<string, unknown> | undefined;

  return {
    name: "",
    description: "",
    chatbotId: null as string | null,
    status: "draft" as RuleStatus,
    priority: rule?.priority ?? 100,
    trigger: presetTrigger
      ? { ...emptyTrigger(presetTrigger.type as TriggerType), ...presetTrigger }
      : emptyTrigger("keyword.match"),
    conditions: keyConditions((rule?.conditions ?? []) as AutomationCondition[]),
    matchMode: (rule?.matchMode ?? "all") as "all" | "any",
    stopOnMatch: rule?.stopOnMatch ?? true,
    // A preset only names the fields it cares about, so each action is merged
    // over the same starting values the picker would have produced.
    actions: (rule?.actions ?? []).map(
      (action): ActionDraft => ({
        ...emptyAction(action.type),
        ...(action as unknown as Record<string, unknown>),
      })
    ),
    // A preset may leave these out entirely; the documented defaults are the
    // honest reading of "not configured".
    quietHours: { ...DEFAULT_QUIET_HOURS, ...(rule?.quietHours ?? {}) },
    frequencyCap: { ...DEFAULT_FREQUENCY_CAP, ...(rule?.frequencyCap ?? {}) },
  };
}

/**
 * One line a merchant can act on.
 *
 * Zod's own message is kept (after the field path) because it names the exact
 * constraint — "Must be a public http(s) URL" — while the path says which input
 * to fix. Re-deriving every message in two languages is not worth it, and
 * hiding them would leave "something is wrong" as the only feedback.
 */
function issueText(issues: { path: PropertyKey[]; message: string }[]): string {
  const first = issues[0];
  if (!first) return "";
  const field = first.path.filter((part) => typeof part === "string").join(" · ");
  return field ? `${field}: ${first.message}` : first.message;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * A stored rule's status is a plain string in the database. Anything the enum
 * does not recognise — a spelling from an older release — opens as a draft
 * rather than being silently saved back as itself.
 */
function asRuleStatus(value: string): RuleStatus {
  return (STATUSES as readonly string[]).includes(value) ? (value as RuleStatus) : "draft";
}
