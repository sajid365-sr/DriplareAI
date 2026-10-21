"use client";

import { useTranslation } from "react-i18next";
import { Clock, MessageSquare, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FollowUpDelayPickerProps {
  enableFollowUp: boolean;
  onToggleEnable: (enabled: boolean) => void;
  delayMinutes: number;
  onChangeDelay: (minutes: number) => void;
  followUpText: string;
  onChangeText: (text: string) => void;
}

const DELAY_PRESETS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "4 hours", value: 240 },
];

export function FollowUpDelayPicker({
  enableFollowUp,
  onToggleEnable,
  delayMinutes,
  onChangeDelay,
  followUpText,
  onChangeText,
}: FollowUpDelayPickerProps) {
  const { t } = useTranslation("automations");

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
      {/* Enable Toggle Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-violet-500" />
            <span>{t("commentAutomation.followUp.title", "Comment Re-engagement Follow-up")}</span>
          </label>
          <p className="text-[11px] text-muted-foreground">
            {t("commentAutomation.followUp.enable", "Send follow-up DM if commenter doesn't reply in inbox")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onToggleEnable(!enableFollowUp)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            enableFollowUp ? "bg-violet-600" : "bg-muted"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              enableFollowUp ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <AnimatePresence>
        {enableFollowUp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3 border-t border-border/60 pt-3"
          >
            {/* Delay presets */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                {t("commentAutomation.followUp.delayLabel", "Follow-up Delay Window")}
              </label>
              <div className="flex flex-wrap gap-2">
                {DELAY_PRESETS.map((preset) => {
                  const isSelected = delayMinutes === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => onChangeDelay(preset.value)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                        isSelected
                          ? "border-violet-600 bg-violet-600 text-white shadow-xs"
                          : "border-border/70 bg-background text-foreground hover:bg-muted/40"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Follow-up message textarea */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                <span>{t("commentAutomation.followUp.messageLabel", "Follow-up DM Message")}</span>
              </label>
              <textarea
                rows={2}
                value={followUpText}
                onChange={(e) => onChangeText(e.target.value)}
                placeholder={t(
                  "commentAutomation.followUp.messagePlaceholder",
                  "e.g. Hello again! Did you have any more questions about this product? We have limited stock remaining."
                )}
                className="w-full rounded-xl border border-border/80 bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-violet-600 focus:outline-none focus:ring-1 focus:ring-violet-500/20 resize-none"
              />
              <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                Only sent if customer does not reply to the initial auto-DM within the delay window.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

