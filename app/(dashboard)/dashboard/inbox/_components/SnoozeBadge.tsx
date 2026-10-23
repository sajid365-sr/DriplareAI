"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";
import { useTranslation } from "react-i18next";

interface SnoozeBadgeProps {
  snoozeUntil: string | null | undefined;
  className?: string;
  showIcon?: boolean;
}

export const SnoozeBadge = ({ snoozeUntil, className = "", showIcon = true }: SnoozeBadgeProps) => {
  const { i18n, t } = useTranslation("live-inbox");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  if (!snoozeUntil) return null;

  const target = new Date(snoozeUntil);
  if (!Number.isFinite(target.getTime())) return null;
  const timeLabel = target.getTime() <= now
    ? t("snoozeModal.dueNow")
    : formatDistanceToNow(target, { addSuffix: true, locale: i18n.language.startsWith("bn") ? bn : undefined });

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-foreground border border-border ${className}`}
      title={t("conversation.snoozedUntil", { time: target.toLocaleString(i18n.language) })}
    >
      {showIcon && <Clock className="w-2.5 h-2.5 shrink-0" />}
      <span>{timeLabel}</span>
    </span>
  );
};

