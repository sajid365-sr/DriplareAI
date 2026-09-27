"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Undo2 } from "lucide-react";

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
 * Merchant-side Refund Request Dialog
 * ─────────────────────────────────────────────────────────────────────────────
 * Merchant এখান থেকে refund **চাইতে** পারেন — টাকা ফেরত এখান থেকে যায় না।
 * অনুরোধটি `RefundRequest`-এ জমা হয় এবং `/admin/billing`-এর "Payment Issues"
 * queue-তে admin-এর কাছে পৌঁছায় (in-app notification সহ)।
 *
 * কেন এক click-এ refund নয়: refund একটি আর্থিক সিদ্ধান্ত। Admin যাচাই করে
 * অনুমোদন দিলে নিজে টাকা ফেরত পাঠিয়ে system-এ record করেন (এখন সব gateway-এ
 * এই manual পথটিই একমাত্র)।
 */

interface RefundRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string | null;
  /** সম্পূর্ণ paid amount — merchant এর বেশি চাইতে পারবেন না। */
  amount: number;
  currency: string;
  /** Admin queue-তে গেলে merchant-এর list refresh করার জন্য। */
  onSuccess?: () => void;
}

export function RefundRequestDialog({
  open,
  onOpenChange,
  transactionId,
  amount,
  currency,
  onSuccess,
}: RefundRequestDialogProps) {
  const { t } = useTranslation("payment");

  const [reason, setReason] = useState("");
  const [amountRequested, setAmountRequested] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const parsedAmount = amountRequested ? Number(amountRequested) : null;
  const amountValid =
    parsedAmount === null ||
    (Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= amount);
  const canSubmit = reason.trim().length >= 10 && amountValid && !submitting && !!transactionId;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setReason("");
      setAmountRequested("");
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !transactionId) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/payments/refund-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId,
          reason: reason.trim(),
          ...(parsedAmount !== null ? { amountRequested: parsedAmount } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // 409 = ইতিমধ্যে অনুরোধ আছে বা এই payment refund-যোগ্য নয়
        if (data.code === "ALREADY_REQUESTED") {
          toast.error(t("refund.alreadyRequested"));
          handleOpenChange(false);
          return;
        }
        throw new Error(data.error || t("refund.error"));
      }

      toast.success(t("refund.success"));
      handleOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("refund.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-warning/15 text-warning">
              <Undo2 className="h-4 w-4" />
            </span>
            {t("refund.requestTitle")}
          </DialogTitle>
          <DialogDescription>{t("refund.requestDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ── Amount (ঐচ্ছিক — খালি রাখলে সম্পূর্ণ refund) ── */}
          <div className="space-y-1.5">
            <Label htmlFor="refund-request-amount" className="text-xs font-medium">
              {t("refund.amountLabel")}
            </Label>
            <Input
              id="refund-request-amount"
              type="number"
              min={0.01}
              max={amount}
              step="0.01"
              value={amountRequested}
              onChange={(e) => setAmountRequested(e.target.value)}
              placeholder={String(amount)}
              className="rounded-xl"
            />
            <p className="text-[10px] text-muted-foreground">
              {t("refund.amountHint")} — {currency.toUpperCase()} {amount.toLocaleString()}
            </p>
          </div>

          {/* ── Reason (অবশ্যই, ন্যূনতম ১০ অক্ষর — API-ও যাচাই করে) ── */}
          <div className="space-y-1.5">
            <Label htmlFor="refund-request-reason" className="text-xs font-medium">
              {t("refund.reasonLabel")}
            </Label>
            <Textarea
              id="refund-request-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("refund.reasonPlaceholder")}
              className="min-h-[90px] resize-none rounded-xl"
            />
            {reason.length > 0 && reason.trim().length < 10 && (
              <p className="text-[10px] text-destructive">{t("refund.reasonTooShort")}</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} className="rounded-xl">
            {t("refund.cancel", "Cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="rounded-xl gap-2">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("refund.submitting")}
              </>
            ) : (
              t("refund.submit")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
