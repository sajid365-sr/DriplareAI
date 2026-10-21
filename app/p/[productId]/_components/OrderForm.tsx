"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Truck, ShieldCheck, ArrowRight, Loader2, MapPin, User, Phone, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface OrderFormProps {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  selectedVariants: Record<string, string>;
  sessionId?: string;
  channel?: string;
  onOrderPlaced: (orderData: { orderId: string; totalAmount: number }) => void;
}

export function OrderForm({
  productId,
  productName,
  unitPrice,
  quantity,
  selectedVariants,
  sessionId,
  channel,
  onOrderPlaced,
}: OrderFormProps) {
  const { t } = useTranslation("product-page");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [district, setDistrict] = useState("Dhaka");
  const [deliveryArea, setDeliveryArea] = useState<"inside" | "outside">("inside");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const deliveryFee = deliveryArea === "inside" ? 60 : 120;
  const subtotal = unitPrice * quantity;
  const grandTotal = subtotal + deliveryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      toast.error(t("fullNamePlaceholder"));
      return;
    }
    if (!customerPhone.trim() || customerPhone.trim().length < 6) {
      toast.error(t("phoneNumberPlaceholder"));
      return;
    }
    if (!deliveryAddress.trim() || deliveryAddress.trim().length < 5) {
      toast.error(t("deliveryAddressPlaceholder"));
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/p/${productId}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          deliveryAddress: deliveryAddress.trim(),
          district: district.trim(),
          quantity,
          variant: selectedVariants,
          deliveryFee,
          paymentMethod: "COD",
          sessionId,
          channel,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit order");
      }

      toast.success(t("orderSuccessTitle"));
      onOrderPlaced({
        orderId: data.orderId,
        totalAmount: data.totalAmount,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Order failed";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border/80 bg-card p-4 sm:p-6 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
          <Truck className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          {t("orderFormTitle")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("orderFormSubtitle")}</p>
      </div>

      {/* Input Fields */}
      <div className="space-y-3.5">
        <div>
          <label className="mb-1 block text-xs font-semibold text-foreground">
            {t("fullName")} *
          </label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t("fullNamePlaceholder")}
              className="w-full rounded-xl border border-border/80 bg-background/50 pl-9 pr-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-foreground">
            {t("phoneNumber")} *
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              type="tel"
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder={t("phoneNumberPlaceholder")}
              className="w-full rounded-xl border border-border/80 bg-background/50 pl-9 pr-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-foreground">
            {t("deliveryAddress")} *
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <textarea
              required
              rows={2}
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder={t("deliveryAddressPlaceholder")}
              className="w-full rounded-xl border border-border/80 bg-background/50 pl-9 pr-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
            />
          </div>
        </div>

        {/* Delivery Region Selection */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">
            {t("deliveryFee")}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setDeliveryArea("inside");
                setDistrict("Dhaka");
              }}
              className={`rounded-xl border p-2.5 text-left transition-all ${
                deliveryArea === "inside"
                  ? "border-violet-600 bg-violet-500/10 text-foreground ring-1 ring-violet-500/30"
                  : "border-border/70 bg-background/50 text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">ঢাকার ভেতরে</span>
                <span className="text-xs font-extrabold text-violet-600 dark:text-violet-400">৳৬০</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setDeliveryArea("outside");
                if (district === "Dhaka") setDistrict("");
              }}
              className={`rounded-xl border p-2.5 text-left transition-all ${
                deliveryArea === "outside"
                  ? "border-violet-600 bg-violet-500/10 text-foreground ring-1 ring-violet-500/30"
                  : "border-border/70 bg-background/50 text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">ঢাকার বাইরে</span>
                <span className="text-xs font-extrabold text-violet-600 dark:text-violet-400">৳১২০</span>
              </div>
            </button>
          </div>
        </div>

        {/* Payment Method Badge */}
        <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-bold text-foreground">{t("cashOnDelivery")}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{t("cashOnDeliveryNote")}</p>
        </div>
      </div>

      {/* Bill & Summary */}
      <div className="space-y-1.5 border-t border-border/70 pt-3.5 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>{productName} (x{quantity})</span>
          <span className="font-medium text-foreground">৳{subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>{t("deliveryFee")}</span>
          <span className="font-medium text-foreground">৳{deliveryFee}</span>
        </div>
        <div className="flex justify-between border-t border-border/60 pt-2 text-sm font-bold text-foreground">
          <span>{t("total")}</span>
          <span className="text-base text-violet-600 dark:text-violet-400">৳{grandTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-violet-500/25 transition-all hover:opacity-95 hover:shadow-lg hover:shadow-violet-500/30 active:scale-[0.99] disabled:opacity-60"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t("processingOrder")}</span>
          </>
        ) : (
          <>
            <span>{t("confirmOrder")}</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        <span>{t("secureCheckout")}</span>
      </div>
    </form>
  );
}
