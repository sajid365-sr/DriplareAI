"use client";

import { motion } from "framer-motion";
import { Lock, Sparkles, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { getPlan, resolveLocalStr, type PlanKey } from "@/lib/domain/plan-config";
import { useRegion } from "@/components/region-provider";

export type PromptMode = "simple" | "pro";

interface ModeSwitcherProps {
    mode: PromptMode;
    onChange: (mode: PromptMode) => void;
    /**
     * Pro মোডটা এই plan-এ নেই — Starter শুধু Simple (Guided) পায়।
     *
     * ⚠️ এটা কেবল সাজসজ্জা নয়, নিজেই একটা **সিদ্ধান্ত**: `onChange("pro")`
     *    ডাকা হয় না, আর সেগমেন্টটা `aria-disabled` হয়ে যায়। তবু আসল বেড়া
     *    সার্ভারে (`lib/ai/plan-model-access.ts`) — কেউ ক্লায়েন্ট বাইপাস করলে
     *    সেভ/চ্যাট রুটেই ৪০৩ আসে।
     */
    proLocked?: boolean;
    /** `proLocked` হলে — যে plan-টা কিনলেই Pro খোলে। */
    requiredPlan?: PlanKey;
}

/**
 * Simple vs Pro Mode Switcher — segmented control shown at the top of the
 * Bot Configuration section.
 *
 *   [● Simple (Guided)]  [  Pro (Advanced) 🔒 ]
 *
 * Simple mode guides merchants through quality tiers + category templates.
 * Pro mode unlocks the explicit model provider dropdown and full prompt editor.
 *
 * ⚠️ Starter plan-এ Pro সেগমেন্টটা **কখনো** সক্রিয় হয় না — এটাই সেই একমাত্র
 *    জায়গা যেখানে plan-এর সীমানা চোখে পড়ে, কারণ মডেল-প্রতি আর কোনো তালা নেই।
 *    দেখানোটাই ইচ্ছাকৃত (লুকিয়ে ফেলা নয়): merchant তখন জানেন কী নেই এবং কী
 *    কিনলে পাবেন, আর upgrade-এর রাস্তাটাও পাশেই থাকে।
 */
export function ModeSwitcher({ mode, onChange, proLocked = false, requiredPlan }: ModeSwitcherProps) {
    const { t, i18n } = useTranslation("chatbots");
    const { region } = useRegion();

    // plan-এর নাম admin-এর দেওয়া নামই — ভাষা অনুযায়ী (`resolveLocalStr`)।
    // তাই "Business" বাংলায় "বিজনেস" দেখায়, ঠিক pricing page-এ যেমন।
    const planName = requiredPlan
        ? resolveLocalStr(getPlan(region, requiredPlan).name, i18n.language)
        : "";

    const options: Array<{
        key: PromptMode;
        label: string;
        hint: string;
        icon: typeof Sparkles;
        /** এই অপশনটা কি এই plan-এ বন্ধ? (কেবল Pro-তে সম্ভব) */
        locked: boolean;
    }> = [
            { key: "simple", label: "Simple", hint: "Guided", icon: Sparkles, locked: false },
            { key: "pro", label: "Pro", hint: "Advanced", icon: SlidersHorizontal, locked: proLocked },
        ];

    return (
        <div
            role="tablist"
            aria-label={t("mode.title", "Prompt mode")}
            className="relative grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-secondary/40 border border-border/60"
        >
            {options.map((opt) => {
                const active = mode === opt.key;
                const Icon = opt.icon;
                return (
                    <button
                        key={opt.key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        aria-disabled={opt.locked || undefined}
                        // আটকানো সেগমেন্টে ক্লিক অর্থহীন, কিন্তু `disabled`
                        // দিলে ব্রাউজার `title`-এর কারণটাও দেখাত না — তাই
                        // ক্লিকটা শুধু কিছুই করে না।
                        onClick={() => {
                            if (opt.locked) return;
                            onChange(opt.key);
                        }}
                        title={opt.locked ? t("mode.proLockedHint", { plan: planName, defaultValue: "Available on the {{plan}} plan" }) : undefined}
                        className={cn(
                            "relative flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200",
                            opt.locked
                                ? "text-muted-foreground cursor-not-allowed"
                                : active
                                    ? "text-white cursor-pointer"
                                    : "text-muted-foreground hover:text-foreground cursor-pointer"
                        )}
                    >
                        {active && !opt.locked && (
                            <motion.span
                                layoutId="prompt-mode-pill"
                                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                                className="absolute inset-0 rounded-xl bg-brand-gradient shadow-lg shadow-primary/25"
                            />
                        )}
                        <Icon className={cn("relative z-10 w-4 h-4", opt.locked && "opacity-60")} />
                        <span className={cn("relative z-10", opt.locked && "opacity-60")}>{opt.label}</span>
                        {/* আটকানো অবস্থায় "Advanced" চিপটার জায়গায় তালা +
                            plan-এর নাম — অর্থাৎ কারণটাই সেখানে লেখা থাকে,
                            আলাদা করে নিচে ব্যাখ্যা পড়তে হয় না। */}
                        <span
                            className={cn(
                                "relative z-10 flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                                opt.locked
                                    ? "bg-warning/10 text-warning border border-warning/30"
                                    : active
                                        ? "bg-white/20 text-white"
                                        : "bg-muted text-muted-foreground"
                            )}
                        >
                            {opt.locked ? (
                                <>
                                    <Lock className="h-2.5 w-2.5" />
                                    {planName || t("model_lock.badge", "Locked")}
                                </>
                            ) : (
                                opt.hint
                            )}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
