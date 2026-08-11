"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, X, Hash, Percent, Banknote, ShoppingCart, CalendarDays, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

/** Supported discount strategies for a coupon. */
export type DiscountType = "percentage" | "fixed" | "free_shipping";

/** Shape of a coupon row used across the Discounts & Coupons page. */
export interface Coupon {
    id: string;
    code: string;
    type: DiscountType;
    value: number;
    minOrder: number;
    expiresAt: string;
    active: boolean;
    redemptions: number;
    revenue: number;
}

interface CreateCouponModalProps {
    onClose: () => void;
    /** Fired with the fully-built coupon (create or edit depending on `initial`). */
    onCreated: (coupon: Coupon) => void;
    /** When provided the modal runs in edit mode and pre-fills the form. */
    initial?: Coupon;
}

const TYPE_LABELS: Record<DiscountType, string> = {
    percentage: "Percentage (%)",
    fixed: "Fixed (৳)",
    free_shipping: "Free Shipping",
};

/**
 * Modal for creating or editing a store coupon.
 * Builds a `Coupon` object and hands it to the parent via `onCreated`.
 */
export function CreateCouponModal({ onClose, onCreated, initial }: CreateCouponModalProps) {
    const [form, setForm] = useState({
        code: initial?.code ?? "",
        type: initial?.type ?? ("percentage" as DiscountType),
        value: initial ? String(initial.value) : "",
        minOrder: initial ? String(initial.minOrder) : "",
        expiresAt: initial?.expiresAt ?? "",
    });

    const isEdit = Boolean(initial);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = form.code.trim().toUpperCase();
        if (!code) {
            toast.error("Coupon code is required");
            return;
        }
        if (form.type !== "free_shipping" && !form.value) {
            toast.error("Discount value is required");
            return;
        }

        const coupon: Coupon = {
            id: initial?.id ?? `c-${Date.now()}`,
            code,
            type: form.type,
            value: form.type === "free_shipping" ? 0 : parseFloat(form.value) || 0,
            minOrder: parseFloat(form.minOrder) || 0,
            expiresAt: form.expiresAt,
            active: initial?.active ?? true,
            redemptions: initial?.redemptions ?? 0,
            revenue: initial?.revenue ?? 0,
        };

        toast.success(isEdit ? `✓ Coupon ${code} updated` : `✓ Coupon ${code} created`);
        onCreated(coupon);
        onClose();
    };

    const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
        setForm((f) => ({ ...f, [key]: value }));

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            >
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        <Tag className="w-4 h-4 text-primary" />
                        {isEdit ? "Edit Coupon" : "Create Coupon"}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    {/* Coupon Code */}
                    <div>
                        <label className="text-[11px] text-muted-foreground font-semibold mb-1 block">
                            Coupon Code
                        </label>
                        <div className="relative">
                            <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                            <input
                                value={form.code}
                                onChange={(e) => set("code", e.target.value)}
                                placeholder="e.g. EID2026"
                                className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all uppercase"
                            />
                        </div>
                    </div>

                    {/* Discount Type */}
                    <div>
                        <label className="text-[11px] text-muted-foreground font-semibold mb-1 block">
                            Discount Type
                        </label>
                        <Select
                            value={form.type}
                            onValueChange={(v) => set("type", v as DiscountType)}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {(Object.keys(TYPE_LABELS) as DiscountType[]).map((t) => (
                                    <SelectItem key={t} value={t}>
                                        {TYPE_LABELS[t]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* Value */}
                        <div>
                            <label className="text-[11px] text-muted-foreground font-semibold mb-1 block">
                                {form.type === "percentage" ? "Value (%)" : form.type === "fixed" ? "Value (৳)" : "Value"}
                            </label>
                            <div className="relative">
                                {form.type === "percentage" ? (
                                    <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                                ) : form.type === "fixed" ? (
                                    <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                                ) : (
                                    <ShoppingCart className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                                )}
                                <input
                                    type="number"
                                    min="0"
                                    value={form.value}
                                    onChange={(e) => set("value", e.target.value)}
                                    placeholder={form.type === "free_shipping" ? "—" : "0"}
                                    disabled={form.type === "free_shipping"}
                                    className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                                />
                            </div>
                        </div>

                        {/* Minimum Order */}
                        <div>
                            <label className="text-[11px] text-muted-foreground font-semibold mb-1 block">
                                Min. Order (৳)
                            </label>
                            <div className="relative">
                                <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                                <input
                                    type="number"
                                    min="0"
                                    value={form.minOrder}
                                    onChange={(e) => set("minOrder", e.target.value)}
                                    placeholder="0"
                                    className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Expiry Date */}
                    <div>
                        <label className="text-[11px] text-muted-foreground font-semibold mb-1 block">
                            Expiry Date
                        </label>
                        <div className="relative">
                            <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                            <input
                                type="date"
                                value={form.expiresAt}
                                onChange={(e) => set("expiresAt", e.target.value)}
                                className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-gradient-to-r from-primary to-fuchsia-500 hover:opacity-90 text-white border-none"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            {isEdit ? "Save Changes" : "Create Coupon"}
                        </Button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}