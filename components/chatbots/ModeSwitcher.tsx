"use client";

import { motion } from "framer-motion";
import { Sparkles, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type PromptMode = "simple" | "pro";

interface ModeSwitcherProps {
    mode: PromptMode;
    onChange: (mode: PromptMode) => void;
}

/**
 * Simple vs Pro Mode Switcher — segmented control shown at the top of the
 * Bot Configuration section.
 *
 *   [● Simple (Guided)]  [  Pro (Advanced)]
 *
 * Simple mode guides merchants through quality tiers + category templates.
 * Pro mode unlocks the explicit model provider dropdown and full prompt editor.
 */
export function ModeSwitcher({ mode, onChange }: ModeSwitcherProps) {
    const options: Array<{
        key: PromptMode;
        label: string;
        hint: string;
        icon: typeof Sparkles;
    }> = [
            { key: "simple", label: "Simple", hint: "Guided", icon: Sparkles },
            { key: "pro", label: "Pro", hint: "Advanced", icon: SlidersHorizontal },
        ];

    return (
        <div
            role="tablist"
            aria-label="Prompt mode"
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
                        onClick={() => onChange(opt.key)}
                        className={cn(
                            "relative flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200",
                            active
                                ? "text-white"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {active && (
                            <motion.span
                                layoutId="prompt-mode-pill"
                                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                                className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary via-violet-500 to-indigo-500 shadow-lg shadow-primary/25"
                            />
                        )}
                        <Icon className="relative z-10 w-4 h-4" />
                        <span className="relative z-10">{opt.label}</span>
                        <span
                            className={cn(
                                "relative z-10 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                                active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                            )}
                        >
                            {opt.hint}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}