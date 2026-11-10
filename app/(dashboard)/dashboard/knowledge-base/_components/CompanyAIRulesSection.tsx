"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  EMPTY_WORKSPACE_AI_RULES,
  WorkspaceAISettingsPayloadSchema,
  type WorkspaceAISettingsPayload,
} from "@/lib/domain/workspace-ai-settings";

type CompanyAIRulesSectionProps = { workspaceId: string; showIntro?: boolean };

function toLines(value: string) {
  return value.split("\n").map((line) => line.trim().slice(0, 1_000)).filter(Boolean).slice(0, 20);
}

export function CompanyAIRulesSection({ workspaceId, showIntro = true }: CompanyAIRulesSectionProps) {
  const { t } = useTranslation("knowledge-base");
  const [settings, setSettings] = useState<WorkspaceAISettingsPayload>({
    corePrompt: "",
    rules: EMPTY_WORKSPACE_AI_RULES,
  });
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/ai-settings`, { cache: "no-store" });
      const data: unknown = await response.json();
      if (!response.ok || !data || typeof data !== "object") throw new Error("load_failed");
      const candidate = data as Record<string, unknown>;
      const parsed = WorkspaceAISettingsPayloadSchema.safeParse({
        corePrompt: candidate.corePrompt,
        rules: candidate.rules,
      });
      if (!parsed.success || typeof candidate.canEdit !== "boolean") throw new Error("invalid_response");
      setSettings(parsed.data);
      setCanEdit(candidate.canEdit);
    } catch {
      setLoadFailed(true);
      toast.error(t("companyAiRules.loadError", "Could not load Company AI Rules."));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load the rules for the selected workspace.
    void loadSettings();
  }, [loadSettings]);

  const updateRule = <K extends keyof WorkspaceAISettingsPayload["rules"]>(
    key: K,
    value: WorkspaceAISettingsPayload["rules"][K]
  ) => setSettings((current) => ({ ...current, rules: { ...current.rules, [key]: value } }));

  const saveSettings = async () => {
    const validatedSettings = WorkspaceAISettingsPayloadSchema.safeParse(settings);
    if (!validatedSettings.success) {
      toast.error(t("companyAiRules.customLevelValidationError", "Add a name to every custom level before saving."));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/ai-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validatedSettings.data),
      });
      const data: unknown = await response.json();
      if (!response.ok || !data || typeof data !== "object") throw new Error("save_failed");
      const candidate = data as Record<string, unknown>;
      const parsed = WorkspaceAISettingsPayloadSchema.safeParse({
        corePrompt: candidate.corePrompt,
        rules: candidate.rules,
      });
      if (!parsed.success) throw new Error("invalid_response");
      setSettings(parsed.data);
      toast.success(t("companyAiRules.saved", "Company AI Rules saved."));
    } catch {
      toast.error(t("companyAiRules.saveError", "Could not save Company AI Rules."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("companyAiRules.loading", "Loading Company AI Rules…")}</div>;
  }

  if (loadFailed) {
    return <div className="space-y-3 text-center"><p className="text-sm text-muted-foreground">{t("companyAiRules.loadError", "Could not load Company AI Rules.")}</p><Button type="button" variant="outline" onClick={() => void loadSettings()}>{t("common.retry", "Try again")}</Button></div>;
  }

  const listField = (key: "universalPolicies" | "boundaries") => settings.rules[key].join("\n");

  const addCustomRule = () => {
    if (settings.rules.customRules.length >= 20) return;
    updateRule("customRules", [
      ...settings.rules.customRules,
      { id: crypto.randomUUID(), label: "", instruction: "" },
    ]);
  };

  const updateCustomRule = (id: string, patch: Partial<WorkspaceAISettingsPayload["rules"]["customRules"][number]>) => {
    updateRule("customRules", settings.rules.customRules.map((rule) => rule.id === id ? { ...rule, ...patch } : rule));
  };

  return (
    <div className="space-y-6">
      {showIntro && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("companyAiRules.title", "Business Rules")}</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("companyAiRules.description", "These shared policies and instructions apply to every Agent. Use Answers for customer questions and Sources for longer reference material.")}</p>
          </div>
        </div>
      )}

      {!canEdit && <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{t("companyAiRules.readOnly", "You can view these rules, but only a workspace owner or admin can edit them.")}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Field label={t("companyAiRules.brandVoice", "Brand voice and etiquette")} hint={t("companyAiRules.brandVoiceHint", "How should the agent sound? For example, polite and concise.")}>
          <Textarea value={settings.rules.brandVoice} onChange={(event) => updateRule("brandVoice", event.target.value)} maxLength={2_000} disabled={!canEdit} rows={4} placeholder={t("companyAiRules.brandVoicePlaceholder")} />
        </Field>
        <Field label={t("companyAiRules.languagePolicy", "Language policy")} hint={t("companyAiRules.languagePolicyHint", "Describe preferred languages and when to mirror the customer's language.")}>
          <Textarea value={settings.rules.languagePolicy} onChange={(event) => updateRule("languagePolicy", event.target.value)} maxLength={2_000} disabled={!canEdit} rows={4} placeholder={t("companyAiRules.languagePolicyPlaceholder")} />
        </Field>
        <Field label={t("companyAiRules.customerAddress", "How to address customers")} hint={t("companyAiRules.customerAddressHint", "For example, use ‘আপনি’ when speaking Bengali.")}>
          <Textarea value={settings.rules.customerAddress} onChange={(event) => updateRule("customerAddress", event.target.value)} maxLength={1_000} disabled={!canEdit} rows={3} placeholder={t("companyAiRules.customerAddressPlaceholder")} />
        </Field>
        <Field label={t("companyAiRules.universalPolicies", "Universal business policies")} hint={t("companyAiRules.listHint", "Add one rule per line (up to 20). These apply to every agent.")}>
          <Textarea value={listField("universalPolicies")} onChange={(event) => updateRule("universalPolicies", toLines(event.target.value))} disabled={!canEdit} rows={4} placeholder={t("companyAiRules.universalPoliciesPlaceholder")} />
        </Field>
        <Field label={t("companyAiRules.boundaries", "Boundaries and prohibited claims")} hint={t("companyAiRules.boundariesHint", "What must agents avoid saying, promising, or recommending?")}>
          <Textarea value={listField("boundaries")} onChange={(event) => updateRule("boundaries", toLines(event.target.value))} disabled={!canEdit} rows={4} placeholder={t("companyAiRules.boundariesPlaceholder")} />
        </Field>
        <Field label={t("companyAiRules.additionalInstructions", "Additional company instructions")} hint={t("companyAiRules.additionalInstructionsHint", "Optional shared instructions that do not fit the fields above.")}>
          <Textarea value={settings.corePrompt} onChange={(event) => setSettings((current) => ({ ...current, corePrompt: event.target.value }))} maxLength={4_000} disabled={!canEdit} rows={4} placeholder={t("companyAiRules.additionalInstructionsPlaceholder")} />
        </Field>
      </div>

      <section className="space-y-4 border-t border-border pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("companyAiRules.customLevelsTitle", "Custom levels")}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("companyAiRules.customLevelsHint", "Create your own rule category and add the instruction agents should follow.")}</p>
          </div>
          {canEdit && <Button type="button" variant="outline" size="sm" onClick={addCustomRule} disabled={settings.rules.customRules.length >= 20} className="shrink-0 gap-1.5">
            <Plus className="h-4 w-4" />{t("companyAiRules.addCustom", "Add Custom")}
          </Button>}
        </div>

        {settings.rules.customRules.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {settings.rules.customRules.map((rule, index) => (
              <div key={rule.id} className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-muted-foreground">{t("companyAiRules.customLevelNumber", { number: index + 1, defaultValue: "Custom level {{number}}" })}</p>
                  {canEdit && <Button type="button" variant="ghost" size="icon" aria-label={t("companyAiRules.removeCustom", "Remove custom level")} onClick={() => updateRule("customRules", settings.rules.customRules.filter((item) => item.id !== rule.id))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>}
                </div>
                <Field label={t("companyAiRules.customLevelName", "Level name")} hint={t("companyAiRules.customLevelNameHint", "Give this rule category a short name.")}>
                  <Input value={rule.label} onChange={(event) => updateCustomRule(rule.id, { label: event.target.value })} maxLength={80} disabled={!canEdit} required aria-invalid={!rule.label.trim()} placeholder={t("companyAiRules.customLevelNamePlaceholder", "For example, Booking rules")} />
                </Field>
                <Field label={t("companyAiRules.customInstruction", "Instruction")} hint={t("companyAiRules.customInstructionHint", "Write what every agent should follow for this category.")}>
                  <Textarea value={rule.instruction} onChange={(event) => updateCustomRule(rule.id, { instruction: event.target.value })} maxLength={4_000} disabled={!canEdit} rows={4} placeholder={t("companyAiRules.customInstructionPlaceholder")} />
                </Field>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground">{t("companyAiRules.customLevelsEmpty", "No custom levels yet. Add one when the standard fields do not cover a company rule.")}</p>
        )}
        {settings.rules.customRules.length >= 20 && <p className="text-xs text-muted-foreground">{t("companyAiRules.customLevelsLimit", "You can add up to 20 custom levels.")}</p>}
      </section>

      {canEdit && <div className="flex justify-end border-t border-border pt-4"><Button type="button" onClick={saveSettings} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{saving ? t("common.saving", "Saving…") : t("common.save", "Save")}</Button></div>}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return <label className="block space-y-2"><span className="block text-sm font-medium text-foreground">{label}</span><span className="block text-xs leading-5 text-muted-foreground">{hint}</span>{children}</label>;
}
