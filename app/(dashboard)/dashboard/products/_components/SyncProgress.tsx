"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { RefreshCw, Sparkles, CheckCircle } from "lucide-react";

type SyncProgressProps = {
  done: boolean;
};

type Step = {
  labelKey: string;
  durationMs: number;
};

const STEPS: Step[] = [
  { labelKey: "sync.progressFetching", durationMs: 2200 },
  { labelKey: "sync.progressAnalyzing", durationMs: 3500 },
];

/**
 * Step 2 of the sync wizard — animated progress display.
 * Cycles through fetching → analyzing → done states.
 */
export function SyncProgress({ done }: SyncProgressProps) {
  const { t } = useTranslation("products");
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (done) {
      setProgress(100);
      setStepIndex(STEPS.length);
      return;
    }

    let elapsed = 0;
    const totalMs = STEPS.reduce((s, st) => s + st.durationMs, 0);
    const interval = setInterval(() => {
      elapsed += 80;
      setProgress(Math.min((elapsed / totalMs) * 95, 95)); // cap at 95 until done

      // Advance step
      let acc = 0;
      for (let i = 0; i < STEPS.length; i++) {
        acc += STEPS[i].durationMs;
        if (elapsed < acc) {
          setStepIndex(i);
          break;
        }
        setStepIndex(STEPS.length - 1);
      }
    }, 80);

    return () => clearInterval(interval);
  }, [done]);

  const currentLabel = done
    ? t("sync.progressDone")
    : t(STEPS[Math.min(stepIndex, STEPS.length - 1)].labelKey);

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card py-16 text-center space-y-6">
      {/* Icon */}
      <motion.div
        animate={done ? { scale: [1, 1.15, 1] } : { rotate: 360 }}
        transition={
          done
            ? { duration: 0.5, ease: "easeOut" }
            : { duration: 1.2, repeat: Infinity, ease: "linear" }
        }
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"
      >
        {done ? (
          <CheckCircle className="h-8 w-8 text-success" />
        ) : stepIndex === 0 ? (
          <RefreshCw className="h-8 w-8" />
        ) : (
          <Sparkles className="h-8 w-8" />
        )}
      </motion.div>

      {/* Title */}
      <div className="space-y-1">
        <h3 className="text-base font-bold text-foreground">{t("sync.progressTitle")}</h3>
        <p className="text-sm text-muted-foreground">{currentLabel}</p>
      </div>

      {/* Progress bar */}
      <div className="w-64">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-brand-gradient"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
        <p className="mt-2 text-xs font-medium text-muted-foreground">
          {Math.round(progress)}%
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                (done || i < stepIndex)
                  ? "bg-success text-success-foreground"
                  : i === stepIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {done || i < stepIndex ? "✓" : i + 1}
            </span>
            {i < STEPS.length - 1 && (
              <span className="h-px w-8 bg-border" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
