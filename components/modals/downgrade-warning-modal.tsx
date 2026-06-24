"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  X,
  Bot,
  Plug,
  MessageSquare,
  Calendar,
  ShieldCheck,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface DowngradePreviewData {
  currentPlan: string;
  targetPlan: string;
  effectiveDate: string; // ISO string
  chatbots: { current: number; newLimit: number; toBePaused: number };
  integrations: { current: number; newLimit: number; toBePaused: number };
  messages: { current: number; newLimit: number };
}

interface DowngradeWarningModalProps {
  isOpen: boolean;
  preview: DowngradePreviewData | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CANCEL_REASONS = [
  "tooExpensive",
  "notUsing",
  "switching",
  "temporary",
  "other",
] as const;

// ─────────────────────────────────────────────
// Impact Row Component
// ─────────────────────────────────────────────

interface ImpactRowProps {
  icon: React.ReactNode;
  label: string;
  current: number | string;
  newLimit: number | string;
  toBePaused?: number;
  isInfinity?: boolean;
}

function ImpactRow({
  icon,
  label,
  current,
  newLimit,
  toBePaused = 0,
  isInfinity,
}: ImpactRowProps) {
  const { t } = useTranslation("payment");

  const formatNum = (n: number | string) => {
    if (isInfinity || n === Infinity) return "∞";
    return typeof n === "number" ? n.toLocaleString() : n;
  };

  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/50">
      {/* Icon */}
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
          <span className="font-mono">{formatNum(current)}</span>
          <ChevronRight className="w-3 h-3" />
          <span className="font-mono font-semibold text-foreground">
            {formatNum(newLimit)}
          </span>
        </div>
      </div>

      {/* Paused badge */}
      {toBePaused > 0 ? (
        <div className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
          <span className="text-xs font-bold">
            {toBePaused} {t("downgradeModal.toBePaused")}
          </span>
        </div>
      ) : (
        <div className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
          <span className="text-xs font-medium">
            {t("downgradeModal.noChange")}
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────

export default function DowngradeWarningModal({
  isOpen,
  preview,
  onClose,
  onSuccess,
}: DowngradeWarningModalProps) {
  const { t, i18n } = useTranslation("payment");
  const isBn = i18n.language === "bn";

  const [selectedReason, setSelectedReason] = useState<string>("");
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    if (!preview) return;
    setIsConfirming(true);

    try {
      const res = await fetch("/api/payments/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule_downgrade",
          plan: preview.targetPlan,
          cancelReason: selectedReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      const effectiveDate = new Date(preview.effectiveDate).toLocaleDateString(
        isBn ? "bn-BD" : "en-US",
        { year: "numeric", month: "long", day: "numeric" }
      );

      toast.success(
        t("downgradeModal.successMsg", { date: effectiveDate })
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("downgradeModal.errorMsg");
      toast.error(msg);
    } finally {
      setIsConfirming(false);
    }
  };

  const formattedDate = preview
    ? new Date(preview.effectiveDate).toLocaleDateString(
        isBn ? "bn-BD" : "en-US",
        { year: "numeric", month: "long", day: "numeric" }
      )
    : "";

  return (
    <AnimatePresence>
      {isOpen && preview && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.93, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 20 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl shadow-black/30 overflow-hidden pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Gradient accent top bar */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />

              {/* Header */}
              <div className="flex items-start justify-between p-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {t("downgradeModal.title")}
                    </h2>
                    <p
                      className="text-xs text-muted-foreground mt-0.5"
                      dangerouslySetInnerHTML={{
                        __html: t("downgradeModal.subtitle", {
                          from: preview.currentPlan.toUpperCase(),
                          to: preview.targetPlan.toUpperCase(),
                        }),
                      }}
                    />
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="px-6 pb-6 space-y-4 max-h-[65vh] overflow-y-auto">

                {/* Impact Section */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">
                    {t("downgradeModal.impactTitle")}
                  </p>
                  <div className="space-y-2">
                    <ImpactRow
                      icon={<Bot className="w-4 h-4" />}
                      label={t("downgradeModal.chatbots")}
                      current={preview.chatbots.current}
                      newLimit={preview.chatbots.newLimit}
                      toBePaused={preview.chatbots.toBePaused}
                    />
                    <ImpactRow
                      icon={<Plug className="w-4 h-4" />}
                      label={t("downgradeModal.integrations")}
                      current={preview.integrations.current}
                      newLimit={preview.integrations.newLimit}
                      toBePaused={preview.integrations.toBePaused}
                    />
                    <ImpactRow
                      icon={<MessageSquare className="w-4 h-4" />}
                      label={t("downgradeModal.messages")}
                      current={preview.messages.current}
                      newLimit={preview.messages.newLimit}
                    />
                  </div>
                </div>

                {/* Effective Date */}
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/50">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t("downgradeModal.effectiveDate")}:{" "}
                      <span className="text-primary font-bold">
                        {formattedDate}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("downgradeModal.effectiveDateDesc")}
                    </p>
                  </div>
                </div>

                {/* Reassurance note */}
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    {t("downgradeModal.pauseNote")}
                  </p>
                </div>

                {/* Cancellation Survey */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2.5">
                    {t("downgradeModal.surveyTitle")}
                  </p>
                  <div className="space-y-2">
                    {CANCEL_REASONS.map((reason) => (
                      <label
                        key={reason}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          selectedReason === reason
                            ? "border-primary bg-primary/8"
                            : "border-border/50 bg-muted/20 hover:border-border hover:bg-muted/40"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            selectedReason === reason
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {selectedReason === reason && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <input
                          type="radio"
                          name="cancel_reason"
                          value={reason}
                          checked={selectedReason === reason}
                          onChange={() => setSelectedReason(reason)}
                          className="sr-only"
                        />
                        <span className="text-sm text-foreground">
                          {t(`downgradeModal.reasons.${reason}`)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex gap-3 px-6 py-4 border-t border-border bg-muted/20">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={onClose}
                  disabled={isConfirming}
                >
                  {t("downgradeModal.cancelBtn")}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 rounded-xl bg-red-500/90 hover:bg-red-600"
                  onClick={handleConfirm}
                  disabled={isConfirming}
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {t("downgradeModal.confirming")}
                    </>
                  ) : (
                    t("downgradeModal.confirmBtn")
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
