"use client";

import { useTranslation } from "react-i18next";
import { GraduationCap, Coins } from "lucide-react";

type KBHeaderProps = {
    /** Content-training credits remaining for the active workspace. */
    credits: number;
};

/**
 * Page header for the AI Training & Knowledge Engine.
 * Shows the title/subtitle and the training-credits badge.
 * The agent selector dropdown is now rendered separately below the header
 * (matching the Integration page's "Filter by Bot" pattern).
 */
export function KBHeader({ credits }: KBHeaderProps) {
    const { t } = useTranslation("knowledge-base");

    return (
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            {/* Title block */}
            <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <GraduationCap className="h-5 w-5" />
                </span>
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                        {t("header.title", "AI Training & Knowledge Engine")}
                    </h1>
                    <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                        {t("header.subtitle", "Teach your AI what to say and how to say it — so it answers customers accurately, in your voice.")}
                    </p>
                </div>
            </div>

            {/* Right-side: credits badge */}
            <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2 dark:border-primary/30 dark:bg-primary/10">
                    <Coins className="h-4 w-4 shrink-0 text-primary" />
                    <span className="hidden text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:inline">
                        {t("header.creditsLabel", "Content Training Credits")}
                    </span>
                    <span className="text-sm font-bold text-primary">{credits.toLocaleString()}</span>
                </div>
            </div>
        </header>
    );
}
