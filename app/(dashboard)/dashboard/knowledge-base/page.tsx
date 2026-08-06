"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

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
} from "./_components";

/**
 * AI Training & Knowledge Engine — the main page.
 * A clean, modular, customer-friendly interface for training AI agents across four surfaces:
 *  1. FAQs — direct question → answer pairs
 *  2. Sample Replies — tone & persona examples
 *  3. Content Training — files, text, websites, FB Smart Picker
 *  4. Auto-Train Engine — social auto-training wizard (coming soon)
 */
export default function KnowledgeBasePage() {
  const searchParams = useSearchParams();
  const { t } = useTranslation("knowledge-base");

  // ── State ──────────────────────────────────────────────────────────────────
  const [agents, setAgents] = useState<KBAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<KBTabId>("faqs");
  const [isBotDropdownOpen, setIsBotDropdownOpen] = useState(false);
  // Content-training credits. Defaults to the reference figure until wired to a real endpoint.
  const [credits] = useState(2400);

  // ── Load agents on mount ───────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/chatbots");
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped: KBAgent[] = data.map((bot: { id: string; chatbotId: string; name: string }) => ({
            id: bot.chatbotId,
            name: bot.name,
          }));
          setAgents(mapped);

          // If URL has ?botId=..., use that; otherwise pick the first agent.
          const paramBotId = searchParams?.get("botId");
          const initial =
            paramBotId && mapped.some((a) => a.id === paramBotId)
              ? paramBotId
              : mapped[0].id;
          setSelectedAgentId(initial);
        }
      } catch {
        toast.error("Failed to load AI Agents.");
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync URL when agent changes ────────────────────────────────────────────
  const handleSelectAgent = useCallback(
    (id: string) => {
      setSelectedAgentId(id);
      // Sync URL without hard navigation
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("botId", id);
        window.history.replaceState({}, "", url.toString());
      }
    },
    []
  );

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!selectedAgentId) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <div className="space-y-2 text-center">
          <p className="text-sm">Loading AI Agents…</p>
        </div>
      </div>
    );
  }

  const activeAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      {/* Header: title, subtitle, credits badge */}
      <KBHeader credits={credits} />

      {/* Filter by Bot — matches the Integration page pattern */}
      <AgentDropdown
        agents={agents}
        selectedAgentId={selectedAgentId}
        isBotDropdownOpen={isBotDropdownOpen}
        onToggleDropdown={() => setIsBotDropdownOpen((prev) => !prev)}
        onCloseDropdown={() => setIsBotDropdownOpen(false)}
        onSelectAgent={handleSelectAgent}
      />

      {/* Tab navigation */}
      <KBTabs activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <div className="rounded-2xl border border-border/60 bg-card p-6">
        {activeTab === "faqs" && (
          <FAQSection agentId={selectedAgentId} agentName={activeAgent?.name ?? ""} />
        )}
        {activeTab === "sample-replies" && (
          <SampleRepliesSection agentId={selectedAgentId} agentName={activeAgent?.name ?? ""} />
        )}
        {activeTab === "content-training" && (
          <ContentTrainingSection agentId={selectedAgentId} agentName={activeAgent?.name ?? ""} />
        )}
        {activeTab === "auto-train" && (
          <AutoTrainSection agentId={selectedAgentId} agentName={activeAgent?.name ?? ""} />
        )}
      </div>
    </div>
  );
}
