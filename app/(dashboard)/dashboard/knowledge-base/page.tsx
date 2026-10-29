"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowRight, Bot, Building2, FileStack, Plus } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";

import {
  KBHeader,
  KBTabs,
  AgentDropdown,
  FAQSection,
  SampleRepliesSection,
  ContentTrainingSection,
  AutoTrainSection,
  type KBAgent,
  type KBTabId,
  type KnowledgeScope,
} from "./_components";

export default function KnowledgeBasePage() {
  const searchParams = useSearchParams();
  const { t } = useTranslation("knowledge-base");
  const { activeWorkspace } = useWorkspace();
  const requestedBotId = searchParams?.get("botId") ?? "";

  const [agents, setAgents] = useState<KBAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [activeTab, setActiveTab] = useState<KBTabId>("faqs");
  const [knowledgeScope, setKnowledgeScope] = useState<KnowledgeScope>(requestedBotId ? "agent" : "workspace");
  const [isBotDropdownOpen, setIsBotDropdownOpen] = useState(false);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [workspaceSourceCount, setWorkspaceSourceCount] = useState(0);
  const [credits] = useState(2400);

  useEffect(() => {
    let cancelled = false;
    async function loadAgents() {
      try {
        const response = await fetch("/api/chatbots");
        const data: unknown = await response.json();
        if (!Array.isArray(data)) return;
        const mapped: KBAgent[] = data.map((bot: { chatbotId: string; name: string }) => ({
          id: bot.chatbotId,
          name: bot.name,
        }));
        if (cancelled) return;
        setAgents(mapped);
        const initialAgent = mapped.find((agent) => agent.id === requestedBotId) ?? mapped[0];
        setSelectedAgentId(initialAgent?.id ?? "");
      } catch {
        toast.error(t("messages.agentLoadError", "Failed to load AI agents."));
      } finally {
        if (!cancelled) setAgentsLoading(false);
      }
    }
    void loadAgents();
    return () => { cancelled = true; };
  }, [requestedBotId, t]);

  const refreshWorkspaceSourceCount = useCallback(async () => {
    const workspaceId = activeWorkspace?.workspaceId;
    if (!workspaceId) {
      setWorkspaceSourceCount(0);
      return;
    }
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/sources`);
      const sources: unknown = response.ok ? await response.json() : [];
      setWorkspaceSourceCount(Array.isArray(sources) ? sources.length : 0);
    } catch {
      setWorkspaceSourceCount(0);
    }
  }, [activeWorkspace?.workspaceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch the active workspace's source count for the shared/private summary.
    void refreshWorkspaceSourceCount();
  }, [refreshWorkspaceSourceCount]);

  const handleSelectAgent = useCallback((id: string) => {
    setKnowledgeScope("agent");
    setSelectedAgentId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("botId", id);
    window.history.replaceState({}, "", url.toString());
  }, []);

  const activeAgent = agents.find((agent) => agent.id === selectedAgentId);
  const workspaceId = activeWorkspace?.workspaceId ?? "";

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <KBHeader credits={credits} />

      <section className="grid gap-3 md:grid-cols-2" aria-label={t("scope.title", "Choose knowledge scope")}>
        <button
          type="button"
          onClick={() => setKnowledgeScope("workspace")}
          aria-pressed={knowledgeScope === "workspace"}
          className={`group rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${knowledgeScope === "workspace" ? "border-primary/40 bg-primary/5 shadow-xs" : "border-border/70 bg-card hover:border-primary/30 hover:bg-muted/30"}`}
        >
          <span className="flex items-start gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${knowledgeScope === "workspace" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}><Building2 className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                {t("scope.workspaceTitle", "Workspace Knowledge Base")}
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{t("scope.sharedBadge", "Shared with all agents")}</span>
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{t("scope.workspaceDescription", "Company policies, delivery rules, and information every agent can use.")}</span>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"><FileStack className="h-3.5 w-3.5" />{t("scope.sourceCount", { count: workspaceSourceCount, defaultValue: "{{count}} shared sources" })}</span>
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setKnowledgeScope("agent")}
          disabled={agentsLoading || agents.length === 0}
          aria-pressed={knowledgeScope === "agent"}
          className={`group rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55 ${knowledgeScope === "agent" ? "border-primary/40 bg-primary/5 shadow-xs" : "border-border/70 bg-card hover:border-primary/30 hover:bg-muted/30"}`}
        >
          <span className="flex items-start gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${knowledgeScope === "agent" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}><Bot className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">{t("scope.agentTitle", "Agent-Specific Knowledge")}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{t("scope.agentDescription", "Private instructions and content for one selected agent only.")}</span>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">{agentsLoading ? t("scope.loadingAgents", "Loading agents…") : t("scope.agentCount", { count: agents.length, defaultValue: "{{count}} agents available" })}<ArrowRight className="h-3.5 w-3.5" /></span>
            </span>
          </span>
        </button>
      </section>

      {knowledgeScope === "workspace" ? (
        <>
          <KBTabs activeTab={activeTab} onChange={setActiveTab} />
          {activeTab === "auto-train" && agents.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <p className="text-xs text-muted-foreground">{t("autoTrain.sourceAgentHint", "Choose an agent to read conversations from. Approved knowledge will be shared across the workspace.")}</p>
              <AgentDropdown agents={agents} selectedAgentId={selectedAgentId} isBotDropdownOpen={isBotDropdownOpen} onToggleDropdown={() => setIsBotDropdownOpen((open) => !open)} onCloseDropdown={() => setIsBotDropdownOpen(false)} onSelectAgent={(id) => { setSelectedAgentId(id); setIsBotDropdownOpen(false); }} />
            </div>
          )}
          <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-6">
            {activeTab === "faqs" && <FAQSection agentId={selectedAgentId} agentName={activeAgent?.name ?? ""} scope="workspace" workspaceId={workspaceId} onWorkspaceKnowledgeChange={refreshWorkspaceSourceCount} />}
            {activeTab === "sample-replies" && <SampleRepliesSection agentId={selectedAgentId} agentName={activeAgent?.name ?? ""} scope="workspace" workspaceId={workspaceId} onWorkspaceKnowledgeChange={refreshWorkspaceSourceCount} />}
            {activeTab === "content-training" && <ContentTrainingSection agentId={selectedAgentId} agentName={activeAgent?.name ?? ""} workspaceId={workspaceId} scope="workspace" onWorkspaceSourcesChange={setWorkspaceSourceCount} />}
            {activeTab === "auto-train" && (selectedAgentId ? <AutoTrainSection agentId={selectedAgentId} agentName={activeAgent?.name ?? ""} scope="workspace" workspaceId={workspaceId} onWorkspaceKnowledgeChange={refreshWorkspaceSourceCount} /> : <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{t("autoTrain.noSourceAgent", "Create an AI agent before auto-training workspace knowledge.")}</p>)}
          </div>
        </>
      ) : !selectedAgentId ? (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <Bot className="mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-semibold text-foreground">{agentsLoading ? t("header.loadingAgents", "Loading AI agents…") : t("header.noAgents", "No AI agents yet")}</p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">{t("companyKnowledge.noAgentsHint", "Create an agent to add knowledge that is private to it. Shared workspace knowledge remains available above.")}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("scope.agentTitle", "Agent-Specific Knowledge")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("scope.privateToSelected", "Only the selected agent can access its private knowledge.")}</p>
            </div>
            <AgentDropdown
              agents={agents}
              selectedAgentId={selectedAgentId}
              isBotDropdownOpen={isBotDropdownOpen}
              onToggleDropdown={() => setIsBotDropdownOpen((open) => !open)}
              onCloseDropdown={() => setIsBotDropdownOpen(false)}
              onSelectAgent={handleSelectAgent}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="flex min-w-0 items-start gap-2.5">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">{t("scope.sharedFrom", { name: activeWorkspace?.name ?? "workspace", defaultValue: "Shared from {{name}} workspace" })}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{workspaceSourceCount > 0 ? t("scope.sharedCount", { count: workspaceSourceCount, defaultValue: "{{count}} sources available to this agent and every other agent." }) : t("scope.noSharedSources", "No workspace sources yet. Add company policies once to share them with all agents.")}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" onClick={() => setKnowledgeScope("workspace")} className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted">{t("scope.manageShared", "Manage shared knowledge")}</button>
              <button type="button" onClick={() => setActiveTab("content-training")} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="h-3.5 w-3.5" />{t("scope.addPrivate", "Add specific knowledge")}</button>
            </div>
          </div>

          <KBTabs activeTab={activeTab} onChange={setActiveTab} />
          <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-6">
            {activeTab === "faqs" && <FAQSection agentId={selectedAgentId} agentName={activeAgent?.name ?? ""} />}
            {activeTab === "sample-replies" && <SampleRepliesSection agentId={selectedAgentId} agentName={activeAgent?.name ?? ""} />}
            {activeTab === "content-training" && (
              <ContentTrainingSection agentId={selectedAgentId} agentName={activeAgent?.name ?? ""} workspaceId={workspaceId} scope="agent" />
            )}
            {activeTab === "auto-train" && <AutoTrainSection agentId={selectedAgentId} agentName={activeAgent?.name ?? ""} />}
          </div>
        </>
      )}
    </div>
  );
}
