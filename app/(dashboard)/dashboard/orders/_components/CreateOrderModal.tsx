"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, X, Phone, MapPin, Package, Hash, User } from "lucide-react";
import { toast } from "sonner";

interface CreateOrderModalProps {
    onClose: () => void;
    onCreated: () => void;
}

/**
 * Full-screen modal for creating a manual order.
 * Sends a POST to `/api/orders` and triggers a refresh on success.
 */
export function CreateOrderModal({ onClose, onCreated }: CreateOrderModalProps) {
    const [form, setForm] = useState({
        customerName: "",
        customerPhone: "",
        deliveryAddress: "",
        district: "",
        product: "",
        qty: "1",
        price: "1850",
        courierName: "Steadfast",
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.customerName || !form.product) {
            toast.error("Customer name and product are required");
            return;
        }
        setSubmitting(true);
        try {
            const items = [
                {
                    name: form.product,
                    qty: parseInt(form.qty),
                    price: parseFloat(form.price),
                },
            ];
            const res = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerName: form.customerName,
                    customerPhone: form.customerPhone,
                    deliveryAddress: form.deliveryAddress,
                    district: form.district,
                    items,
                    courierName: form.courierName,
                }),
            });
            const data = await res.json();
            if (data.success && data.order) {
                toast.success(
                    `✓ Order ${data.order.orderId} created! Tracking: ${data.order.courierTrackingId}`
                );
                onCreated();
                onClose();
            } else {
                toast.error("Failed to create order");
            }
        } catch {
            toast.error("Error creating order");
        } finally {
            setSubmitting(false);
        }
    };

    // Form field definitions for the grid
    const fields = [
        { key: "customerName", label: "Customer Name", icon: User, type: "text", col: 2 },
        { key: "customerPhone", label: "Phone Number", icon: Phone, type: "tel", col: 1 },
        { key: "district", label: "District", icon: MapPin, type: "text", col: 1 },
        { key: "deliveryAddress", label: "Delivery Address", icon: MapPin, type: "text", col: 2 },
        { key: "product", label: "Product Name", icon: Package, type: "text", col: 2 },
        { key: "qty", label: "Quantity", icon: Hash, type: "number", col: 1 },
        { key: "price", label: "Unit Price (৳)", icon: Hash, type: "number", col: 1 },
    ] as const;

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
                        <Plus className="w-4 h-4 text-primary" />
                        Create Manual Order
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        {fields.map(({ key, label, icon: Icon, type, col }) => (
                            <div key={key} className={col === 2 ? "col-span-2" : "col-span-1"}>
                                <label className="text-[11px] text-muted-foreground font-semibold mb-1 block">
                                    {label}
                                </label>
                                <div className="relative">
                                    <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                                    <input
                                        type={type}
                                        value={(form as any)[key]}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, [key]: e.target.value }))
                                        }
                                        className="w-full pl-7 pr-2.5 py-2 bg-muted/50 border border-border/50 rounded-lg text-[12px] outline-none focus:ring-2 focus:ring-primary/40"
                                    />
                                </div>
                            </div>
                        ))}

                        <div className="col-span-2">
                            <label className="text-[11px] text-muted-foreground font-semibold mb-1 block">
                                Courier
                            </label>
                            <select
                                value={form.courierName}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, courierName: e.target.value }))
                                }
                                className="w-full px-2.5 py-2 bg-muted/50 border border-border/50 rounded-lg text-[12px] outline-none"
                            >
                                <option>Steadfast</option>
                                <option>Pathao</option>
                                <option>RedX</option>
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-2.5 rounded-xl bg-brand-gradient hover:opacity-90 text-white text-[13px] font-bold disabled:opacity-50"
                    >
                        {submitting ? "Creating Order..." : "Create & Dispatch Order"}
                    </button>
                </form>
            </motion.div>
        </motion.div>
    );
}
