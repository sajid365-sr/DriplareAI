"use client";

import { useState, useEffect } from "react";
import { User, Phone, MapPin, Package, Hash, Banknote, Truck, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import type { OrderRow } from "./types";

interface OrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "create" | "edit";
  order?: OrderRow | null;
  onSuccess: () => void;
}

const BD_DISTRICTS = [
  "Dhaka", "Chittagong", "Gazipur", "Narayanganj", "Cumilla",
  "Sylhet", "Rajshahi", "Khulna", "Barisal", "Rangpur",
  "Mymensingh", "Bogra", "Feni", "Noakhali", "Jessore",
];

export function OrderSheet({
  open,
  onOpenChange,
  mode = "create",
  order = null,
  onSuccess,
}: OrderSheetProps) {
  const isEdit = mode === "edit" && order !== null;

  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    deliveryAddress: "",
    district: "Dhaka",
    productName: "",
    qty: 1,
    unitPrice: 1850,
    codAmount: 1850,
    courierName: "Steadfast",
    status: "Processing",
    internalNotes: "",
  });

  const [submitting, setSubmitting] = useState(false);

  // Sync form state on mode change or when order prop changes
  useEffect(() => {
    if (isEdit && order) {
      const firstItem = Array.isArray(order.items) && order.items.length > 0 ? order.items[0] : null;
      setForm({
        customerName: order.customerName || "",
        customerPhone: order.customerPhone || "",
        deliveryAddress: order.deliveryAddress || "",
        district: order.district || "Dhaka",
        productName: firstItem ? firstItem.name : "Custom Order Item",
        qty: firstItem ? firstItem.qty : 1,
        unitPrice: firstItem ? firstItem.price : order.totalAmount,
        codAmount: order.totalAmount || 0,
        courierName: order.courierName || "Steadfast",
        status: order.status || "Processing",
        internalNotes: order.internalNotes || "",
      });
    } else {
      setForm({
        customerName: "",
        customerPhone: "",
        deliveryAddress: "",
        district: "Dhaka",
        productName: "",
        qty: 1,
        unitPrice: 1850,
        codAmount: 1850,
        courierName: "Steadfast",
        status: "Processing",
        internalNotes: "",
      });
    }
  }, [isEdit, order, open]);

  // Recalculate COD amount when qty or price changes, unless overridden
  const handleQtyChange = (val: number) => {
    const q = Math.max(1, val);
    setForm((prev) => ({
      ...prev,
      qty: q,
      codAmount: q * prev.unitPrice,
    }));
  };

  const handlePriceChange = (val: number) => {
    const p = Math.max(0, val);
    setForm((prev) => ({
      ...prev,
      unitPrice: p,
      codAmount: prev.qty * p,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (!form.deliveryAddress.trim()) {
      toast.error("Delivery address is required");
      return;
    }
    if (!form.productName.trim()) {
      toast.error("Product name is required");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        deliveryAddress: form.deliveryAddress,
        district: form.district,
        items: [
          {
            name: form.productName,
            qty: Number(form.qty),
            price: Number(form.unitPrice),
          },
        ],
        totalAmount: Number(form.codAmount),
        courierName: form.courierName,
        status: form.status,
        internalNotes: form.internalNotes,
      };

      const url = isEdit && order ? `/api/orders/${order.id}` : "/api/orders";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && (data.success || data.order)) {
        toast.success(
          isEdit
            ? `Order #${order?.orderId} updated successfully!`
            : `Order created successfully! Tracking: ${data.order?.courierTrackingId || "N/A"}`
        );
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(data.error || "Failed to save order");
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred while saving");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-6 flex flex-col">
        <SheetHeader className="pb-4 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Package className="w-5 h-5" />
            </span>
            {isEdit ? `Edit Order #${order?.orderId}` : "Create Manual Order"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update order customer details, items, courier preferences, and status."
              : "Create a new customer order manually and select preferred courier for dispatch."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Customer Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              Customer Name <span className="text-destructive">*</span>
            </Label>
            <Input
              required
              placeholder="e.g. Rahim Ahmed"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              className="bg-muted/40 text-xs"
            />
          </div>

          {/* Customer Phone & District */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                Phone Number
              </Label>
              <Input
                placeholder="01712345678"
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                className="bg-muted/40 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                District
              </Label>
              <select
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                className="w-full h-9 px-3 rounded-md bg-muted/40 border border-input text-xs outline-none focus:ring-2 focus:ring-primary/30"
              >
                {BD_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              Delivery Address <span className="text-destructive">*</span>
            </Label>
            <Textarea
              required
              rows={2}
              placeholder="House #, Road #, Area details..."
              value={form.deliveryAddress}
              onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
              className="bg-muted/40 text-xs resize-none"
            />
          </div>

          {/* Product Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <Package className="w-3.5 h-3.5 text-muted-foreground" />
              Product Name / Item <span className="text-destructive">*</span>
            </Label>
            <Input
              required
              placeholder="e.g. Smart Watch Pro - Black"
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
              className="bg-muted/40 text-xs"
            />
          </div>

          {/* Qty & Unit Price & COD Amount */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                Quantity
              </Label>
              <Input
                type="number"
                min={1}
                value={form.qty}
                onChange={(e) => handleQtyChange(parseInt(e.target.value) || 1)}
                className="bg-muted/40 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Banknote className="w-3.5 h-3.5 text-muted-foreground" />
                Unit Price (৳)
              </Label>
              <Input
                type="number"
                min={0}
                value={form.unitPrice}
                onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0)}
                className="bg-muted/40 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Banknote className="w-3.5 h-3.5 text-primary" />
                COD Amount (৳)
              </Label>
              <Input
                type="number"
                min={0}
                value={form.codAmount}
                onChange={(e) => setForm({ ...form, codAmount: parseFloat(e.target.value) || 0 })}
                className="bg-primary/5 font-bold text-primary text-xs"
              />
            </div>
          </div>

          {/* Preferred Courier & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                Preferred Courier
              </Label>
              <select
                value={form.courierName}
                onChange={(e) => setForm({ ...form, courierName: e.target.value })}
                className="w-full h-9 px-3 rounded-md bg-muted/40 border border-input text-xs outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="Steadfast">Steadfast Express 🚚</option>
                <option value="Pathao">Pathao Courier 🏍️</option>
                <option value="RedX">RedX Logistics 📦</option>
              </select>
            </div>

            {isEdit && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                  Order Status
                </Label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full h-9 px-3 rounded-md bg-muted/40 border border-input text-xs outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="Processing">Processing</option>
                  <option value="Dispatched">Dispatched</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Returned">Returned</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            )}
          </div>

          {/* Internal Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              Internal Notes
            </Label>
            <Textarea
              rows={2}
              placeholder="e.g. Special packing request or delivery instructions..."
              value={form.internalNotes}
              onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
              className="bg-muted/40 text-xs resize-none"
            />
          </div>
        </form>

        <SheetFooter className="mt-auto pt-4 border-t border-border/50">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-brand-gradient hover:opacity-90 text-white font-bold text-xs shadow-md"
          >
            {submitting
              ? isEdit ? "Saving Changes..." : "Creating Order..."
              : isEdit ? "Save Changes" : "Create & Dispatch Order"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
