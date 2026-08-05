"use client";

import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, ChevronDown, Check } from "lucide-react";

import type { KBAgent } from "./types";

type AgentDropdownProps = {
    agents: KBAgent[];
    selectedAgentId: string;
    isBotDropdownOpen: boolean;
    onToggleDropdown: () => void;
    onCloseDropdown: () => void;
    onSelectAgent: (id: string) => void;
};

/**
 * Agent selector dropdown — matches the Integration page's "Filter by Bot" pattern.
 * Shows the active agent name and a dropdown list of all available agents.
 */
export function AgentDropdown({
    agents,
    selectedAgentId,
    isBotDropdownOpen,
    onToggleDropdown,
    onCloseDropdown,
    onSelectAgent,
}: AgentDropdownProps) {
    const { t } = useTranslation("knowledge-base");

    const activeAgent = agents.find((a) => a.id === selectedAgentId);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={onToggleDropdown}
                className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-card px-3.5 py-2.5 shadow-xs transition-all hover:bg-muted/40 cursor-pointer"
            >
                <Bot className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-xs text-muted-foreground font-medium shrink-0">
                    {t("header.activeChannel", "Active Agent")}:
                </span>
                <span className="text-xs font-bold text-foreground max-w-[160px] truncate">
                    {activeAgent?.name ?? t("header.selectAgent", "Select AI Agent")}
                </span>
                <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${isBotDropdownOpen ? "rotate-180 text-primary" : ""
                        }`}
                />
            </button>

            <AnimatePresence>
                {isBotDropdownOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-30"
                            onClick={onCloseDropdown}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 6, scale: 0.98 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-0 top-full z-40 mt-1.5 w-64 space-y-0.5 overflow-hidden rounded-xl border border-border/80 bg-card p-1.5 shadow-xl"
                        >
                            <div className="mb-1 border-b border-border/40 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                                {t("header.activeChannel", "Active Agent")}
                            </div>
                            <div className="no-scrollbar max-h-56 space-y-0.5 overflow-y-auto">
                                {agents.length === 0 ? (
                                    <p className="px-3 py-2 text-xs text-muted-foreground">
                                        {t("header.noAgents", "No AI agents yet")}
                                    </p>
                                ) : (
                                    agents.map((agent) => {
                                        const isSelected = agent.id === selectedAgentId;
                                        return (
                                            <button
                                                key={agent.id}
                                                type="button"
                                                onClick={() => {
                                                    onSelectAgent(agent.id);
                                                    onCloseDropdown();
                                                }}
                                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all ${isSelected
                                                    ? "bg-primary/10 font-bold text-primary"
                                                    : "text-foreground hover:bg-muted/60"
                                                    }`}
                                            >
                                                <span className="flex items-center gap-2 truncate">
                                                    <Bot className={`h-3.5 w-3.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                                                    <span className="truncate">{agent.name}</span>
                                                </span>
                                                {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
