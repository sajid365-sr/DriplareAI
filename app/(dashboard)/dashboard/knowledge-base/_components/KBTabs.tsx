"use client";

import { useTranslation } from "react-i18next";
import { BookOpenText, FileText, ShieldCheck, Sparkles, UserRoundCog, type LucideIcon } from "lucide-react";

import type { KBTabId } from "./types";

type TabDef = {
    id: KBTabId;
    labelKey: string;
    fallback: string;
    icon: LucideIcon;
};

const TABS: TabDef[] = [
    { id: "business-profile", labelKey: "tabs.businessProfile", fallback: "Business Profile & Policies", icon: ShieldCheck },
    { id: "answers", labelKey: "tabs.answers", fallback: "Answers", icon: BookOpenText },
    { id: "sources", labelKey: "tabs.sources", fallback: "Sources", icon: FileText },
    { id: "auto-train", labelKey: "tabs.autoTrain", fallback: "Learn from conversations", icon: Sparkles },
    { id: "agent-instructions", labelKey: "tabs.agentInstructions", fallback: "Agent Instructions", icon: UserRoundCog },
    { id: "content-training", labelKey: "tabs.privateReferences", fallback: "Private References", icon: FileText },
];

type KBTabsProps = {
    activeTab: KBTabId;
    onChange: (tab: KBTabId) => void;
    scope?: "workspace" | "agent";
};

/**
 * Horizontal tab navigation for shared Business Knowledge and private Agent references.
 * Scrolls horizontally on small screens rather than wrapping.
 */
export function KBTabs({ activeTab, onChange, scope = "workspace" }: KBTabsProps) {
    const { t } = useTranslation("knowledge-base");

    return (
        <nav
            role="tablist"
            aria-label={t("header.title", "AI Training & Knowledge Engine")}
            onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='tab']"));
                const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[role='tab']") : null;
                const currentIndex = target ? buttons.indexOf(target) : -1;
                if (currentIndex < 0 || buttons.length === 0) return;
                event.preventDefault();
                const nextIndex = event.key === "Home" ? 0
                    : event.key === "End" ? buttons.length - 1
                        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
                buttons[nextIndex]?.focus();
                buttons[nextIndex]?.click();
            }}
            className="no-scrollbar flex gap-1.5 overflow-x-auto rounded-xl border border-border/60 bg-muted/30 p-1.5"
        >
            {TABS.filter((tab) => {
                if (scope === "workspace") return tab.id === "business-profile" || tab.id === "answers" || tab.id === "sources" || tab.id === "auto-train";
                return tab.id === "agent-instructions" || tab.id === "content-training";
            }).map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === activeTab;
                const labelKey = tab.labelKey;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                            id={`kb-tab-${tab.id}`}
                        aria-selected={isActive}
                            aria-controls="knowledge-base-tabpanel"
                            tabIndex={isActive ? 0 : -1}
                        onClick={() => onChange(tab.id)}
                        className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-all ${isActive
                                ? "bg-card text-primary shadow-xs ring-1 ring-border/60 dark:bg-card"
                                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                            }`}
                    >
                        <Icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                        {t(labelKey, tab.fallback)}
                    </button>
                );
            })}
        </nav>
    );
}
