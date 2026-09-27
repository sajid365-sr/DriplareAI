"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Undo2 } from "lucide-react";
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

/**
 * Admin Refund Dialog
 * ─────────────────────────────────────────────────────────────────────────────
 * একটি payment refund করার আগে admin-এর কাছ থেকে কারণ ও (প্রয়োজনে) আংশিক
 * amount নেওয়া হয়।
 *
 * ⚠️ এটি **record only** — কোনো gateway API এখানে টাকা ফেরত পাঠায় না।
 * UddoktaPay-এর refund API এখনো wire করা হয়নি (`supportsAutomaticRefund()`),
 * তাই admin নিজে gateway-এর dashboard থেকে merchant-কে টাকা ফেরত দিয়ে এখানে
 * সেটি লিখে রাখেন। এই সীমাটি UI-তে স্পষ্ট দেখানো হয়, যাতে admin ভুল প্রত্যাশা
 * না করেন।
 */

export interface RefundTarget {
  transactionId: string;
  merchantName: string;
  invoiceNumber: string | null;
  /** সম্পূর্ণ পরিশোধিত amount — partial refund-এর সর্বোচ্চ সীমা। */
  amount: number;
  currency: string;
  gateway: string;
}

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: RefundTarget | null;
  onSuccess: () => void;
}

export function RefundDialog({ open, onOpenChange, target, onSuccess }: RefundDialogProps) {
  const { t } = useTranslation("admin");

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Dialog খোলার সময় full amount ডিফল্ট হিসেবে বসানো হয়
  useEffect(() => {
    if (open && target) {
      setAmount(String(target.amount));
      setReason("");
    }
  }, [open, target]);

  if (!target) return null;

  const parsedAmount = Number(amount);
  const amountValid =
    Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= target.amount;
  const isPartial = amountValid && parsedAmount < target.amount;
  const canSubmit = amountValid && reason.trim().length >= 3 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refund",
          transactionId: target.transactionId,
          amount: isPartial ? parsedAmount : undefined,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("billing.issues.refund.error"));

      toast.success(t("billing.issues.refund.successManual"));
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("billing.issues.refund.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl border border-primary/15 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
              <Undo2 className="h-4 w-4" />
            </span>
            {t("billing.issues.refund.title")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("billing.issues.refund.description", {
              name: target.merchantName,
              invoice: target.invoiceNumber ?? target.transactionId.slice(-8),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ── Record-only warning — সব gateway-এ একই, কারণ কোনো API call হয় না ── */}
          <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-xs leading-relaxed text-foreground">
              {t("billing.issues.refund.manualNote", { gateway: target.gateway })}
            </p>
          </div>

          {/* ── Amount (partial refund supported) ── */}
          <div className="space-y-1.5">
            <Label htmlFor="refund-amount" className="text-xs font-medium">
              {t("billing.issues.refund.amountLabel")}
            </Label>
            <Input
              id="refund-amount"
              type="number"
              min={0.01}
              max={target.amount}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-xl"
            />
            <p className="text-[10px] text-muted-foreground">
              {t("billing.issues.refund.amountHint", {
                max: `${target.currency.toUpperCase()} ${target.amount.toLocaleString()}`,
              })}
            </p>
          </div>

          {/* ── Reason (audit) ── */}
          <div className="space-y-1.5">
            <Label htmlFor="refund-reason" className="text-xs font-medium">
              {t("billing.issues.refund.reasonLabel")}
            </Label>
            <Textarea
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("billing.issues.refund.reasonPlaceholder")}
              className="rounded-xl min-h-[80px] resize-none"
            />
            <p className="text-[10px] text-muted-foreground">
              {t("billing.issues.refund.reasonHint")}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            {t("billing.issues.refund.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            variant="destructive"
            className="rounded-xl"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("billing.issues.refund.submitting")}
              </>
            ) : (
              t("billing.issues.refund.submit")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
