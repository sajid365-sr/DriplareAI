"use client";

import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ChangeRequest {
  status: string;
}

interface ChangeRequestBadgeProps {
  changeRequests: unknown[] | null | undefined;
}

/** Badge indicating pending post-confirm change requests from the customer. */
export function ChangeRequestBadge({ changeRequests }: ChangeRequestBadgeProps) {
  const { t } = useTranslation("orders");

  if (!Array.isArray(changeRequests) || changeRequests.length === 0) return null;

  const pendingCount = (changeRequests as ChangeRequest[]).filter(
    (cr) => cr.status === "pending"
  ).length;

  if (pendingCount === 0) return null;

  return (
    <div
      title={t("changeRequest.badgeTooltip", "Customer has requested a change after order confirmation")}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 mt-0.5"
    >
      <AlertCircle className="w-2.5 h-2.5" />
      {t("changeRequest.badge", "Change Request")}
      {pendingCount > 1 && <span className="opacity-70">(×{pendingCount})</span>}
    </div>
  );
}
