"use client";

import { useState } from "react";
import { Package, Loader2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface BookParcelButtonProps {
  orderId: string;
  courier: string;
  trackingId?: string | null;
  onBooked?: (trackingId: string) => void;
}

/** One-click parcel booking button with loading and success states. */
export function BookParcelButton({
  orderId,
  courier,
  trackingId,
  onBooked,
}: BookParcelButtonProps) {
  const { t } = useTranslation("orders");
  const [loading, setLoading] = useState(false);
  const [booked, setBooked] = useState(!!trackingId);
  const [localTrackingId, setLocalTrackingId] = useState(trackingId ?? "");

  // Already booked — show tracking ID pill
  if (booked && localTrackingId) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-semibold">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        {localTrackingId}
      </div>
    );
  }

  const handleBook = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders/book-parcel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, courier }),
      });

      const data = (await res.json()) as { success?: boolean; trackingId?: string; error?: string };

      if (res.ok && data.success && data.trackingId) {
        setBooked(true);
        setLocalTrackingId(data.trackingId);
        toast.success(
          t("parcelBooking.successToast", "Parcel booked! Tracking: {{id}}", {
            id: data.trackingId,
          })
        );
        onBooked?.(data.trackingId);
      } else {
        toast.error(data.error ?? t("parcelBooking.errorFallback", "Failed to book parcel"));
      }
    } catch {
      toast.error(t("parcelBooking.errorFallback", "Failed to book parcel"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="book-btn"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        <Button
          onClick={handleBook}
          disabled={loading}
          size="sm"
          className="h-8 gap-1.5 bg-brand-gradient hover:opacity-90 text-white font-semibold text-xs shadow-sm cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t("parcelBooking.booking", "Booking...")}
            </>
          ) : (
            <>
              <Package className="w-3.5 h-3.5" />
              {t("parcelBooking.button", "Book Parcel")}
            </>
          )}
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}
