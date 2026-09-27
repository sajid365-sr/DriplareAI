"use client";

import { useTranslation } from "react-i18next";
import { Bot, ChevronDown } from "lucide-react";

export type ProductAgent = {
  id: string; // chatbotId
  name: string;
};

type ProductsAgentDropdownProps = {
  agents: ProductAgent[];
  selectedAgentId: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (id: string) => void;
};

/**
 * Agent selector dropdown matching the Knowledge Base / Platforms pattern.
 */
export function ProductsAgentDropdown({
  agents,
  selectedAgentId,
  isOpen,
  onToggle,
  onClose,
  onSelect,
}: ProductsAgentDropdownProps) {
  const { t } = useTranslation("products");

  if (agents.length <= 1) return null;

  const current = agents.find((a) => a.id === selectedAgentId);

  return (
    <div className="relative inline-block text-left">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("agentDropdown.label")}
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-xs transition-colors hover:border-primary/50 hover:bg-accent/40"
        >
          <Bot className="h-4 w-4 text-primary" />
          <span>{current?.name || t("agentDropdown.placeholder")}</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={onClose} />
          <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-border/80 bg-card p-1.5 shadow-lg backdrop-blur-md">
            {agents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  onSelect(agent.id);
                  onClose();
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  agent.id === selectedAgentId
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Bot className="h-4 w-4" />
                <span className="truncate">{agent.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
