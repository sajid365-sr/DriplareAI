"use client";

import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface CompareInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  loadingMessages: boolean;
}

export const CompareInput = ({ value, onChange, onSubmit, busy, loadingMessages }: CompareInputProps) => {
  const { t } = useTranslation("chatbots");

  return (
    <div className="space-y-3 pt-2">
      <div className="flex gap-2">
        <input
          className="flex-1 h-12 px-4 rounded-xl border border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-background shadow-inner text-sm placeholder:text-muted-foreground/80 transition-all"
          placeholder={t("compare.input_placeholder", "Type your message to compare both models…")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && onSubmit()}
          disabled={busy || loadingMessages}
          data-testid="compare-input"
        />
        <Button
          onClick={onSubmit}
          disabled={busy || !value.trim() || loadingMessages}
          className="rounded-xl px-5 h-12 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/95 hover:to-violet-600/95 text-white shadow-md transition-all hover:scale-[1.02] flex items-center gap-1.5 font-medium shrink-0"
          data-testid="compare-run"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {t("compare.btn_compare", "Compare")}
        </Button>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground/80 px-1">
        <span>{t("compare.quota_note", "Each comparison uses 2 AI messages from your quota")}</span>
      </div>
    </div>
  );
};
