"use client";

import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { LoaderCircle, Pause, Play, RotateCcw, Sparkles, X } from "lucide-react";

type AutoTrainProgressProps = {
    status: "queued" | "running" | "paused" | "failed";
    currentSource: number;
    totalSources: number;
    processedConversations: number;
    totalConversations: number;
    error?: string | null;
    busy: boolean;
    onPause: () => void;
    onResume: () => void;
    onCancel: () => void;
    onRetry: () => void;
};

export function AutoTrainProgress({
    status,
    currentSource,
    totalSources,
    processedConversations,
    totalConversations,
    error,
    busy,
    onPause,
    onResume,
    onCancel,
    onRetry,
}: AutoTrainProgressProps) {
    const { t } = useTranslation("knowledge-base");
    const hasConversationCount = totalConversations > 0;
    const progress = hasConversationCount
        ? Math.min(95, Math.round(processedConversations / totalConversations * 100))
        : 0;
    const phaseLabel = status === "paused"
        ? t("autoTrain.jobPaused", "Learning is paused.")
        : status === "failed"
            ? t("autoTrain.jobFailed", "Learning stopped because of an error.")
            : status === "queued"
                ? t("autoTrain.jobQueued", "Waiting for a background worker…")
                : t("autoTrain.phaseFetching", "Fetching and analyzing conversations…");
    const errorMessage = error === "source_credentials_decryption_failed"
        ? t("autoTrain.sourceCredentialsDecryptionFailed", "The channel credential could not be decrypted. Set the same INTEGRATION_ENCRYPTION_KEY used when connecting this channel, then retry.")
        : error === "facebook_credentials_unavailable"
            ? t("autoTrain.facebookCredentialsUnavailable", "Facebook page credentials are unavailable. Reconnect the channel, then retry.")
            : error === "conversation_source_unavailable"
                ? t("autoTrain.conversationSourceUnavailable", "The conversation source could not be read. Check the channel connection and permissions, then retry.")
                : error;

    return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card px-6 py-16 text-center">
            <motion.span
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: status === "running" ? Infinity : 0, duration: 1.6, ease: "easeInOut" }}
                className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"
            >
                <Sparkles className="h-8 w-8" />
            </motion.span>

            {hasConversationCount && (
                <p className="mb-1 text-4xl font-bold tabular-nums text-foreground">
                    {progress}%
                </p>
            )}
            <p className="mb-6 text-sm text-muted-foreground">{phaseLabel}</p>
            <p className="mb-4 text-xs text-muted-foreground">
                {hasConversationCount
                    ? t("autoTrain.jobProgress", "Source {{source}} of {{total}} · {{processed}} of {{count}} conversations", {
                        source: Math.min(currentSource + 1, totalSources || 1),
                        total: totalSources,
                        processed: processedConversations,
                        count: totalConversations,
                    })
                    : t("autoTrain.jobWaitingForCount", "Conversation totals appear after the worker starts reading this source.")}
            </p>

            <div className="h-2.5 w-full max-w-sm overflow-hidden rounded-full bg-muted">
                <motion.div
                    className={`h-full rounded-full bg-primary ${!hasConversationCount && status === "running" ? "w-1/3" : ""}`}
                    animate={hasConversationCount
                        ? { width: `${progress}%`, x: 0 }
                        : status === "running"
                            ? { x: ["-100%", "300%"] }
                            : { x: 0, width: 0 }}
                    transition={hasConversationCount
                        ? { ease: "easeOut", duration: 0.4 }
                        : status === "running"
                            ? { repeat: Infinity, duration: 1.4, ease: "easeInOut" }
                            : { duration: 0.2 }}
                />
            </div>
            {errorMessage && <p role="alert" className="mt-4 max-w-md text-sm text-destructive">{errorMessage}</p>}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
                {status === "running" || status === "queued" ? (
                    <button
                        type="button"
                        onClick={onPause}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                    >
                        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                        {t("autoTrain.pauseJob", "Pause")}
                    </button>
                ) : null}
                {status === "paused" && (
                    <button
                        type="button"
                        onClick={onResume}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        {t("autoTrain.resumeJob", "Resume")}
                    </button>
                )}
                {status === "failed" && (
                    <button
                        type="button"
                        onClick={onRetry}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                        <RotateCcw className="h-4 w-4" />
                        {t("autoTrain.retryJob", "Retry from the beginning")}
                    </button>
                )}
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={busy || status === "failed"}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                    <X className="h-4 w-4" />
                    {t("autoTrain.cancelJob", "Cancel")}
                </button>
            </div>
        </div>
    );
}
