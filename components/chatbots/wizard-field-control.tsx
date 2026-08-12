"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { HybridSelect } from "@/components/ui/HybridSelect";
import { cn } from "@/lib/utils";
import type { WizardData, WizardField } from "@/lib/ai/wizard-schema";

/**
 * lib-less shared building blocks for the wizard UIs. Both the popup
 * `WizardModal` and the embedded `InlineWizard` render fields the exact same
 * way, so the control switch, slide variants, icons, and initial-state builder
 * live here as a single source of truth.
 */

/** Emoji shown next to each category title across the wizard UIs. */
export const CATEGORY_ICONS: Record<string, string> = {
    ecommerce: "🛍️",
    restaurant: "🍔",
    support: "🎧",
    lead_gen: "🎯",
    real_estate: "🏡",
    healthcare: "🏥",
    education: "🎓",
    general: "🤖",
};

/** Horizontal slide variants — `dir` drives the enter/exit sides. */
export const slideVariants = {
    enter: (dir: number) => ({ x: dir >= 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir >= 0 ? "-100%" : "100%", opacity: 0 }),
};

/** Initializes a fresh form state from every field across all steps. */
export function buildInitialData(fields: WizardField[]): WizardData {
    const data: WizardData = {};
    for (const field of fields) {
        data[field.key] = field.type === "boolean" ? false : "";
    }
    return data;
}

/** Renders the input control for a single field based on its type. */
export function renderFieldControl(
    field: WizardField,
    formData: WizardData,
    setValue: (key: string, value: string | number | boolean) => void
) {
    switch (field.type) {
        case "select":
            return (
                <HybridSelect
                    options={field.options ?? []}
                    value={String(formData[field.key] ?? "")}
                    onChange={(v) => setValue(field.key, v)}
                    placeholder={field.placeholder ?? "একটি অপশন সিলেক্ট করুন"}
                />
            );

        case "pills":
            return (
                <div className="flex flex-wrap gap-2">
                    {(field.options ?? []).map((option) => {
                        const active = formData[field.key] === option;
                        return (
                            <button
                                key={option}
                                type="button"
                                onClick={() =>
                                    setValue(field.key, active ? "" : option)
                                }
                                className={cn(
                                    "px-4 py-2 rounded-full text-sm font-medium border transition-all active:scale-95",
                                    active
                                        ? "bg-gradient-to-r from-primary via-violet-500 to-indigo-500 text-white border-transparent shadow-md shadow-primary/25"
                                        : "bg-secondary/20 border-border/60 text-foreground hover:bg-secondary/40"
                                )}
                            >
                                {option}
                            </button>
                        );
                    })}
                </div>
            );

        case "boolean":
            return (
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
                        onCheckedChange={(checked) => setValue(field.key, checked)}
                    />
                </div>
            );

        case "textarea":
            return (
                <Textarea
                    rows={3}
                    placeholder={field.placeholder}
                    value={String(formData[field.key] ?? "")}
                    onChange={(e) => setValue(field.key, e.target.value)}
                    className="rounded-xl bg-secondary/10 focus-visible:ring-primary/20 resize-none"
                />
            );

        default:
            return (
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
                    className="h-11 rounded-xl bg-secondary/10 focus-visible:ring-primary/20"
                />
            );
    }
}
