"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ArrowLeft,
    ArrowRight,
    Loader2,
    RotateCcw,
    Sparkles,
    Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
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
    type WizardField,
} from "@/lib/ai/wizard-schema";
import { useWorkspace } from "@/components/workspace-provider";
import { cn } from "@/lib/core/utils";

interface InlineWizardProps {
    chatbotId?: string;
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

export function InlineWizard({
    chatbotId,
    initialCategory,
    onGenerated,
    className,
}: InlineWizardProps) {
    const { t, i18n } = useTranslation("chatbots");
    const isBn = i18n.language === "bn";
    const { activeWorkspace } = useWorkspace();

    // The business category is strictly driven by the active Workspace
    const effectiveCategory =
        activeWorkspace?.category || initialCategory || "ecommerce";
    const resolvedCategory = getWizardCategory(effectiveCategory)
        ? effectiveCategory
        : "ecommerce";

    const [category, setCategory] = useState<string>(resolvedCategory);
    const [stepIndex, setStepIndex] = useState(0);
    const [direction, setDirection] = useState(1);
    const [generating, setGenerating] = useState(false);

    // AI-Assisted Custom Generator Modal State
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiBusinessName, setAiBusinessName] = useState(
        activeWorkspace?.name || ""
    );
    const [aiDescription, setAiDescription] = useState("");
    const [aiGenerating, setAiGenerating] = useState(false);

    const config = getWizardCategory(category);

    const getIdentityDefaults = (
        catKey: string,
        wsName?: string
    ): Record<string, string> => {
        const defaults: Record<string, string> = {};
        if (!wsName) return defaults;
        const cfg = getWizardCategory(catKey);
        if (cfg) {
            const idField = cfg.fields.find(
                (f) => f.promptSection === "identity"
            );
            if (idField) {
                defaults[idField.key] = wsName;
            }
        }
        return defaults;
    };

    const [formData, setFormData] = useState<WizardData>(() => {
        const cfg = getWizardCategory(resolvedCategory);
        if (!cfg) return {};
        const idDefaults = getIdentityDefaults(
            resolvedCategory,
            activeWorkspace?.name
        );
        return buildInitialData(cfg.fields, idDefaults);
    });

    // Auto-sync category and identity whenever the active Workspace changes
    useEffect(() => {
        if (activeWorkspace?.category) {
            const nextCat = getWizardCategory(activeWorkspace.category)
                ? activeWorkspace.category
                : "ecommerce";
            if (nextCat !== category) {
                setCategory(nextCat);
                const cfg = getWizardCategory(nextCat);
                if (cfg) {
                    const idDefaults = getIdentityDefaults(
                        nextCat,
                        activeWorkspace.name
                    );
                    setFormData(buildInitialData(cfg.fields, idDefaults));
                    setStepIndex(0);
                    setDirection(1);
                }
            }
        }
        if (activeWorkspace?.name && !aiBusinessName) {
            setAiBusinessName(activeWorkspace.name);
        }
    }, [activeWorkspace?.category, activeWorkspace?.name]);

    const setValue = (key: string, value: string | number | boolean) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const totalSteps = config?.steps.length ?? 0;
    const currentStep = config?.steps[stepIndex];
    const isFirstStep = stepIndex === 0;
    const isLastStep = stepIndex === totalSteps - 1;

    const visibleFields = useMemo(
        () =>
            currentStep
                ? currentStep.fields.filter((f) => isFieldActive(f, formData))
                : [],
        [currentStep, formData]
    );

    const handleReset = () => {
        if (!config) return;
        const idDefaults = getIdentityDefaults(category, activeWorkspace?.name);
        setFormData(buildInitialData(config.fields, idDefaults));
        setStepIndex(0);
        setDirection(-1);
        toast.info(t("wizard.resetDone", "Wizard form reset to defaults."));
    };

    const validateStep = (): boolean => {
        for (const field of visibleFields) {
            if (!field.required) continue;
            const val = formData[field.key];
            if (val === undefined || val === null || String(val).trim() === "") {
                const fieldName = isBn ? field.labelBn : field.label;
                toast.error(t("wizard.requiredError", { field: fieldName }));
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
        if (!category) return;
        setGenerating(true);
        try {
            const res = await fetch("/api/chatbots/wizard-compile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category, wizardData: formData, chatbotId }),
            });

            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || t("wizard.errorToast"));
                return;
            }

            onGenerated(data.rawPrompt, data.compiledPrompt, formData, category);
            toast.success(t("wizard.successToast"));
        } catch (error) {
            console.error("[INLINE_WIZARD_ERROR]", error);
            toast.error(t("wizard.errorToast"));
        } finally {
            setGenerating(false);
        }
    };

    const handleOneClickAiGenerate = async () => {
        if (!aiDescription.trim()) {
            toast.error(t("wizard.aiModal.emptyDescError"));
            return;
        }

        setAiGenerating(true);
        try {
            const res = await fetch("/api/chatbots/generate-custom-prompt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    businessName: aiBusinessName.trim() || activeWorkspace?.name || "",
                    description: aiDescription.trim(),
                    category: category || "custom",
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || t("wizard.errorToast"));
                return;
            }

            setIsAiModalOpen(false);
            onGenerated(data.rawPrompt, data.compiledPrompt, {}, category || "custom");
            toast.success(t("wizard.aiModal.successToast"));
        } catch (err) {
            console.error("[ONE_CLICK_AI_ERROR]", err);
            toast.error(t("wizard.errorToast"));
        } finally {
            setAiGenerating(false);
        }
    };

    // Fallback if config is missing (e.g. unknown custom category)
    if (!config || !currentStep) {
        return (
            <div className={cn("p-6 text-center space-y-4 rounded-2xl border border-border bg-card", className)}>
                <Sparkles className="w-8 h-8 text-primary mx-auto" />
                <h3 className="font-bold text-sm text-foreground">
                    {t("wizard.customModeTitle", "AI-Powered Agent Setup")}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {t("wizard.customModeDesc", "Generate tailored system instructions for this agent with 1-Click AI.")}
                </p>
                <Button
                    type="button"
                    onClick={() => setIsAiModalOpen(true)}
                    className="bg-brand-gradient text-white font-bold gap-2 rounded-full cursor-pointer shadow-md"
                >
                    <Wand2 className="w-4 h-4" />
                    {t("wizard.oneClickAi", "1-Click AI Setup")}
                </Button>

                {/* One-Click AI Custom Generator Dialog */}
                <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-primary" />
                                {t("wizard.aiModal.title", "1-Click AI Setup")}
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                {t("wizard.aiModal.subtitle", "Describe your business in your own words. AI will shape the perfect agent prompt.")}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 pt-2">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">{t("wizard.aiModal.brandLabel", "Business / Brand Name")}</Label>
                                <Input
                                    value={aiBusinessName}
                                    onChange={(e) => setAiBusinessName(e.target.value)}
                                    placeholder={t("wizard.aiModal.brandPlaceholder", "e.g. Acme Co")}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">{t("wizard.aiModal.descLabel", "Business Description")}</Label>
                                <Textarea
                                    rows={4}
                                    value={aiDescription}
                                    onChange={(e) => setAiDescription(e.target.value)}
                                    placeholder={t("wizard.aiModal.descPlaceholder", "What services or products do you offer? Mention pricing, timings, or key rules...")}
                                />
                            </div>

                            <Button
                                type="button"
                                onClick={handleOneClickAiGenerate}
                                disabled={aiGenerating || !aiDescription.trim()}
                                className="w-full bg-brand-gradient text-white font-bold gap-2 rounded-full cursor-pointer shadow-md"
                            >
                                {aiGenerating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" /> {t("wizard.aiModal.generatingBtn", "Generating...")}
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" /> {t("wizard.aiModal.generateBtn", "Generate Agent Prompt")}
                                    </>
                                )}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    const progress = ((stepIndex + 1) / totalSteps) * 100;

    return (
        <div className={cn("flex flex-col space-y-5", className)}>
            {/* Header — Workspace Business Badge + Actions */}
            <div className="space-y-3 pb-2 border-b border-border/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
                            <span className="text-base leading-none">
                                {CATEGORY_ICONS[category] ?? "✨"}
                            </span>
                            <span className="truncate max-w-[160px] sm:max-w-xs text-foreground font-semibold">
                                {activeWorkspace?.name || (isBn ? config.titleBn : config.title)}
                            </span>
                            <span className="text-primary/40">•</span>
                            <span className="text-[11px] font-medium text-primary">
                                {isBn ? config.titleBn : config.title}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            type="button"
                            onClick={() => setIsAiModalOpen(true)}
                            size="sm"
                            className="rounded-full bg-brand-gradient text-white text-xs font-bold gap-1.5 shadow-sm shadow-primary/20 shrink-0 cursor-pointer h-8 px-3"
                        >
                            <Wand2 className="w-3.5 h-3.5" />
                            <span>{t("wizard.oneClickAi", "1-Click AI")}</span>
                        </Button>

                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleReset}
                            disabled={generating}
                            className="h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-full px-2.5"
                        >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            <span>{t("wizard.resetForm", "Reset")}</span>
                        </Button>
                    </div>
                </div>

                {/* Progress bar & Step title */}
                <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-primary">
                            {t("wizard.stepOf", {
                                current: stepIndex + 1,
                                total: totalSteps,
                                defaultValue: `Step ${stepIndex + 1} of ${totalSteps}`,
                            })}: {isBn ? currentStep.titleBn : currentStep.title}
                        </span>
                        <span className="text-muted-foreground text-[11px]">
                            {isBn ? currentStep.title : currentStep.titleBn}
                        </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-secondary/40 overflow-hidden">
                        <motion.div
                            className="h-full rounded-full bg-brand-gradient"
                            initial={false}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.35, ease: "easeInOut" }}
                        />
                    </div>
                </div>
            </div>

            {/* Sliding step content */}
            <div className="relative flex-1 overflow-x-hidden pt-1">
                <AnimatePresence mode="wait" custom={direction} initial={false}>
                    <motion.div
                        key={stepIndex}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="space-y-4"
                    >
                        {visibleFields.map((field) => (
                            <div key={field.key} className="space-y-2">
                                {field.type !== "select" && (
                                    <Label className="text-sm font-semibold flex items-center gap-2">
                                        {isBn ? field.labelBn : field.label}
                                        <span className="text-[10px] font-normal text-muted-foreground">
                                            {isBn ? field.label : field.labelBn}
                                        </span>
                                        {field.required && (
                                            <span className="text-[10px] font-semibold text-destructive">
                                                *
                                            </span>
                                        )}
                                    </Label>
                                )}

                                {renderFieldControl(field, formData, setValue, isBn)}

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
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-border/60">
                <Button
                    type="button"
                    variant="outline"
                    onClick={goBack}
                    disabled={generating || isFirstStep}
                    className="gap-1.5 rounded-full cursor-pointer disabled:opacity-40"
                >
                    <ArrowLeft className="w-4 h-4" /> {t("wizard.previous", "Previous")}
                </Button>

                <div className="flex items-center gap-2">
                    {!isLastStep && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                                setDirection(1);
                                setStepIndex((i) => i + 1);
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                            {t("wizard.skipStep", "Skip")}
                        </Button>
                    )}

                    <Button
                        type="button"
                        onClick={goNext}
                        disabled={generating}
                        className="gap-2 rounded-full bg-brand-gradient text-white font-bold shadow-lg shadow-primary/25 hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" /> {t("wizard.building", "Building...")}
                            </>
                        ) : isLastStep ? (
                            <>
                                <Sparkles className="w-4 h-4" /> {t("wizard.generatePrompt", "Generate Prompt")}
                            </>
                        ) : (
                            <>
                                {t("wizard.next", "Next")} <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* One-Click AI Custom Generator Dialog */}
            <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-primary" />
                            {t("wizard.aiModal.title", "1-Click AI Setup")}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {t("wizard.aiModal.subtitle", "Describe your business in your own words. AI will shape the perfect agent prompt.")}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">{t("wizard.aiModal.brandLabel", "Business / Brand Name")}</Label>
                            <Input
                                value={aiBusinessName}
                                onChange={(e) => setAiBusinessName(e.target.value)}
                                placeholder={t("wizard.aiModal.brandPlaceholder", "e.g. Acme Co")}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">{t("wizard.aiModal.descLabel", "Business Description")}</Label>
                            <Textarea
                                rows={4}
                                value={aiDescription}
                                onChange={(e) => setAiDescription(e.target.value)}
                                placeholder={t("wizard.aiModal.descPlaceholder", "What services or products do you offer? Mention pricing, timings, or key rules...")}
                            />
                        </div>

                        <Button
                            type="button"
                            onClick={handleOneClickAiGenerate}
                            disabled={aiGenerating || !aiDescription.trim()}
                            className="w-full bg-brand-gradient text-white font-bold gap-2 rounded-full cursor-pointer shadow-md"
                        >
                            {aiGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> {t("wizard.aiModal.generatingBtn", "Generating...")}
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" /> {t("wizard.aiModal.generateBtn", "Generate Agent Prompt")}
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
