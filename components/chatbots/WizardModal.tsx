"use client";

import { useEffect, useMemo, useState } from "react";
import {
    ArrowLeft,
    ArrowRight,
    Loader2,
    Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    CATEGORY_ICONS,
    buildInitialData,
    renderFieldControl,
    slideVariants,
} from "@/components/chatbots/wizard-field-control";
import {
    getWizardCategory,
    isFieldActive,
    type WizardData,
} from "@/lib/ai/wizard-schema";

interface WizardModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    category: string;
    /**
     * Called after a successful wizard compile with the generated raw prompt,
     * the compiled production prompt, and the structured wizard answers.
     */
    onGenerated: (
        rawPrompt: string,
        compiledPrompt: string,
        wizardData: WizardData
    ) => void;
}

/**
 * Guided Setup Wizard Modal — an interactive multi-step horizontal slider that
 * walks the merchant through the category's steps from `@lib/ai/wizard-schema`.
 * Each step animates in/out with Framer Motion, fields render by type (including
 * the HybridSelect dropdown + custom input and conditional `dependsOn` fields),
 * and the final step posts to `/api/chatbots/wizard-compile` to build the prompt.
 */
export function WizardModal({
    open,
    onOpenChange,
    category,
    onGenerated,
}: WizardModalProps) {
    const config = getWizardCategory(category);
    const [formData, setFormData] = useState<WizardData>({});
    const [stepIndex, setStepIndex] = useState(0);
    // 1 → moving forward (next), -1 → moving backward (prev).
    const [direction, setDirection] = useState(1);
    const [generating, setGenerating] = useState(false);

    // Reset the wizard whenever it opens or the category changes.
    useEffect(() => {
        if (open && config) {
            setFormData(buildInitialData(config.fields));
            setStepIndex(0);
            setDirection(1);
        }
    }, [open, category, config]);

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
        if (isFirstStep) return;
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
        if (!config) return;
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

            onGenerated(data.rawPrompt, data.compiledPrompt, formData);
            onOpenChange(false);
            toast.success("AI System Prompt generated successfully!");
        } catch (error) {
            console.error("[WIZARD_MODAL_ERROR]", error);
            toast.error("An error occurred while generating the prompt.");
        } finally {
            setGenerating(false);
        }
    };

    if (!config || !currentStep) return null;

    const progress = ((stepIndex + 1) / totalSteps) * 100;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-hidden flex flex-col p-0 gap-0">
                {/* ─── Header ─────────────────────────────────────────── */}
                <DialogHeader className="p-5 pb-4 border-b border-border/60">
                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={goBack}
                            disabled={isFirstStep || generating}
                            aria-label="Back"
                            className="shrink-0 rounded-lg"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <DialogTitle className="flex items-center gap-2 text-base font-bold pr-8">
                            <span className="text-lg leading-none">
                                {CATEGORY_ICONS[category] ?? "✨"}
                            </span>
                            {config.titleBn} — Quick Setup
                        </DialogTitle>
                    </div>
                    <DialogDescription className="sr-only">
                        Answer a few quick questions and our AI will build a smart system
                        prompt for your {config.title} chatbot.
                    </DialogDescription>

                    {/* Step indicator + animated progress line */}
                    <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-primary">
                                Step {stepIndex + 1} of {totalSteps}: {currentStep.titleBn}
                            </span>
                            <span className="text-muted-foreground">{currentStep.title}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-secondary/40 overflow-hidden">
                            <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-primary via-violet-500 to-indigo-500"
                                initial={false}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.35, ease: "easeInOut" }}
                            />
                        </div>
                    </div>
                </DialogHeader>

                {/* ─── Sliding step content ───────────────────────────── */}
                <div className="relative flex-1 overflow-x-hidden overflow-y-auto">
                    <AnimatePresence mode="wait" custom={direction} initial={false}>
                        <motion.div
                            key={stepIndex}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="space-y-5 p-5"
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

                {/* ─── Footer navigation ──────────────────────────────── */}
                <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/40 p-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={goBack}
                        disabled={isFirstStep || generating}
                        className="gap-1.5 rounded-full"
                    >
                        <ArrowLeft className="w-4 h-4" /> Previous
                    </Button>

                    <Button
                        type="button"
                        onClick={goNext}
                        disabled={generating}
                        className="gap-2 rounded-full bg-gradient-to-r from-primary via-violet-500 to-indigo-500 text-white font-bold shadow-lg shadow-primary/25 hover:opacity-90 transition-all active:scale-[0.98]"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Building AI System
                                Prompt…
                            </>
                        ) : isLastStep ? (
                            <>
                                <Sparkles className="w-4 h-4" /> Generate Smart Prompt
                            </>
                        ) : (
                            <>
                                Next <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
