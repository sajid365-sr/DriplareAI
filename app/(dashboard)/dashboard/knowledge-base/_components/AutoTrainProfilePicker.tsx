"use client";

import { useTranslation } from "react-i18next";
import { MessageCircle, Check, Zap, AlertTriangle, Coins } from "lucide-react";
import {
    FacebookIcon,
    InstagramIcon,
    WhatsAppIcon,
} from "@/components/icons/PlatformIcons";

export type ConnectedProfile = {
    platform: string;
    name: string;
    label: string;
};

const CHAT_COUNT_OPTIONS = [10, 25, 50, 100];

/** Platform → icon + accent color. */
function platformVisual(platform: string) {
    switch (platform) {
        case "facebook":
        case "n8n_facebook":
            return { Icon: FacebookIcon, color: "text-[#1877F2]", bg: "bg-[#1877F2]/10" };
        case "instagram":
            return { Icon: InstagramIcon, color: "text-[#E4405F]", bg: "bg-[#E4405F]/10" };
        case "whatsapp":
            return { Icon: WhatsAppIcon, color: "text-[#25D366]", bg: "bg-[#25D366]/10" };
        default:
            return { Icon: MessageCircle, color: "text-primary", bg: "bg-primary/10" };
    }
}

type AutoTrainProfilePickerProps = {
    profiles: ConnectedProfile[];
    selected: Set<string>;
    counts: Record<string, number>;
    fee: number;
    creditsAvailable: number | null;
    busy: boolean;
    onToggle: (platform: string) => void;
    onCountChange: (platform: string, count: number) => void;
    onStart: () => void;
};

/**
 * Auto-Train step 1 — pick connected profiles + how many chats to learn from.
 */
export function AutoTrainProfilePicker({
    profiles,
    selected,
    counts,
    fee,
    creditsAvailable,
    busy,
    onToggle,
    onCountChange,
    onStart,
}: AutoTrainProfilePickerProps) {
    const { t } = useTranslation("knowledge-base");

    const selectedCount = selected.size;
    const hasWhatsApp = Array.from(selected).some((p) => p === "whatsapp");
    const notEnoughCredits = creditsAvailable !== null && creditsAvailable < fee;

    // No connected profiles → friendly empty state
    if (profiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card py-16 text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <Zap className="h-7 w-7" />
                </span>
                <p className="max-w-sm text-sm text-muted-foreground">
                    {t(
                        "autoTrain.noProfiles",
                        "No connected platforms yet. Connect Facebook, WhatsApp or Instagram from Integrations to auto-train your agent."
                    )}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Intro header */}
            <div>
                <h3 className="text-base font-bold text-foreground">
                    {t("autoTrain.selectProfiles", "Select profiles to learn from")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    {t(
                        "autoTrain.description",
                        "Pick the profiles to learn from. We'll read your recent posts, comments and conversations to build your business profile and draft FAQs, sample replies and content training — across all selected platforms, with duplicates removed. You review and pick what to keep; nothing goes live until you approve it."
                    )}
                </p>
            </div>

            {/* Profile cards */}
            <div className="space-y-3">
                {profiles.map((profile) => {
                    const isSelected = selected.has(profile.platform);
                    const { Icon, color, bg } = platformVisual(profile.platform);
                    const count = counts[profile.platform] ?? 25;

                    return (
                        <div
                            key={profile.platform}
                            className={`rounded-xl border transition-colors ${isSelected ? "border-primary/60 bg-primary/5" : "border-border/60 bg-card"
                                }`}
                        >
                            <button
                                type="button"
                                onClick={() => onToggle(profile.platform)}
                                disabled={busy}
                                className="flex w-full items-center gap-3 p-4 text-left"
                            >
                                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}>
                                    <Icon className="h-5 w-5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-semibold text-foreground">{profile.label}</p>
                                    <p className="truncate text-xs text-muted-foreground">{profile.name}</p>
                                </div>
                                <span
                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${isSelected
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border"
                                        }`}
                                >
                                    {isSelected && <Check className="h-3.5 w-3.5" />}
                                </span>
                            </button>

                            {/* Chat-count selector (only when selected) */}
                            {isSelected && (
                                <div className="border-t border-border/50 px-4 py-3">
                                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                                        {t("autoTrain.chatsToTrain", "How many recent chats to train on?")}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {CHAT_COUNT_OPTIONS.map((opt) => (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => onCountChange(profile.platform, opt)}
                                                disabled={busy}
                                                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${count === opt
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                                                    }`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* WhatsApp caveat */}
            {hasWhatsApp && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <p className="text-xs text-muted-foreground">
                        {t(
                            "autoTrain.whatsappCaveat",
                            "WhatsApp & Instagram have no chat-history API — we can only train on messages received since you connected them."
                        )}
                    </p>
                </div>
            )}

            {/* Fee + credits summary */}
            <div className="space-y-2 rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                        <Coins className="h-4 w-4" />
                        {t("autoTrain.feeLabel", "Processing fee")}
                    </span>
                    <span className="font-semibold text-foreground">
                        {fee} {t("autoTrain.credits", "credits")}
                    </span>
                </div>
                {creditsAvailable !== null && (
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                            {t("autoTrain.creditsAvailable", "Credits available")}
                        </span>
                        <span className={notEnoughCredits ? "font-semibold text-destructive" : "text-muted-foreground"}>
                            {creditsAvailable}
                        </span>
                    </div>
                )}
            </div>

            {/* Start button */}
            <button
                type="button"
                onClick={onStart}
                disabled={busy || selectedCount === 0 || notEnoughCredits}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <Zap className="h-4 w-4" />
                {selectedCount === 0
                    ? t("autoTrain.startButton", "Auto-train profiles")
                    : t("autoTrain.startButtonCount", "Auto-train {{count}} profile", { count: selectedCount })}
            </button>
        </div>
    );
}
