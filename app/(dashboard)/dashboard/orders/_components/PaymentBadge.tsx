"use client";

import { CheckCircle2, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PaymentBadgeProps {
  method: string;
  paymentStatus: string;
  codCollected?: boolean;
  codCollectedAt?: string | null;
}

/**
 * Displays payment method, paid/pending status,
 * and COD collection status (Feature #26).
 */
export function PaymentBadge({
  method,
  paymentStatus,
  codCollected,
  codCollectedAt,
}: PaymentBadgeProps) {
  const { t } = useTranslation("orders");
  const isPaid = paymentStatus === "paid";
  const isCOD = method.toUpperCase() === "COD" || method.toLowerCase().includes("cash on delivery");

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-foreground">{method}</span>
      <span
        className={`text-[10px] font-bold ${isPaid ? "text-emerald-500" : "text-amber-500"}`}
      >
        {isPaid ? "✓ Paid" : "Pending"}
      </span>
      {isCOD && (
        <span
          title={
            codCollected && codCollectedAt
              ? `Collected on ${new Date(codCollectedAt).toLocaleDateString()}`
              : t("cod.notCollected", "Cash not yet collected")
          }
          className={`inline-flex items-center gap-0.5 text-[9px] font-semibold mt-0.5 ${
            codCollected
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-muted-foreground"
          }`}
        >
          {codCollected ? (
            <CheckCircle2 className="w-2.5 h-2.5" />
          ) : (
            <Clock className="w-2.5 h-2.5" />
          )}
          {codCollected
            ? t("cod.collected", "COD Collected")
            : t("cod.pending", "COD Pending")}
        </span>
      )}
    </div>
  );
}
