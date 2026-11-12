"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, FileText, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Workspace } from "@/lib/core/workspace";
import { AutoTrainSection } from "./AutoTrainSection";
import { BusinessDataSection } from "./BusinessDataSection";
import { CompanyAIRulesSection } from "./CompanyAIRulesSection";
import { ContentTrainingSection } from "./ContentTrainingSection";
import { BusinessAnswersManager } from "./BusinessAnswersManager";
import type { KBAgent } from "./types";

type SourcesView = "sources" | "conversations";

export function BusinessProfileAndPoliciesSection({
  workspace,
  workspaceId,
}: {
  workspace: Workspace | null;
  workspaceId: string;
}) {
  const { t } = useTranslation("knowledge-base");

  return (
    <div className="space-y-5">
      <section className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <Building2 className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("tabs.businessProfile", "Business Profile & Policies")}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("businessKnowledge.profileDescription", "Keep business facts and shared operating rules here. Products, orders, offers, and courier settings stay in their own business modules.")}</p>
        </div>
      </section>
      <BusinessDataSection workspace={workspace} showIntro={false} />
      <section id="company-ai-rules" className="scroll-mt-24 space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("companyAiRules.title", "Business rules")}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("companyAiRules.description", "Shared policies and instructions apply to every Agent. Use Answers for common customer questions and Sources for longer reference material.")}</p>
          </div>
        </div>
        <CompanyAIRulesSection workspaceId={workspaceId} showIntro={false} />
      </section>
    </div>
  );
}

export function BusinessAnswersSection({
  workspaceId,
  onKnowledgeChange,
}: {
  workspaceId: string;
  onKnowledgeChange: () => void;
}) {
  return (
    <section className="space-y-4">
      <BusinessAnswersManager workspaceId={workspaceId} onKnowledgeChange={onKnowledgeChange} />
    </section>
  );
}

export function BusinessSourcesSection({
  agents,
  selectedAgentId,
  agentName,
  workspaceId,
  onSourcesChange,
  onKnowledgeChange,
  initialView,
}: {
  agents: KBAgent[];
  selectedAgentId: string;
  agentName: string;
  workspaceId: string;
  onSourcesChange: (count: number) => void;
  onKnowledgeChange: () => void;
  initialView: SourcesView;
}) {
  const { t } = useTranslation("knowledge-base");
  const [view, setView] = useState<SourcesView>(initialView);
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm leading-6 text-muted-foreground">{t("businessKnowledge.sourcesDescription", "Add long-form text, a website, or a supported file once for every Agent. Use Answers for short, direct customer questions.")}</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("businessKnowledge.sourceActions", "Business knowledge sources")}>
        <Button type="button" size="sm" variant={view === "sources" ? "default" : "outline"} aria-pressed={view === "sources"} onClick={() => setView("sources")}>
          <FileText className="mr-2 size-4" />{t("tabs.sources", "Sources")}
        </Button>
        <Button type="button" size="sm" variant={view === "conversations" ? "default" : "outline"} aria-pressed={view === "conversations"} onClick={() => setView("conversations")}>
          <Sparkles className="mr-2 size-4" />{t("tabs.autoTrain", "Learn from conversations")}
        </Button>
      </div>
      {view === "sources" ? (
        <ContentTrainingSection
          agentId={selectedAgentId}
          agentName={agentName}
          workspaceId={workspaceId}
          scope="workspace"
          onWorkspaceSourcesChange={onSourcesChange}
        />
      ) : selectedAgentId ? (
        <div className="space-y-4">
          <p className="text-xs leading-5 text-muted-foreground">{t("autoTrain.workspaceSourceHint", "Choose one or more connected conversation sources from Agents in this business. Approved knowledge will be shared with every Agent in this workspace.")}</p>
          <AutoTrainSection
            agentId={selectedAgentId}
            agentName={agentName}
            agents={agents}
            scope="workspace"
            workspaceId={workspaceId}
            onWorkspaceKnowledgeChange={onKnowledgeChange}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-foreground">{t("autoTrain.noWorkspaceAgent", "No AI Agent in this business yet.")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("autoTrain.noWorkspaceAgentHint", "Create an Agent in this workspace and connect its Facebook, WhatsApp, or Instagram channel to learn from its conversations.")}</p>
        </div>
      )}
    </section>
  );
}
