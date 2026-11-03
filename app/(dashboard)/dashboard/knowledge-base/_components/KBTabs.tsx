"use client";

import { useTranslation } from "react-i18next";
import { HelpCircle, MessageSquare, FileText, Zap, ShieldCheck, Database, UserRoundCog, LayoutDashboard, type LucideIcon } from "lucide-react";

import type { KBTabId } from "./types";

type TabDef = {
    id: KBTabId;
    labelKey: string;
    fallback: string;
    icon: LucideIcon;
};

const TABS: TabDef[] = [
    { id: "overview", labelKey: "tabs.overview", fallback: "Overview", icon: LayoutDashboard },
    { id: "agent-instructions", labelKey: "tabs.agentInstructions", fallback: "Agent Instructions", icon: UserRoundCog },
    { id: "faqs", labelKey: "tabs.faqs", fallback: "FAQs", icon: HelpCircle },
    { id: "sample-replies", labelKey: "tabs.sampleReplies", fallback: "Sample Replies", icon: MessageSquare },
    { id: "business-data", labelKey: "tabs.businessData", fallback: "Business Data", icon: Database },
    { id: "content-training", labelKey: "tabs.contentTraining", fallback: "Content Training", icon: FileText },
    { id: "auto-train", labelKey: "tabs.autoTrain", fallback: "Auto-Train Engine", icon: Zap },
    { id: "company-ai-rules", labelKey: "tabs.companyAiRules", fallback: "Company AI Rules", icon: ShieldCheck },
];

type KBTabsProps = {
    activeTab: KBTabId;
    onChange: (tab: KBTabId) => void;
    includeCompanyRules?: boolean;
    includeBusinessData?: boolean;
    scope?: "workspace" | "agent";
};

/**
 * Horizontal tab navigation for shared Business Knowledge and private Agent references.
 * Scrolls horizontally on small screens rather than wrapping.
 */
export function KBTabs({ activeTab, onChange, includeCompanyRules = false, includeBusinessData = false, scope = "workspace" }: KBTabsProps) {
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
                if (tab.id === "overview") return scope === "workspace";
                if (tab.id === "agent-instructions") return scope === "agent";
                if (tab.id === "company-ai-rules") return includeCompanyRules;
                if (tab.id === "business-data") return includeBusinessData;
                if (scope === "agent" && tab.id !== "content-training") return false;
                return true;
            }).map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === activeTab;
                const labelKey = scope === "agent" && tab.id === "faqs" ? "tabs.agentFaqs"
                    : scope === "agent" && tab.id === "sample-replies" ? "tabs.agentReplies"
                        : scope === "agent" && tab.id === "content-training" ? "tabs.privateReferences"
                            : tab.labelKey;
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
