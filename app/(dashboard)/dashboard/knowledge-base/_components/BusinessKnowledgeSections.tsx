"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpenText, Building2, FileText, MessageSquareText, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Workspace } from "@/lib/core/workspace";
import { AutoTrainSection } from "./AutoTrainSection";
import { BusinessDataSection } from "./BusinessDataSection";
import { CompanyAIRulesSection } from "./CompanyAIRulesSection";
import { ContentTrainingSection } from "./ContentTrainingSection";
import { FAQSection } from "./FAQSection";
import { SampleRepliesSection } from "./SampleRepliesSection";
import { AgentDropdown } from "./AgentDropdown";
import type { KBAgent } from "./types";

type AnswersKind = "faq" | "sample-reply";
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
  agentId,
  agentName,
  workspaceId,
  initialKind,
  onKnowledgeChange,
}: {
  agentId: string;
  agentName: string;
  workspaceId: string;
  initialKind: AnswersKind;
  onKnowledgeChange: () => void;
}) {
  const { t } = useTranslation("knowledge-base");
  const [kind, setKind] = useState<AnswersKind>(initialKind);

  return (
    <section className="space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">{t("businessKnowledge.answersDescription", "Add direct customer questions and ideal responses here. Use Sources for longer documents, websites, and business background so you don't need to repeat the same content.")}</p>
      <div className="inline-flex max-w-full rounded-xl border border-border bg-muted/40 p-1" role="group" aria-label={t("businessKnowledge.answerTypes", "Answer type")}>
        <Button type="button" size="sm" variant={kind === "faq" ? "default" : "ghost"} aria-pressed={kind === "faq"} onClick={() => setKind("faq")}>
          <BookOpenText className="mr-2 size-4" />{t("businessKnowledge.faqType", "Question & answer")}
        </Button>
        <Button type="button" size="sm" variant={kind === "sample-reply" ? "default" : "ghost"} aria-pressed={kind === "sample-reply"} onClick={() => setKind("sample-reply")}>
          <MessageSquareText className="mr-2 size-4" />{t("businessKnowledge.replyType", "Response example")}
        </Button>
      </div>
      {kind === "faq" ? (
        <FAQSection agentId={agentId} agentName={agentName} scope="workspace" workspaceId={workspaceId} onWorkspaceKnowledgeChange={onKnowledgeChange} />
      ) : (
        <SampleRepliesSection agentId={agentId} agentName={agentName} scope="workspace" workspaceId={workspaceId} onWorkspaceKnowledgeChange={onKnowledgeChange} />
      )}
    </section>
  );
}

export function BusinessSourcesSection({
  agents,
  selectedAgentId,
  onSelectAgent,
  agentName,
  workspaceId,
  onSourcesChange,
  onKnowledgeChange,
  initialView,
}: {
  agents: KBAgent[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  agentName: string;
  workspaceId: string;
  onSourcesChange: (count: number) => void;
  onKnowledgeChange: () => void;
  initialView: SourcesView;
}) {
  const { t } = useTranslation("knowledge-base");
  const [view, setView] = useState<SourcesView>(initialView);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);

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
          <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-muted-foreground">{t("autoTrain.sourceAgentHint", "Choose an agent to learn from. Review every suggestion before sharing it with all agents.")}</p>
            <AgentDropdown
              agents={agents}
              selectedAgentId={selectedAgentId}
              isBotDropdownOpen={isAgentDropdownOpen}
              onToggleDropdown={() => setIsAgentDropdownOpen((open) => !open)}
              onCloseDropdown={() => setIsAgentDropdownOpen(false)}
              onSelectAgent={onSelectAgent}
            />
          </div>
          <AutoTrainSection agentId={selectedAgentId} agentName={agentName} scope="workspace" workspaceId={workspaceId} onWorkspaceKnowledgeChange={onKnowledgeChange} />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-foreground">{t("autoTrain.noSourceAgent", "Create an AI Agent before learning from conversations.")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("autoTrain.noSourceAgentHint", "Conversation learning becomes available after an Agent is connected to a channel.")}</p>
        </div>
      )}
    </section>
  );
}
