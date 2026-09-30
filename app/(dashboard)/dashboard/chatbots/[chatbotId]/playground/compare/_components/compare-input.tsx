"use client";

import { Loader2, Send, Zap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface CompareInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  loadingMessages: boolean;
  /** মডেল-তালিকা এখনো লোড হচ্ছে — তখন খরচের সংখ্যাটা fallback থেকে আসত */
  loadingModels: boolean;
  /** এই তুলনায় কত credit লাগবে — সার্ভারের হিসাবের সঙ্গে একই সূত্রে */
  costCredits: number;
  /** কতটা মডেল চলছে (২–৪) — লেখার সংখ্যাটা এর উপর নির্ভর করে */
  modelCount: number;
  /** একই মডেল দুই কলামে — তুলনা হয় না, শুধু credit খরচ হয় */
  duplicateSelection?: boolean;
}

export const CompareInput = ({
  value,
  onChange,
  onSubmit,
  busy,
  loadingMessages,
  loadingModels,
  costCredits,
  modelCount,
  duplicateSelection = false,
}: CompareInputProps) => {
  const { t } = useTranslation("chatbots");

  return (
    <div className="space-y-3 pt-2">
      <div className="flex gap-2">
        <input
          className="flex-1 h-12 px-4 rounded-xl border border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-background shadow-inner text-sm placeholder:text-muted-foreground/80 transition-all"
          placeholder={t("compare.input_placeholder", {
            count: modelCount,
            defaultValue: "Type one message — all {{count}} models answer it…",
          })}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && !duplicateSelection && onSubmit()}
          disabled={busy || loadingMessages}
          data-testid="compare-input"
        />
        <Button
          onClick={onSubmit}
          disabled={busy || !value.trim() || loadingMessages || duplicateSelection}
          className="rounded-xl px-5 h-12 bg-brand-gradient hover:opacity-90 text-white shadow-md transition-all hover:scale-[1.02] flex items-center gap-1.5 font-medium shrink-0 border-none"
          data-testid="compare-run"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {t("compare.btn_compare", "Compare")}
        </Button>
      </div>

      {/* পাঠানোর **আগে** খরচটা দেখা যায় — কত credit কাটবে তা জানতে "Compare"
          চেপে অপেক্ষা করতে হয় না। সংখ্যাটা সার্ভারের সূত্রেই (মডেলগুলোর base
          credit × টেস্ট-চ্যাট গুণক), তাই এটা আন্দাজ নয়।

          ⚠️ `loadingModels`-এর সময় দেখানো হয় না: তখন তালিকাটা এখনো
          fallback, অর্থাৎ সংখ্যাটা ভুল হবে — আর "এখন ২, পাঠানোর পর ৬" ঠিক
          সেই "কার্ডে ৫, কাটে ১০" জাতীয় বিভ্রান্তি, যা একবার ঠিক করেই ফেলা
          হয়েছে। ভুল সংখ্যার চেয়ে কিছু না দেখানো ভালো। */}
      {duplicateSelection ? (
        <div className="flex items-center gap-1.5 text-xs font-medium text-destructive px-1" role="alert">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>
            {t("compare.duplicate_note", "Two columns have the same model — pick a different one to compare.")}
          </span>
        </div>
      ) : (
        !loadingModels && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 px-1">
            <Zap className="h-3.5 w-3.5 text-warning" />
            <span>
              {t("compare.cost_note", {
                count: costCredits,
                models: modelCount,
                defaultValue:
                  "{{count}} credits per comparison — one message across all {{models}} models",
              })}
            </span>
          </div>
        )
      )}
    </div>
  );
};
