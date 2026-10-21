"use client";

import { useState } from "react";
import { XCircle, FileText, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";

const CANCELLATION_REASONS = [
  "customer_request",
  "changed_mind",
  "out_of_stock",
  "wrong_item",
  "delivery_failed",
  "damaged_in_transit",
  "fraud_fake_order",
  "other",
] as const;

export type CancellationReasonCode = typeof CANCELLATION_REASONS[number];

const REASON_LABELS: Record<CancellationReasonCode, { en: string; bn: string }> = {
  customer_request: { en: "Customer Request", bn: "Customer-এর অনুরোধ" },
  changed_mind: { en: "Changed Mind", bn: "মত পরিবর্তন করেছেন" },
  out_of_stock: { en: "Product Out of Stock", bn: "পণ্য স্টকে নেই" },
  wrong_item: { en: "Wrong Item Sent", bn: "ভুল পণ্য পাঠানো হয়েছে" },
  delivery_failed: { en: "Delivery Failed (Customer Unavailable)", bn: "Delivery ব্যর্থ (Customer অনুপস্থিত)" },
  damaged_in_transit: { en: "Damaged in Transit", bn: "পরিবহনে ক্ষতিগ্রস্ত" },
  fraud_fake_order: { en: "Fraud / Fake Order", bn: "ভুয়া অর্ডার" },
  other: { en: "Other (specify)", bn: "অন্যান্য (উল্লেখ করুন)" },
};

export type IssueStatusType = "Cancelled" | "Returned" | "Damage";

interface CancellationReasonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderPublicId: string;
  statusType: IssueStatusType;
  onSuccess: () => void;
}

/** Modal for selecting a structured cancellation/return/damage reason (Feature #27). */
export function CancellationReasonModal({
  open,
  onOpenChange,
  orderId,
  orderPublicId,
  statusType,
  onSuccess,
}: CancellationReasonModalProps) {
  const { t, i18n } = useTranslation("orders");
  const lang = (i18n.language?.startsWith("bn") ? "bn" : "en") as "en" | "bn";
  const [selectedReason, setSelectedReason] = useState<CancellationReasonCode | "">("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      toast.error(t("cancellationReason.selectRequired", "Please select a reason"));
      return;
    }

    setLoading(true);
    try {
      const fieldKey =
        statusType === "Cancelled"
          ? "cancellationReason"
          : statusType === "Returned"
          ? "returnReason"
          : "damageNote";

      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusType,
          [fieldKey]: `${selectedReason}${note ? `: ${note}` : ""}`,
        }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };

      if (res.ok && (data.success || (data as { order?: unknown }).order)) {
        toast.success(t("cancellationReason.saved", "Reason saved successfully"));
        onSuccess();
        onOpenChange(false);
        setSelectedReason("");
        setNote("");
      } else {
        toast.error(data.error ?? t("cancellationReason.saveFailed", "Failed to save reason"));
      }
    } catch {
      toast.error(t("cancellationReason.saveFailed", "Failed to save reason"));
    } finally {
      setLoading(false);
    }
  };

  const titleMap: Record<IssueStatusType, string> = {
    Cancelled: t("cancellationReason.titleCancelled", "Cancellation Reason"),
    Returned: t("cancellationReason.titleReturned", "Return Reason"),
    Damage: t("cancellationReason.titleDamage", "Damage Note"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-destructive" />
            {titleMap[statusType]}
          </DialogTitle>
          <DialogDescription>
            {t("cancellationReason.subtitle", "Order #{{id}} — Select a reason", { id: orderPublicId })}
          </DialogDescription>
        </DialogHeader>

        {/* Reason options */}
        <div className="space-y-1.5 py-2">
          {CANCELLATION_REASONS.map((reason) => (
            <motion.button
              key={reason}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedReason(reason)}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all border cursor-pointer ${
                selectedReason === reason
                  ? "bg-primary/10 border-primary/40 text-foreground font-semibold"
                  : "border-border/40 hover:bg-muted/50 text-muted-foreground"
              }`}
            >
              {REASON_LABELS[reason][lang]}
            </motion.button>
          ))}
        </div>

        {/* Additional note */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            {t("cancellationReason.additionalNote", "Additional Note (optional)")}
          </div>
          <Textarea
            rows={2}
            placeholder={t("cancellationReason.notePlaceholder", "Any additional details...")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="bg-muted/40 text-xs resize-none"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs cursor-pointer"
          >
            {t("cancellationReason.cancel", "Cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !selectedReason}
            className="bg-brand-gradient hover:opacity-90 text-white font-bold text-xs cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                {t("cancellationReason.saving", "Saving...")}
              </>
            ) : (
              t("cancellationReason.confirm", "Confirm & Save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

