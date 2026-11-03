"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Building2, Loader2 } from "lucide-react";

import { WorkspaceAISettingsPayloadSchema, formatWorkspaceAIRules } from "@/lib/domain/workspace-ai-settings";

type WorkspaceAIRulesPreviewProps = { workspaceId: string };

export function WorkspaceAIRulesPreview({ workspaceId }: WorkspaceAIRulesPreviewProps) {
  const { t } = useTranslation("chatbots");
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!workspaceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Clear inherited data when the active workspace changes.
      setLoading(false);
      setPreview("");
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setFailed(false);
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/ai-settings`, { cache: "no-store" });
        const data: unknown = await response.json();
        if (!response.ok || !data || typeof data !== "object") throw new Error("load_failed");
        const candidate = data as Record<string, unknown>;
        const parsed = WorkspaceAISettingsPayloadSchema.safeParse({ corePrompt: candidate.corePrompt, rules: candidate.rules });
        if (!parsed.success) throw new Error("invalid_response");
        if (!cancelled) setPreview(formatWorkspaceAIRules(parsed.data.corePrompt, parsed.data.rules));
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [workspaceId]);

  return (
    <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("chat_test.config.workspaceRulesTitle", "Company AI Rules — Inherited from Workspace")}</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("chat_test.config.workspaceRulesDescription", "These instructions apply to every agent in this workspace. Edit them from Workspace Knowledge Base.")}</p>
          </div>
        </div>
        <Link href="/dashboard/knowledge-base?tab=company-ai-rules" className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
          {t("chat_test.config.editWorkspaceRules", "Edit Workspace Rules")}
        </Link>
      </div>

      <div className="mt-3 rounded-lg border border-border/70 bg-card/70 p-3 text-xs leading-5 text-muted-foreground">
        {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("chat_test.config.workspaceRulesLoading", "Loading inherited rules…")}</span>
          : failed ? t("chat_test.config.workspaceRulesError", "Workspace rules could not be loaded. The saved agent prompt is unchanged.")
            : preview ? <pre className="whitespace-pre-wrap font-sans">{preview}</pre>
              : t("chat_test.config.workspaceRulesEmpty", "No Company AI Rules have been added to this workspace yet.")}
      </div>
    </section>
  );
}
