"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Bot, ChevronDown, Search, SlidersHorizontal, Zap } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { AutomationCard } from "./automation-card";
import type { Automation, AutomationAgent } from "./types";

interface AutomationListProps {
  automations: Automation[];
  agents: AutomationAgent[];
  loading: boolean;
  busyId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  /** `null` = every agent. */
  chatbotId: string | null;
  onChatbotChange: (chatbotId: string | null) => void;
  onEdit: (automation: Automation) => void;
  onTest: (automation: Automation) => void;
  onDuplicate: (automation: Automation) => void;
  onToggle: (automation: Automation) => void;
  onDelete: (automation: Automation) => void;
}

/**
 * The rules grid with its filter bar.
 *
 * Search and the agent filter are applied on the server (`/api/automations`
 * takes `q` and `chatbotId`), so this component only renders the state it is
 * given — it holds no filtering logic of its own that could disagree with what
 * the API returned.
 */
export function AutomationList({
  automations,
  agents,
  loading,
  busyId,
  search,
  onSearchChange,
  chatbotId,
  onChatbotChange,
  onEdit,
  onTest,
  onDuplicate,
  onToggle,
  onDelete,
}: AutomationListProps) {
  const { t } = useTranslation("automations");
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);

  const selectedAgent = agents.find((agent) => agent.id === chatbotId);
  const agentNameById = new Map(agents.map((agent) => [agent.id, agent.name]));

  return (
    <section className="space-y-3">
      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("filters.search", "Search rules…")}
            className="h-9 pl-8 text-sm"
            data-testid="automation-search"
          />
        </div>

        {/* Agent filter — only worth showing once there is a choice to make. */}
        {agents.length > 1 && (
          <DropdownMenu open={agentMenuOpen} onOpenChange={setAgentMenuOpen}>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  className="h-9 justify-between gap-2 sm:w-56"
                  data-testid="automation-agent-filter"
                />
              }
            >
              <Bot className="text-primary" />
              <span className="truncate">
                {selectedAgent?.name ?? t("filters.allAgents", "All AI Agents")}
              </span>
              <ChevronDown className="ml-auto opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => onChatbotChange(null)}>
                <SlidersHorizontal />
                {t("filters.allAgents", "All AI Agents")}
              </DropdownMenuItem>
              {agents.map((agent) => (
                <DropdownMenuItem key={agent.id} onClick={() => onChatbotChange(agent.id)}>
                  <Bot />
                  <span className="truncate">{agent.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : automations.length === 0 ? (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 p-10 text-center"
          )}
          data-testid="automation-empty"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Zap className="h-5 w-5" />
          </span>
          <h3 className="text-sm font-bold text-foreground">
            {t("empty.noMatch", "No rules match these filters")}
          </h3>
          <p className="max-w-sm text-xs text-muted-foreground">
            {t("empty.noMatchHint", "Try clearing the search or choosing another agent.")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {automations.map((automation) => (
              <AutomationCard
                key={automation.automationId}
                automation={automation}
                agentName={
                  automation.chatbotId ? agentNameById.get(automation.chatbotId) ?? null : null
                }
                busy={busyId === automation.automationId}
                onEdit={onEdit}
                onTest={onTest}
                onDuplicate={onDuplicate}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
