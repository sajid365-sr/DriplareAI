"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EMPTY_AGENT_INSTRUCTIONS, type AgentInstructions } from "@/lib/domain/agent-instructions";

type FormOption = { slug: string; name: string; description: string | null };
type AgentInstructionsSectionProps = { agentId: string; agentName: string };
const fields = ["purpose", "responsibilities", "tone", "handoff", "boundaries"] as const;

export function AgentInstructionsSection({ agentId, agentName }: AgentInstructionsSectionProps) {
  const { t } = useTranslation("knowledge-base");
  const [instructions, setInstructions] = useState<AgentInstructions>(EMPTY_AGENT_INSTRUCTIONS);
  const [forms, setForms] = useState<FormOption[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [loadedAgentId, setLoadedAgentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const loading = loadedAgentId !== agentId;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/chatbots/${encodeURIComponent(agentId)}/agent-instructions`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load Agent instructions");
        if (cancelled) return;
        setInstructions(data.instructions as AgentInstructions);
        setForms(Array.isArray(data.forms) ? data.forms as FormOption[] : []);
        setChannels(Array.isArray(data.channels) ? data.channels as string[] : []);
      })
      .catch((error: unknown) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : t("agentInstructions.loadError"));
      })
      .finally(() => { if (!cancelled) setLoadedAgentId(agentId); });
    return () => { cancelled = true; };
  }, [agentId, t]);

  const update = <K extends keyof AgentInstructions>(key: K, value: AgentInstructions[K]) => {
    setInstructions((previous) => ({ ...previous, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/chatbots/${encodeURIComponent(agentId)}/agent-instructions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(instructions),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("agentInstructions.saveError"));
      setInstructions(data.instructions as AgentInstructions);
      toast.success(t("agentInstructions.saved", "Agent instructions saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agentInstructions.saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("agentInstructions.loading", "Loading Agent instructions…")}</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-start">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">{t("agentInstructions.title", { name: agentName, defaultValue: "Define {{name}}’s role" })}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("agentInstructions.description", "Business facts and live records come from Business Knowledge. Set this Agent’s job, response behavior, and permitted forms here.")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-muted-foreground">{t("agentInstructions.channels", "Connected channels")}</span>
            {channels.length ? channels.map((channel) => <span key={channel} className="rounded-full border border-border bg-card px-2.5 py-1 text-foreground">{channel}</span>) : <span className="text-muted-foreground">{t("agentInstructions.noChannels", "No channels connected yet")}</span>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium text-foreground">
          {t("agentInstructions.role", "Agent role")}
          <select value={instructions.role} onChange={(event) => update("role", event.target.value as AgentInstructions["role"])} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {(["social_sales", "order_support", "reception_booking", "campaign", "customer_support", "custom"] as const).map((role) => <option key={role} value={role}>{t(`agentInstructions.roles.${role}`)}</option>)}
          </select>
        </label>
        {fields.map((key) => (
          <label key={key} className="space-y-1.5 text-sm font-medium text-foreground md:col-span-2">
            {t(`agentInstructions.fields.${key}.label`)}
            <span className="block text-xs font-normal text-muted-foreground">{t(`agentInstructions.fields.${key}.hint`)}</span>
            <textarea value={instructions[key]} onChange={(event) => update(key, event.target.value)} rows={key === "purpose" ? 2 : 3} maxLength={key === "responsibilities" ? 2000 : key === "boundaries" ? 1600 : 1200} className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
        ))}
      </div>

      <section className="rounded-xl border border-border p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("agentInstructions.allowedForms", "Forms this Agent may use")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t("agentInstructions.formsHint", "Only selected forms can receive records from this Agent. Leave all unchecked to disable custom form submissions.")}</p>
        </div>
        {forms.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {forms.map((form) => {
            const checked = instructions.allowedFormSlugs.includes(form.slug);
            return <label key={form.slug} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/70 bg-card p-3 text-sm hover:border-primary/30">
              <input type="checkbox" checked={checked} onChange={(event) => update("allowedFormSlugs", event.target.checked ? [...instructions.allowedFormSlugs, form.slug] : instructions.allowedFormSlugs.filter((slug) => slug !== form.slug))} className="mt-0.5 accent-primary" />
              <span><span className="block font-medium text-foreground">{form.name}</span>{form.description && <span className="mt-0.5 block text-xs text-muted-foreground">{form.description}</span>}</span>
            </label>;
          })}
        </div> : <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{t("agentInstructions.noForms", "No business forms are configured for this workspace yet.")}</p>}
      </section>

      <div className="flex justify-end border-t border-border pt-4">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? t("agentInstructions.saving", "Saving…") : t("agentInstructions.save", "Save instructions")}
        </Button>
      </div>
    </div>
  );
}
