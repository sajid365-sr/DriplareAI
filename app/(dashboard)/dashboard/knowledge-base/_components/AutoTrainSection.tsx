"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { KBSectionProps } from "./types";
import type { KBAgent } from "./types";
import type { AutoTrainDrafts, ConversationSourceOptions } from "./autoTrainTypes";
import { AutoTrainProfilePicker, type ConnectedProfile } from "./AutoTrainProfilePicker";
import { AutoTrainProgress } from "./AutoTrainProgress";
import { AutoTrainReview } from "./AutoTrainReview";
import { AUTO_TRAIN_FEE } from "@/lib/domain/credit-config";

const DEFAULT_SOURCE_OPTIONS: ConversationSourceOptions = { mode: "recent", count: 25 };

type Stage = "picker" | "running" | "review";
type LearningJobStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";
type LearningJobSnapshot = {
    status: LearningJobStatus;
    error: string | null;
    currentSource: number;
    totalSources: number;
    processedConversations: number;
    totalConversations: number;
    inputTruncated: boolean;
};

type IntegrationEntry = {
    integrationId?: string | null;
    platform: string;
    name: string;
    connected: boolean;
    config?: Record<string, unknown>;
};

const EMPTY_DRAFTS: AutoTrainDrafts = { faqs: [], sampleReplies: [], content: [] };

/** Reads the best human-facing label from an integration's safe config. */
function profileLabel(entry: IntegrationEntry): string {
    const cfg = entry.config || {};
    return (
        (cfg.pageName as string) ||
        (cfg.instagramUsername as string) ||
        (cfg.verifiedName as string) ||
        (cfg.displayPhoneNumber as string) ||
        entry.name
    );
}

/**
 * Auto-Train Engine — 3-step wizard: pick profiles → animated training → review drafts.
 * Fetches live/stored conversations, parses them with AI, and persists what you keep.
 */
export function AutoTrainSection({
    agentId,
    agentName,
    agents = [],
    scope = "agent",
    workspaceId,
    onWorkspaceKnowledgeChange,
}: KBSectionProps & { agents?: KBAgent[] }) {
    const { t } = useTranslation("knowledge-base");

    const [stage, setStage] = useState<Stage>("picker");
    const [profiles, setProfiles] = useState<ConnectedProfile[]>([]);
    const [profilesLoading, setProfilesLoading] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [sourceOptions, setSourceOptions] = useState<Record<string, ConversationSourceOptions>>({});
    const [credits, setCredits] = useState<number | null>(null);
    const [drafts, setDrafts] = useState<AutoTrainDrafts>(EMPTY_DRAFTS);
    const [busy, setBusy] = useState(false);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [learningJob, setLearningJob] = useState<LearningJobSnapshot | null>(null);
    const [jobActionBusy, setJobActionBusy] = useState(false);

    // Load connected profiles
    const loadProfiles = useCallback(async () => {
        const sourceAgents = scope === "workspace"
            ? agents
            : agentId
                ? [{ id: agentId, name: agentName }]
                : [];
        if (sourceAgents.length === 0) {
            setProfiles([]);
            setProfilesLoading(false);
            return;
        }
        setProfilesLoading(true);
        setProfiles([]);
        try {
            const results = await Promise.all(sourceAgents.map(async (agent) => {
                const res = await fetch(`/api/chatbots/${encodeURIComponent(agent.id)}/integrations`);
                if (!res.ok) throw new Error(`Failed to load integrations for ${agent.name}`);
                const data: unknown = await res.json();
                if (!Array.isArray(data)) throw new Error(`Invalid integrations response for ${agent.name}`);
                return (data as IntegrationEntry[])
                    .filter((entry) => entry.connected && ["facebook", "n8n_facebook", "whatsapp", "instagram"].includes(entry.platform))
                    .filter((entry): entry is IntegrationEntry & { integrationId: string } =>
                        typeof entry.integrationId === "string" && entry.integrationId.length > 0)
                    .map((entry) => ({
                        id: `${agent.id}:${entry.integrationId}`,
                        agentId: agent.id,
                        agentName: agent.name,
                        integrationId: entry.integrationId,
                        platform: entry.platform === "n8n_facebook" ? "facebook" : entry.platform,
                        name: entry.name,
                        label: profileLabel(entry),
                    }));
            }));
            const seen = new Set<string>();
            const unique = results.flat().filter((profile) => {
                if (seen.has(profile.id)) return false;
                seen.add(profile.id);
                return true;
            });
            setProfiles(unique);
            const availableIds = new Set(unique.map((profile) => profile.id));
            setSelected((previous) => new Set([...previous].filter((id) => availableIds.has(id))));
        } catch {
            toast.error(t("autoTrain.loadError", "Failed to load connected profiles"));
        } finally {
            setProfilesLoading(false);
        }
    }, [agentId, agentName, agents, scope, t]);

    // Load credit balance
    const loadCredits = useCallback(async () => {
        try {
            const res = await fetch("/api/user/credits");
            if (!res.ok) return;
            const data = await res.json();
            if (typeof data?.creditsBalance === "number") setCredits(data.creditsBalance);
        } catch {
            // Non-fatal — credits line just won't show
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Begin remote profile and credit loading for the active agent.
        loadProfiles();
        loadCredits();
    }, [loadProfiles, loadCredits]);

    useEffect(() => {
        if (scope !== "workspace" || !workspaceId || !activeJobId || learningJob?.status === "failed") return;
        let disposed = false;
        let requestInFlight = false;

        const pollJob = async () => {
            if (requestInFlight || disposed) return;
            requestInFlight = true;
            try {
                const response = await fetch(
                    `/api/workspaces/${encodeURIComponent(workspaceId)}/auto-train/${encodeURIComponent(activeJobId)}`
                );
                const data = await response.json();
                if (!response.ok) throw new Error(data?.error || "Could not read conversation learning status.");
                if (disposed || !data.job) return;

                const nextJob = data.job as LearningJobSnapshot;
                setLearningJob(nextJob);
                if (nextJob.status === "cancelled") {
                    setActiveJobId(null);
                    setLearningJob(null);
                    setStage("picker");
                    toast.info(t("autoTrain.jobCancelled", "Conversation learning was cancelled."));
                    return;
                }
                if (nextJob.status !== "completed") return;

                setActiveJobId(null);
                const resultDrafts = data.job.drafts as AutoTrainDrafts | null;
                const draftCount = (resultDrafts?.faqs.length ?? 0)
                    + (resultDrafts?.sampleReplies.length ?? 0)
                    + (resultDrafts?.content.length ?? 0);
                if (typeof data.job.creditsSpent === "number" && credits !== null) {
                    setCredits(Math.max(0, credits - data.job.creditsSpent));
                }
                if (Number(data.job.failedSources) > 0) {
                    toast.warning(t("autoTrain.partialSources", "{{count}} source(s) could not be read; available conversations were still processed.", {
                        count: data.job.failedSources,
                    }));
                }
                if (Number(data.job.truncatedSources) > 0) {
                    toast.warning(t("autoTrain.dateRangeScanLimit", "The selected date range was only partially searched. Narrow the date range and try again."));
                }
                if (data.job.inputTruncated === true) {
                    toast.warning(t("autoTrain.transcriptLimit", "The transcript reached the safe analysis size limit, so later messages were not included."));
                }
                if (!resultDrafts || draftCount === 0) {
                    toast.info(data.job.error || t("autoTrain.noSupportedDrafts", "No suggestions with verifiable conversation evidence were found."));
                    setLearningJob(null);
                    setStage("picker");
                    return;
                }
                setDrafts(resultDrafts);
                setLearningJob(null);
                setStage("review");
            } catch (error) {
                if (!disposed) {
                    toast.error(error instanceof Error ? error.message : t("autoTrain.trainingFailed", "Auto-training failed. Please try again."));
                }
            } finally {
                requestInFlight = false;
            }
        };

        void pollJob();
        const timer = setInterval(pollJob, 2500);
        return () => {
            disposed = true;
            clearInterval(timer);
        };
    }, [activeJobId, credits, learningJob?.status, scope, t, workspaceId]);

    const toggleProfile = (profileId: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(profileId)) {
                next.delete(profileId);
            } else {
                next.add(profileId);
                setSourceOptions((previous) => ({
                    ...previous,
                    [profileId]: previous[profileId] ?? DEFAULT_SOURCE_OPTIONS,
                }));
            }
            return next;
        });
    };

    const setOptions = (profileId: string, options: ConversationSourceOptions) => {
        setSourceOptions((prev) => ({ ...prev, [profileId]: options }));
    };

    const startTraining = async () => {
        if (selected.size === 0) return;
        if (scope === "workspace" && !workspaceId) {
            toast.error(t("autoTrain.workspaceUnavailable", "The active business workspace could not be loaded."));
            return;
        }
        const selectedProfiles = Array.from(selected).map((profileId) => ({
            profileId,
            options: sourceOptions[profileId] ?? DEFAULT_SOURCE_OPTIONS,
        }));
        const invalidDateRange = selectedProfiles.some(({ options }) =>
            options.mode === "date_range"
            && (!options.fromDate || !options.toDate || options.fromDate > options.toDate)
        );
        if (invalidDateRange) {
            toast.error(t("autoTrain.invalidDateRange", "Choose a valid date range before continuing."));
            return;
        }

        const selections = selectedProfiles.flatMap(({ profileId, options }) => {
            const profile = profiles.find((item) => item.id === profileId);
            return profile ? [{
                agentId: profile.agentId,
                integrationId: profile.integrationId,
                platform: profile.platform,
                ...options,
            }] : [];
        });

        setBusy(true);
        setStage("running");

        try {
            if (scope === "workspace") {
                const response = await fetch(
                    `/api/workspaces/${encodeURIComponent(workspaceId ?? "")}/auto-train`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ selections }),
                    }
                );
                const data = await response.json();
                if (!response.ok) throw new Error(data?.error || "Could not start conversation learning.");
                setLearningJob({
                    status: "queued",
                    error: null,
                    currentSource: 0,
                    totalSources: selections.length,
                    processedConversations: 0,
                    totalConversations: 0,
                    inputTruncated: false,
                });
                setActiveJobId(data.jobId as string);
                return;
            }

            const res = await fetch(`/api/chatbots/${encodeURIComponent(agentId)}/auto-train`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    selections: selections.map(({ platform, count }) => ({ platform, count })),
                }),
            });

            const data = await res.json();

            if (res.status === 402) {
                toast.error(t("autoTrain.insufficientCredits", "Not enough credits to auto-train."));
                setStage("picker");
                return;
            }

            if (!res.ok) {
                throw new Error(data?.error || "Failed");
            }

            if (data.warning === "no_conversations" || data.warning === "no_supported_drafts") {
                const scanLimitReached = Number(data?.meta?.truncatedSources) > 0;
                toast[scanLimitReached ? "warning" : "info"](
                    t(
                        scanLimitReached
                            ? "autoTrain.dateRangeScanLimit"
                            : data.warning === "no_conversations" ? "autoTrain.noConversations" : "autoTrain.noSupportedDrafts",
                        scanLimitReached
                            ? "The selected date range was only partially searched. Narrow the date range and try again."
                            : data.warning === "no_conversations"
                                ? "No conversations found on the selected platforms yet."
                                : "No suggestions with verifiable conversation evidence were found. No credits were charged."
                    )
                );
                setStage("picker");
                return;
            }
            if (data.warning === "source_fetch_failed") {
                toast.error(t("autoTrain.sourceFetchFailed", "The selected sources could not be read. Check the channel connection and try again. No credits were charged."));
                setStage("picker");
                return;
            }

            setDrafts(data.drafts as AutoTrainDrafts);
            if (typeof data?.meta?.creditsSpent === "number" && credits !== null) {
                setCredits(credits - data.meta.creditsSpent);
            }
            // Brief beat so the 100% state is visible
            setTimeout(() => setStage("review"), 500);
        } catch {
            toast.error(t("autoTrain.trainingFailed", "Auto-training failed. Please try again."));
            setStage("picker");
        } finally {
            setBusy(false);
        }
    };

    const controlJob = async (action: "pause" | "resume" | "cancel" | "retry") => {
        if (!workspaceId || !activeJobId) return;
        setJobActionBusy(true);
        try {
            const response = await fetch(
                `/api/workspaces/${encodeURIComponent(workspaceId)}/auto-train/${encodeURIComponent(activeJobId)}/control`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action }),
                }
            );
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || "Could not update conversation learning.");
            setLearningJob((previous) => previous ? {
                ...previous,
                status: data.status as LearningJobStatus,
                error: action === "retry" ? null : previous.error,
                processedConversations: action === "retry" ? 0 : previous.processedConversations,
                totalConversations: action === "retry" ? 0 : previous.totalConversations,
                currentSource: action === "retry" ? 0 : previous.currentSource,
            } : previous);
            if (action === "cancel") {
                setActiveJobId(null);
                setLearningJob(null);
                setStage("picker");
                toast.info(t("autoTrain.jobCancelled", "Conversation learning was cancelled."));
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t("autoTrain.jobControlFailed", "Could not update the learning job."));
        } finally {
            setJobActionBusy(false);
        }
    };

    const applyDrafts = async (kept: AutoTrainDrafts) => {
        setBusy(true);
        try {
            const applyUrl = scope === "workspace" ? `/api/workspaces/${workspaceId}/auto-train/apply` : `/api/chatbots/${agentId}/auto-train/apply`;
            const res = await fetch(applyUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(kept),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Failed");

            const added = data.added || {};
            const total = (added.answers || 0) + (added.faqs || 0) + (added.sampleReplies || 0) + (added.content || 0);
            const failed = Number(data.failed ?? 0);
            if (failed > 0) {
                toast.warning(t("autoTrain.partialApply", "Added {{count}} items; {{failed}} could not be saved.", { count: total, failed }));
            } else {
                toast.success(scope === "workspace"
                    ? t("autoTrain.workspaceApplied", "Added {{count}} items to Business Knowledge.", { count: total })
                    : t("autoTrain.applied", "Added {{count}} items to your agent.", { count: total }));
            }
            if (scope === "workspace") onWorkspaceKnowledgeChange?.();

            // Reset back to picker
            setStage("picker");
            setSelected(new Set());
            setDrafts(EMPTY_DRAFTS);
        } catch {
            toast.error(t("autoTrain.applyFailed", "Failed to add items. Please try again."));
        } finally {
            setBusy(false);
        }
    };

    const cancelReview = () => {
        setStage("picker");
        setDrafts(EMPTY_DRAFTS);
    };

    return (
        <div className="space-y-4">
            {stage === "picker" && profilesLoading ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-card py-16 text-center text-sm text-muted-foreground">
                    {t("common.loading", "Loading connected sources…")}
                </div>
            ) : stage === "picker" && (
                <AutoTrainProfilePicker
                    profiles={profiles}
                    selected={selected}
                    sourceOptions={sourceOptions}
                    allowAdvancedSelection={scope === "workspace"}
                    fee={AUTO_TRAIN_FEE}
                    creditsAvailable={credits}
                    busy={busy}
                    onToggle={toggleProfile}
                    onOptionsChange={setOptions}
                    onStart={startTraining}
                />
            )}

            {stage === "running" && scope === "workspace" && learningJob && (
                <AutoTrainProgress
                    status={learningJob.status === "completed" || learningJob.status === "cancelled" ? "running" : learningJob.status}
                    currentSource={learningJob.currentSource}
                    totalSources={learningJob.totalSources}
                    processedConversations={learningJob.processedConversations}
                    totalConversations={learningJob.totalConversations}
                    error={learningJob.error}
                    busy={jobActionBusy}
                    onPause={() => void controlJob("pause")}
                    onResume={() => void controlJob("resume")}
                    onCancel={() => void controlJob("cancel")}
                    onRetry={() => void controlJob("retry")}
                />
            )}
            {stage === "running" && scope !== "workspace" && (
                <div className="rounded-2xl border border-border/60 bg-card py-16 text-center text-sm text-muted-foreground">
                    {t("autoTrain.phaseReading", "Reading conversations with AI…")}
                </div>
            )}

            {stage === "review" && (
                <AutoTrainReview drafts={drafts} busy={busy} scope={scope} onApply={applyDrafts} onCancel={cancelReview} />
            )}
        </div>
    );
}
