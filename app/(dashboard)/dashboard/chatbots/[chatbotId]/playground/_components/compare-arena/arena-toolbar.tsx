"use client";

import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { RotateCcw, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import { MAX_COMPARE_MODELS, MIN_COMPARE_MODELS } from "@/lib/domain/compare-config";

/** ২, ৩, ৪ — সংখ্যাগুলো সীমা থেকেই আসে, কোথাও হাতে লেখা নয় */
const COUNTS = Array.from(
  { length: MAX_COMPARE_MODELS - MIN_COMPARE_MODELS + 1 },
  (_, i) => MIN_COMPARE_MODELS + i
);

interface ArenaToolbarProps {
  count: number;
  chatbotId: string;
  onCountChange: (count: number) => void;
  onReset: () => void;
}

/** ArenaToolbar — কতগুলো মডেল লড়বে, তা বাছার সারি। */
export function ArenaToolbar({ count, chatbotId, onCountChange, onReset }: ArenaToolbarProps) {
  const { t } = useTranslation("chatbots");
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label={t("compare.model_count_label", "Models to compare")}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1"
        >
          {COUNTS.map((n) => {
            const active = n === count;

            return (
              <button
                key={n}
                type="button"
                onClick={() => onCountChange(n)}
                aria-pressed={active}
                data-testid={`arena-count-${n}`}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all",
                  active
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t("compare.model_count", { count: n, defaultValue: "{{count}} Models" })}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={onReset}
          data-testid="arena-reset"
          className="h-9 rounded-full border-border px-4 text-xs font-semibold hover:bg-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t("compare.reset", "Reset Arena")}
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push(`/dashboard/chatbots/${chatbotId}/setup`)}
          data-testid="configure-models"
          className="h-9 rounded-full px-4 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Settings2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("compare.configure", "Configure Models")}</span>
        </Button>
      </div>
    </div>
  );
}
