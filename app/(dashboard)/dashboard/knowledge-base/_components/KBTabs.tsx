"use client";

import { useTranslation } from "react-i18next";
import { HelpCircle, MessageSquare, FileText, Zap, type LucideIcon } from "lucide-react";

import type { KBTabId } from "./types";

type TabDef = {
    id: KBTabId;
    labelKey: string;
    fallback: string;
    icon: LucideIcon;
};

const TABS: TabDef[] = [
    { id: "faqs", labelKey: "tabs.faqs", fallback: "FAQs", icon: HelpCircle },
    { id: "sample-replies", labelKey: "tabs.sampleReplies", fallback: "Sample Replies", icon: MessageSquare },
    { id: "content-training", labelKey: "tabs.contentTraining", fallback: "Content Training", icon: FileText },
    { id: "auto-train", labelKey: "tabs.autoTrain", fallback: "Auto-Train Engine", icon: Zap },
];

type KBTabsProps = {
    activeTab: KBTabId;
    onChange: (tab: KBTabId) => void;
};

/**
 * Horizontal tab navigation for the four training surfaces.
 * Scrolls horizontally on small screens rather than wrapping.
 */
export function KBTabs({ activeTab, onChange }: KBTabsProps) {
    const { t } = useTranslation("knowledge-base");

    return (
        <nav
            role="tablist"
            aria-label={t("header.title", "AI Training & Knowledge Engine")}
            className="no-scrollbar flex gap-1.5 overflow-x-auto rounded-xl border border-border/60 bg-muted/30 p-1.5"
        >
            {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === activeTab;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(tab.id)}
                        className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-all ${isActive
                                ? "bg-card text-primary shadow-xs ring-1 ring-border/60 dark:bg-card"
                                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                            }`}
                    >
                        <Icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                        {t(tab.labelKey, tab.fallback)}
                    </button>
                );
            })}
        </nav>
    );
}
