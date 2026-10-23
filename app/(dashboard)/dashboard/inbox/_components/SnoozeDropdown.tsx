"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Calendar, X } from "lucide-react";
type ReminderUnit = "minutes" | "hours" | "days";

interface SnoozeDropdownProps {
  onSnooze: (until: string) => Promise<void>;
  currentSnoozeUntil?: string | null;
  onUnsnooze?: () => Promise<void>;
  triggerClassName?: string;
  triggerLabel?: string;
}

export const SnoozeDropdown = ({
  onSnooze,
  currentSnoozeUntil,
  onUnsnooze,
  triggerClassName,
  triggerLabel,
}: SnoozeDropdownProps) => {
  const { t } = useTranslation("live-inbox");
  const [isOpen, setIsOpen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"duration" | "dateTime">("duration");
  const [customDuration, setCustomDuration] = useState("2");
  const [customUnit, setCustomUnit] = useState<ReminderUnit>("hours");
  const [customDateTime, setCustomDateTime] = useState("");
  const [minDateTime, setMinDateTime] = useState("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const closeDropdown = () => {
    setIsOpen(false);
    setPopupPosition(null);
  };
  const getCurrentLocalDateTime = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  };

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target) &&
        !popupRef.current?.contains(event.target)
      ) {
        closeDropdown();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDropdown();
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const triggerBounds = trigger.getBoundingClientRect();
      const panelBounds = rootRef.current?.closest("[data-conversation-panel]")?.getBoundingClientRect();
      const boundaryLeft = panelBounds?.left ?? 8;
      const boundaryRight = panelBounds?.right ?? window.innerWidth - 8;
      const boundaryTop = panelBounds?.top ?? 8;
      const boundaryBottom = panelBounds?.bottom ?? window.innerHeight - 8;
      const width = Math.max(240, Math.min(340, boundaryRight - boundaryLeft - 16));
      const left = Math.max(
        boundaryLeft + 8,
        Math.min(triggerBounds.right - width, boundaryRight - width - 8)
      );
      const estimatedHeight = Math.min(390, boundaryBottom - boundaryTop - 16);
      const top = triggerBounds.bottom + 8 + estimatedHeight <= boundaryBottom
        ? triggerBounds.bottom + 8
        : Math.max(boundaryTop + 8, triggerBounds.top - estimatedHeight - 8);

      setPopupPosition({ top, left, width });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  const handleApplyCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(customDuration);
    if (!Number.isInteger(amount) || amount < 1) return;

    const targetDate = new Date();
    if (customUnit === "minutes") targetDate.setMinutes(targetDate.getMinutes() + amount);
    if (customUnit === "hours") targetDate.setHours(targetDate.getHours() + amount);
    if (customUnit === "days") targetDate.setDate(targetDate.getDate() + amount);
    if (targetDate.getTime() <= Date.now() || targetDate.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) return;
    try {
      setSubmitting(true);
      await onSnooze(targetDate.toISOString());
      closeDropdown();
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyDateTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDateTime) return;
    const targetDate = new Date(customDateTime);
    if (!Number.isFinite(targetDate.getTime()) || targetDate.getTime() <= Date.now()) return;
    try {
      setSubmitting(true);
      await onSnooze(targetDate.toISOString());
      closeDropdown();
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnsnoozeClick = async () => {
    if (!onUnsnooze) return;
    try {
      setSubmitting(true);
      await onUnsnooze();
      closeDropdown();
    } finally {
      setSubmitting(false);
    }
  };

  const maxCustomDuration = customUnit === "days" ? 30 : customUnit === "hours" ? 720 : 43200;
  const isCustomDurationValid = Number.isInteger(Number(customDuration))
    && Number(customDuration) >= 1
    && Number(customDuration) <= maxCustomDuration;

  return (
    <>
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        disabled={submitting}
        title={currentSnoozeUntil
          ? t("conversation.snoozedUntil", { time: new Date(currentSnoozeUntil).toLocaleString() })
          : t("snoozeModal.openButton")}
        className={triggerClassName ?? `inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:text-[12px] ${
          currentSnoozeUntil
            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
            : "border-border bg-background text-foreground hover:bg-muted"
        }`}
      >
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span>{triggerLabel ?? t("snoozeModal.openButton")}</span>
      </button>

    </div>
    {isOpen && popupPosition && typeof document !== "undefined" && createPortal(
      <AnimatePresence>
        <motion.div
          ref={popupRef}
          style={{
            top: popupPosition.top,
            left: popupPosition.left,
            width: popupPosition.width,
            maxHeight: "calc(100vh - 16px)",
          }}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          role="dialog"
          aria-label={t("snoozeModal.title")}
          className="fixed z-[100] overflow-x-hidden overflow-y-auto rounded-xl border border-border/80 bg-card shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div>
                <h3 className="text-[12.5px] font-bold text-foreground">
                  {t("snoozeModal.title")}
                </h3>
                <p className="text-[10.5px] text-muted-foreground">
                  {currentSnoozeUntil
                    ? t("conversation.snoozedUntil", { time: new Date(currentSnoozeUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }) })
                    : t("snoozeModal.quickOptions")}
                </p>
              </div>
            </div>
            <button
              onClick={closeDropdown}
              disabled={submitting}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-2.5 p-3">
            <p className="text-[11px] leading-snug text-muted-foreground">
              {t("snoozeModal.description")}
            </p>

            <div className="space-y-1.5">
              <button
                type="button"
                aria-pressed={scheduleMode === "duration"}
                onClick={() => setScheduleMode("duration")}
                className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] transition-colors ${scheduleMode === "duration" ? "border-primary/40 bg-primary/5 text-primary" : "border-border/60 text-foreground hover:bg-muted/50"}`}
              >
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>{t("snoozeModal.durationOption", "After a duration")}</span>
              </button>
              <button
                type="button"
                aria-pressed={scheduleMode === "dateTime"}
                onClick={() => {
                  setMinDateTime(getCurrentLocalDateTime());
                  setScheduleMode("dateTime");
                }}
                className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] transition-colors ${scheduleMode === "dateTime" ? "border-primary/40 bg-primary/5 text-primary" : "border-border/60 text-foreground hover:bg-muted/50"}`}
              >
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>{t("snoozeModal.dateTimeOption", "Choose date and time")}</span>
              </button>
            </div>

            {scheduleMode === "duration" ? (
              <form onSubmit={handleApplyCustom} className="flex items-center gap-1.5 border-t border-border/50 pt-2">
                <input
                  type="number"
                  min={1}
                  max={maxCustomDuration}
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  disabled={submitting}
                  aria-label={t("snoozeModal.customDuration", "Duration")}
                  className="w-16 rounded-lg border border-border/60 bg-muted/40 px-2 py-1.5 text-[11px] text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  required
                />
                <select
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value as ReminderUnit)}
                  disabled={submitting}
                  aria-label={t("snoozeModal.customDuration", "Duration unit")}
                  className="min-w-0 flex-1 rounded-lg border border-border/60 bg-muted/40 px-2 py-1.5 text-[11px] text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                >
                  <option value="minutes">{t("snoozeModal.minutes", "minutes")}</option>
                  <option value="hours">{t("snoozeModal.hours", "hours")}</option>
                  <option value="days">{t("snoozeModal.days", "days")}</option>
                </select>
                <button
                  type="submit"
                  disabled={submitting || !isCustomDurationValid}
                  className="shrink-0 rounded-lg bg-primary px-2.5 py-1.5 text-[10.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
                >
                  {t("snoozeModal.snoozeBtn")}
                </button>
              </form>
            ) : (
              <form onSubmit={handleApplyDateTime} className="flex items-center gap-1.5 border-t border-border/50 pt-2">
                <input
                  type="datetime-local"
                  min={minDateTime}
                  value={customDateTime}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                  disabled={submitting}
                  aria-label={t("snoozeModal.dateTimeOption", "Choose date and time")}
                  className="min-w-0 flex-1 rounded-lg border border-border/60 bg-muted/40 px-2 py-1.5 text-[10.5px] text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  required
                />
                <button
                  type="submit"
                  disabled={submitting || !customDateTime}
                  className="shrink-0 rounded-lg bg-primary px-2.5 py-1.5 text-[10.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
                >
                  {t("snoozeModal.snoozeBtn")}
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-3.5 py-2.5">
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
              onClick={closeDropdown}
              disabled={submitting}
              className="px-3.5 py-1.5 rounded-lg border border-border/60 text-[12px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              {t("snoozeModal.cancelBtn")}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    , document.body)}
    </>
  );
};

