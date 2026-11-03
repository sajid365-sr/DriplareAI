"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { TestTube2, Radio, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface PracticeModeToggleProps {
  chatbotId: string;
  initialMode?: string;
  onModeChange?: (mode: "live" | "practice") => void;
}

export function PracticeModeToggle({
  chatbotId,
  initialMode = "live",
  onModeChange,
}: PracticeModeToggleProps) {
  const { t } = useTranslation("chatbots");
  const [mode, setMode] = useState<"live" | "practice">(
    initialMode === "practice" ? "practice" : "live"
  );
  const [loading, setLoading] = useState(false);

  const isPractice = mode === "practice";

  const handleToggle = async () => {
    const nextMode = isPractice ? "live" : "practice";
    setLoading(true);

    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: nextMode }),
      });

      if (!res.ok) {
        throw new Error("Failed to update mode");
      }

      const data = await res.json();
      const updatedMode = data.agentMode as "live" | "practice";
      setMode(updatedMode);
      onModeChange?.(updatedMode);

      if (updatedMode === "live") {
        toast.success(
          t("practiceMode.toastLive", "AI is now LIVE! Responding to real customers.")
        );
      } else {
        toast.info(
          t(
            "practiceMode.toastPractice",
            "AI switched to Practice Mode. Real customers will not be answered."
          )
        );
      }
    } catch {
      toast.error(
        t("practiceMode.toastError", "Failed to update agent mode")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-300 p-4 sm:p-5 relative overflow-hidden ${
        isPractice
          ? "border-amber-500/30 bg-amber-500/[0.04] dark:bg-amber-500/[0.06]"
          : "border-border/80 bg-card/60 backdrop-blur-sm"
      }`}
    >
      {/* Background ambient glow */}
      <div
        className={`absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl pointer-events-none transition-all duration-500 ${
          isPractice ? "bg-amber-500/15" : "bg-primary/10"
        }`}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        {/* Left Status Info */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
              isPractice
                ? "bg-amber-500/15 border-amber-500/30 text-amber-500"
                : "bg-emerald-500/15 border-emerald-500/30 text-emerald-500"
            }`}
          >
            {isPractice ? (
              <TestTube2 className="w-5 h-5 animate-pulse" />
            ) : (
              <Radio className="w-5 h-5" />
            )}
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">
                {isPractice
                  ? t("practiceMode.practiceTitle", "Practice Mode Active")
                  : t("practiceMode.liveTitle", "Live Mode Active")}
              </h3>

              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
                  isPractice
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isPractice ? "bg-amber-500 animate-ping" : "bg-emerald-500"
                  }`}
                />
                {isPractice
                  ? t("practiceMode.practiceBadge", "PRACTICE")
                  : t("practiceMode.liveBadge", "LIVE")}
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
              {t(
                "practiceMode.description",
                "In Practice Mode, the AI agent only answers test messages in the Playground. Real customer messages on Facebook, WhatsApp, etc. will not trigger AI replies or consume credits."
              )}
            </p>
          </div>
        </div>

        {/* Right Toggle Action Button */}
        <div className="shrink-0 flex items-center self-end sm:self-center">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading}
            onClick={handleToggle}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              isPractice
                ? "bg-brand-gradient hover:opacity-95 text-white shadow-primary/25"
                : "bg-muted/80 hover:bg-muted text-foreground border border-border/80"
            }`}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isPractice ? (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t("practiceMode.switchToLive", "Go Live")}</span>
              </>
            ) : (
              <>
                <TestTube2 className="w-3.5 h-3.5" />
                <span>{t("practiceMode.switchToPractice", "Switch to Practice")}</span>
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
