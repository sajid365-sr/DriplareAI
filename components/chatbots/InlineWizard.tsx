"use client";

import { useMemo, useState } from "react";
import {
    ArrowLeft,
    ArrowRight,
    Loader2,
    Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    CATEGORY_ICONS,
    buildInitialData,
    renderFieldControl,
    slideVariants,
} from "@/components/chatbots/wizard-field-control";
import {
    WIZARD_CATEGORY_KEYS,
    getWizardCategory,
    isFieldActive,
    type WizardData,
} from "@/lib/ai/wizard-schema";
import { cn } from "@/lib/core/utils";

interface InlineWizardProps {
    /** Pre-highlighted category (e.g. the chatbot's current mode). */
    initialCategory?: string;
    /**
     * Called after a successful compile with the generated raw prompt, the
     * compiled production prompt, the structured answers, and the category.
     */
    onGenerated: (
        rawPrompt: string,
        compiledPrompt: string,
        wizardData: WizardData,
        category: string
    ) => void;
    className?: string;
}

/**
 * InlineWizard — the embedded, non-modal Quick Setup wizard for Tab 1 of the
 * playground. It mirrors `WizardModal`'s multi-step horizontal-slider UX but
 * renders inline: first a category-picker grid, then the selected category's
 * steps, ending with a "Generate Prompt" call to `/api/chatbots/wizard-compile`.
 */
export function InlineWizard({
    initialCategory,
    onGenerated,
    className,
}: InlineWizardProps) {
    // `null` category → the picker grid is shown; a value → we're in the steps.
    const [category, setCategory] = useState<string | null>(null);
    const [formData, setFormData] = useState<WizardData>({});
    const [stepIndex, setStepIndex] = useState(0);
    // 1 → moving forward (next), -1 → moving backward (prev).
    const [direction, setDirection] = useState(1);
    const [generating, setGenerating] = useState(false);

    const config = category ? getWizardCategory(category) : null;

    const setValue = (key: string, value: string | number | boolean) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const totalSteps = config?.steps.length ?? 0;
    const currentStep = config?.steps[stepIndex];
    const isFirstStep = stepIndex === 0;
    const isLastStep = stepIndex === totalSteps - 1;

    // Only the fields whose `dependsOn` condition is currently satisfied.
    const visibleFields = useMemo(
        () =>
            currentStep
                ? currentStep.fields.filter((f) => isFieldActive(f, formData))
                : [],
        [currentStep, formData]
    );

    const selectCategory = (cat: string) => {
        const cfg = getWizardCategory(cat);
        if (!cfg) return;
        setCategory(cat);
        setFormData(buildInitialData(cfg.fields));
        setStepIndex(0);
        setDirection(1);
    };

    const changeCategory = () => {
        setDirection(-1);
        setCategory(null);
    };

    /** Validates the visible required fields on the current step. */
    const validateStep = (): boolean => {
        for (const field of visibleFields) {
            if (!field.required) continue;
            const value = formData[field.key];
            const empty =
                value === undefined ||
                value === null ||
                (typeof value === "string" && value.trim() === "");
            if (empty) {
                toast.error(`${field.labelBn} প্রয়োজন`);
                return false;
            }
        }
        return true;
    };

    const goBack = () => {
        if (isFirstStep) {
            changeCategory();
            return;
        }
        setDirection(-1);
        setStepIndex((i) => i - 1);
    };

    const goNext = () => {
        if (!validateStep()) return;
        if (isLastStep) {
            handleGenerate();
            return;
        }
        setDirection(1);
        setStepIndex((i) => i + 1);
    };

    const handleGenerate = async () => {
        if (!category) return;
        setGenerating(true);
        try {
            const res = await fetch("/api/chatbots/wizard-compile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category, wizardData: formData }),
            });

            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Failed to generate prompt");
                return;
            }

            onGenerated(data.rawPrompt, data.compiledPrompt, formData, category);
            toast.success("AI System Prompt generated successfully!");
        } catch (error) {
            console.error("[INLINE_WIZARD_ERROR]", error);
            toast.error("An error occurred while generating the prompt.");
        } finally {
            setGenerating(false);
        }
    };

    // ─── Category picker grid ──────────────────────────────────────────────
    if (!config || !currentStep) {
        return (
            <div className={cn("space-y-4", className)}>
                <div className="space-y-1">
                    <h3 className="text-sm font-bold text-foreground">
                        🪄 আপনার ব্যবসার ধরন বেছে নিন
                    </h3>
                    <p className="text-[12px] text-muted-foreground">
                        একটি ক্যাটাগরি সিলেক্ট করুন — মাত্র কয়েকটি প্রশ্নের উত্তর দিলেই AI
                        আপনার জন্য স্মার্ট সিস্টেম প্রম্পট তৈরি করে দেবে।
                    </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {WIZARD_CATEGORY_KEYS.map((key) => {
                        const cfg = getWizardCategory(key);
                        if (!cfg) return null;
                        const isHighlighted = key === initialCategory;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => selectCategory(key)}
                                className={cn(
                                    "flex flex-col items-start gap-1.5 p-4 text-left rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98] group",
                                    isHighlighted
                                        ? "border-violet-500 bg-purple-50/70 dark:bg-violet-950/30 shadow-md shadow-violet-500/10"
                                        : "border-border bg-card hover:border-violet-500/40 hover:bg-purple-50/40 dark:hover:bg-violet-950/20"
                                )}
                            >
                                <span className="text-2xl leading-none">
                                    {CATEGORY_ICONS[key] ?? "✨"}
                                </span>
                                <span className="font-bold text-[13px] text-foreground leading-tight group-hover:text-violet-600 transition-colors">
                                    {cfg.titleBn}
                                </span>
                                <span className="text-[10px] text-muted-foreground line-clamp-1">
                                    {cfg.title}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    const progress = ((stepIndex + 1) / totalSteps) * 100;

    // ─── Step phase ────────────────────────────────────────────────────────
    return (
        <div className={cn("flex flex-col", className)}>
            {/* Header — category + step indicator */}
            <div className="space-y-3 pb-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg leading-none shrink-0">
                            {CATEGORY_ICONS[category!] ?? "✨"}
                        </span>
                        <span className="font-bold text-sm truncate">
                            {config.titleBn}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={changeCategory}
                        disabled={generating}
                        className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-violet-600 transition-colors disabled:opacity-50"
                    >
                        <ArrowLeft className="w-3 h-3" /> ক্যাটাগরি পরিবর্তন
                    </button>
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-violet-600">
                            Step {stepIndex + 1} of {totalSteps}: {currentStep.titleBn}
                        </span>
                        <span className="text-muted-foreground">{currentStep.title}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-secondary/40 overflow-hidden">
                        <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 via-primary to-indigo-500"
                            initial={false}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.35, ease: "easeInOut" }}
                        />
                    </div>
                </div>
            </div>

            {/* Sliding step content */}
            <div className="relative flex-1 overflow-x-hidden">
                <AnimatePresence mode="wait" custom={direction} initial={false}>
                    <motion.div
                        key={stepIndex}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="space-y-5"
                    >
                        {visibleFields.map((field) => (
                            <div key={field.key} className="space-y-2">
                                <Label className="text-sm font-semibold flex items-center gap-2">
                                    {field.labelBn}
                                    <span className="text-[10px] font-normal text-muted-foreground">
                                        {field.label}
                                    </span>
                                    {field.required && (
                                        <span className="text-[10px] font-semibold text-destructive">
                                            *
                                        </span>
                                    )}
                                </Label>

                                {renderFieldControl(field, formData, setValue)}

                                {field.hint && field.type !== "boolean" && (
                                    <p className="text-[11px] text-muted-foreground">
                                        {field.hint}
                                    </p>
                                )}
                            </div>
                        ))}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Footer navigation */}
            <div className="flex items-center justify-between gap-3 pt-5 mt-1 border-t border-border/60">
                <Button
                    type="button"
                    variant="outline"
                    onClick={goBack}
                    disabled={generating}
                    className="gap-1.5 rounded-full"
                >
                    <ArrowLeft className="w-4 h-4" /> {isFirstStep ? "Categories" : "Previous"}
                </Button>

                <Button
                    type="button"
                    onClick={goNext}
                    disabled={generating}
                    className="gap-2 rounded-full bg-gradient-to-r from-primary via-violet-500 to-indigo-500 text-white font-bold shadow-lg shadow-primary/25 hover:opacity-90 transition-all active:scale-[0.98]"
                >
                    {generating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Building…
                        </>
                    ) : isLastStep ? (
                        <>
                            <Sparkles className="w-4 h-4" /> Generate Prompt
                        </>
                    ) : (
                        <>
                            Next <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
