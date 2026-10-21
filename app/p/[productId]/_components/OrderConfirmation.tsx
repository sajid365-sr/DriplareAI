"use client";

import { CheckCircle2, MessageSquare, ShoppingBag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

interface OrderConfirmationProps {
  orderId: string;
  productName: string;
  totalAmount: number;
  sessionId?: string;
  onReset: () => void;
}

export function OrderConfirmation({
  orderId,
  productName,
  totalAmount,
  sessionId,
  onReset,
}: OrderConfirmationProps) {
  const { t } = useTranslation("product-page");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 rounded-2xl border border-border/80 bg-card p-6 sm:p-8 text-center shadow-lg"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 ring-8 ring-emerald-500/5">
        <CheckCircle2 className="h-9 w-9 stroke-[2]" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {t("orderSuccessTitle")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("orderSuccessSubtitle")}
        </p>
      </div>

      {/* Order Badge */}
      <div className="mx-auto max-w-xs rounded-xl border border-border/80 bg-background/60 p-4 space-y-1">
        <div className="text-xs font-medium text-muted-foreground">{t("orderId")}</div>
        <div className="font-mono text-lg font-bold text-violet-600 dark:text-violet-400">
          {orderId}
        </div>
        <div className="text-xs text-muted-foreground pt-1">
          {productName} • <span className="font-bold text-foreground">৳{totalAmount.toLocaleString()}</span>
        </div>
      </div>

      {sessionId && (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-violet-500/10 px-4 py-3 text-xs font-medium text-violet-600 dark:text-violet-400">
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span>{t("sentToChat")}</span>
        </div>
      )}

      {/* Actions */}
      <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
        {sessionId ? (
          <button
            type="button"
            onClick={() => window.close()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-500/20 transition-all hover:opacity-95"
          >
            <MessageSquare className="h-4 w-4" />
            {t("backToChat")}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-card px-5 py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-muted/50"
        >
          <ShoppingBag className="h-4 w-4" />
          {t("placeAnother")}
        </button>
      </div>
    </motion.div>
  );
}
