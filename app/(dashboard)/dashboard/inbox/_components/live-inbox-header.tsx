"use client";

import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";

interface LiveInboxHeaderProps {
  mobileView?: "list" | "chat" | "crm";
  onMobileBack?: () => void;
}

export function LiveInboxHeader({ mobileView, onMobileBack }: LiveInboxHeaderProps) {
  const { t } = useTranslation("live-inbox");
  const showBack = mobileView && mobileView !== "list";

  if (!showBack) return null;

  return (
    <header className="relative z-30 flex h-11 w-full shrink-0 items-center border-b border-border/50 bg-card/80 px-3 backdrop-blur-md md:hidden">
      <button
        type="button"
        onClick={onMobileBack}
        className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-primary"
      >
        <ChevronLeft className="h-4 w-4" />
        {t("header.back", "Back to inbox")}
      </button>
    </header>
  );
}
