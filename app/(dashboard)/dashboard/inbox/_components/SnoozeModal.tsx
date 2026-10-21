"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Calendar, X, Sparkles, Sun, Sunrise, CalendarDays } from "lucide-react";

interface SnoozeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSnooze: (until: string) => Promise<void>;
  currentSnoozeUntil?: string | null;
  onUnsnooze?: () => Promise<void>;
}

export const SnoozeModal = ({
  isOpen,
  onClose,
  onSnooze,
  currentSnoozeUntil,
  onUnsnooze,
}: SnoozeModalProps) => {
  const { t } = useTranslation("live-inbox");
  const [customDateTime, setCustomDateTime] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const getPresetTime = (preset: "later_today" | "tomorrow" | "weekend" | "next_week"): Date => {
    const now = new Date();
    switch (preset) {
      case "later_today": {
        const d = new Date(now);
        d.setHours(d.getHours() + 3);
        return d;
      }
      case "tomorrow": {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d;
      }
      case "weekend": {
        const d = new Date(now);
        const day = d.getDay();
        // Saturday is day 6
        const diff = (6 - day + 7) % 7 || 7;
        d.setDate(d.getDate() + diff);
        d.setHours(10, 0, 0, 0);
        return d;
      }
      case "next_week": {
        const d = new Date(now);
        const day = d.getDay();
        // Monday is day 1
        const diff = (8 - day) % 7 || 7;
        d.setDate(d.getDate() + diff);
        d.setHours(9, 0, 0, 0);
        return d;
      }
    }
  };

  const handleApplyPreset = async (preset: "later_today" | "tomorrow" | "weekend" | "next_week") => {
    try {
      setSubmitting(true);
      const targetDate = getPresetTime(preset);
      await onSnooze(targetDate.toISOString());
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDateTime) return;
    try {
      setSubmitting(true);
      const targetDate = new Date(customDateTime);
      await onSnooze(targetDate.toISOString());
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnsnoozeClick = async () => {
    if (!onUnsnooze) return;
    try {
      setSubmitting(true);
      await onUnsnooze();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-foreground">
                  {t("snoozeModal.title")}
                </h3>
                <p className="text-[11.5px] text-muted-foreground">
                  {currentSnoozeUntil
                    ? t("conversation.snoozedUntil", { time: new Date(currentSnoozeUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }) })
                    : t("snoozeModal.quickOptions")}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              {t("snoozeModal.description")}
            </p>

            {/* Quick Presets */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleApplyPreset("later_today")}
                disabled={submitting}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/50 hover:border-border text-left transition-all group"
              >
                <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                  <Sun className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-foreground group-hover:text-primary transition-colors">
                    {t("snoozeModal.laterToday")}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset("tomorrow")}
                disabled={submitting}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/50 hover:border-border text-left transition-all group"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                  <Sunrise className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-foreground group-hover:text-primary transition-colors">
                    {t("snoozeModal.tomorrowMorning")}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset("weekend")}
                disabled={submitting}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/50 hover:border-border text-left transition-all group"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <CalendarDays className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-foreground group-hover:text-primary transition-colors">
                    {t("snoozeModal.thisWeekend")}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset("next_week")}
                disabled={submitting}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/50 hover:border-border text-left transition-all group"
              >
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-foreground group-hover:text-primary transition-colors">
                    {t("snoozeModal.nextWeek")}
                  </p>
                </div>
              </button>
            </div>

            {/* Custom Date Time */}
            <form onSubmit={handleApplyCustom} className="space-y-2 pt-2 border-t border-border/50">
              <label className="text-[11.5px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {t("snoozeModal.customDateTime")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={customDateTime}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                  disabled={submitting}
                  className="flex-1 px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-[12.5px] text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  required
                />
                <button
                  type="submit"
                  disabled={submitting || !customDateTime}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold hover:opacity-95 disabled:opacity-50 transition-opacity"
                >
                  {t("snoozeModal.snoozeBtn")}
                </button>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-border/60 bg-muted/20">
            {currentSnoozeUntil && onUnsnooze ? (
              <button
                type="button"
                onClick={handleUnsnoozeClick}
                disabled={submitting}
                className="text-[12px] font-semibold text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50"
              >
                {t("conversation.unsnooze")}
              </button>
            ) : (
              <div />
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-1.5 rounded-lg border border-border/60 text-[12px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              {t("snoozeModal.cancelBtn")}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

