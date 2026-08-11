"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    getWizardCategory,
    type WizardData,
    type WizardField,
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

/** Initializes a fresh form state from the category's field definitions. */
function buildInitialData(fields: WizardField[]): WizardData {
    const data: WizardData = {};
    for (const field of fields) {
        data[field.key] = field.type === "boolean" ? false : "";
    }
    return data;
}

/**
 * Guided Setup Wizard Modal — renders dynamic input fields based on the
 * selected category schema from `@lib/ai/wizard-schema.ts`. The "Generate
 * Smart Prompt" action posts the answers to `/api/chatbots/wizard-compile`
 * and returns both the human-readable `rawPrompt` and the compiled prompt.
 */
export function WizardModal({
    open,
    onOpenChange,
    category,
    onGenerated,
}: WizardModalProps) {
    const config = getWizardCategory(category);
    const [formData, setFormData] = useState<WizardData>({});
    const [generating, setGenerating] = useState(false);

    // Reset the form whenever the modal opens or the category changes.
    useEffect(() => {
        if (open && config) {
            setFormData(buildInitialData(config.fields));
        }
    }, [open, category, config]);

    const setValue = (key: string, value: string | number | boolean) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
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

    if (!config) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                        <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary via-violet-500 to-indigo-500 flex items-center justify-center">
                            <Wand2 className="w-4 h-4 text-white" />
                        </span>
                        {config.titleBn} — Quick Setup
                    </DialogTitle>
                    <DialogDescription>
                        Answer a few quick questions and our AI will build a smart system
                        prompt for your {config.title} chatbot.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    <AnimatePresence initial={false}>
                        {config.fields.map((field, idx) => (
                            <motion.div
                                key={field.key}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.04 }}
                                className="space-y-2"
                            >
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

                                {field.type === "boolean" ? (
                                    <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-border/60 bg-secondary/20">
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-medium">
                                                {field.conditionText || "Yes / No"}
                                            </p>
                                            {field.hint && (
                                                <p className="text-[11px] text-muted-foreground">
                                                    {field.hint}
                                                </p>
                                            )}
                                        </div>
                                        <Switch
                                            checked={Boolean(formData[field.key])}
                                            onCheckedChange={(checked) =>
                                                setValue(field.key, checked)
                                            }
                                        />
                                    </div>
                                ) : field.type === "textarea" ? (
                                    <Textarea
                                        rows={3}
                                        placeholder={field.placeholder}
                                        value={String(formData[field.key] ?? "")}
                                        onChange={(e) => setValue(field.key, e.target.value)}
                                        className="rounded-xl bg-secondary/10 focus:ring-primary/20 resize-none"
                                    />
                                ) : (
                                    <Input
                                        type={field.type === "number" ? "number" : "text"}
                                        placeholder={field.placeholder}
                                        value={String(formData[field.key] ?? "")}
                                        onChange={(e) =>
                                            setValue(
                                                field.key,
                                                field.type === "number"
                                                    ? Number(e.target.value)
                                                    : e.target.value
                                            )
                                        }
                                        className="h-11 rounded-xl bg-secondary/10 focus:ring-primary/20"
                                    />
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                <DialogFooter>
                    <Button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="w-full sm:w-auto gap-2 rounded-full bg-gradient-to-r from-primary via-violet-500 to-indigo-500 text-white font-bold shadow-lg shadow-primary/25 hover:opacity-90 transition-all active:scale-[0.98]"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Generating…
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" /> Generate Smart Prompt
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}