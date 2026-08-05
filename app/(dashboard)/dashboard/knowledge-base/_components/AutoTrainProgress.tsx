"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

type AutoTrainProgressProps = {
    /** When true, progress snaps to 100%. */
    done: boolean;
};

/**
 * Auto-Train step 2 — animated progress bar + percentage while the AI works.
 *
 * A single AI call can't report real progress, so we ease 0→90% through labeled
 * phases while the request is in flight, then snap to 100% once `done` flips.
 */
export function AutoTrainProgress({ done }: AutoTrainProgressProps) {
    const { t } = useTranslation("knowledge-base");
    const [progress, setProgress] = useState(6);

    useEffect(() => {
        if (done) {
            setProgress(100);
            return;
        }
        // Ease toward 90% — slows as it approaches the ceiling
        const timer = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 90) return prev;
                const remaining = 90 - prev;
                return prev + Math.max(0.5, remaining * 0.04);
            });
        }, 200);
        return () => clearInterval(timer);
    }, [done]);

    const phaseLabel = done
        ? t("autoTrain.percentComplete", "Complete")
        : progress < 35
            ? t("autoTrain.phaseFetching", "Fetching conversations…")
            : progress < 70
                ? t("autoTrain.phaseReading", "Reading with AI…")
                : t("autoTrain.phaseDrafting", "Drafting suggestions…");

    return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card px-6 py-16 text-center">
            <motion.span
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"
            >
                <Sparkles className="h-8 w-8" />
            </motion.span>

            <p className="mb-1 text-4xl font-bold tabular-nums text-foreground">
                {Math.round(progress)}%
            </p>
            <p className="mb-6 text-sm text-muted-foreground">{phaseLabel}</p>

            {/* Progress bar */}
            <div className="h-2.5 w-full max-w-sm overflow-hidden rounded-full bg-muted">
                <motion.div
                    className="h-full rounded-full bg-primary"
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "easeOut", duration: 0.4 }}
                />
            </div>
        </div>
    );
}
