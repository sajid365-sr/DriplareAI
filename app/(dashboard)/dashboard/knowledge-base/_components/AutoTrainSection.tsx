"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { KBSectionProps } from "./types";
import type { AutoTrainDrafts } from "./autoTrainTypes";
import { AutoTrainProfilePicker, type ConnectedProfile } from "./AutoTrainProfilePicker";
import { AutoTrainProgress } from "./AutoTrainProgress";
import { AutoTrainReview } from "./AutoTrainReview";

const AUTO_TRAIN_FEE = 50;
const DEFAULT_CHAT_COUNT = 25;

type Stage = "picker" | "running" | "review";

type IntegrationEntry = {
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
export function AutoTrainSection({ agentId }: KBSectionProps) {
    const { t } = useTranslation("knowledge-base");

    const [stage, setStage] = useState<Stage>("picker");
    const [profiles, setProfiles] = useState<ConnectedProfile[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [credits, setCredits] = useState<number | null>(null);
    const [drafts, setDrafts] = useState<AutoTrainDrafts>(EMPTY_DRAFTS);
    const [runDone, setRunDone] = useState(false);
    const [busy, setBusy] = useState(false);

    // Load connected profiles
    const loadProfiles = useCallback(async () => {
        if (!agentId) return;
        try {
            const res = await fetch(`/api/chatbots/${agentId}/integrations`);
            const data = (await res.json()) as IntegrationEntry[];
            const connected = (Array.isArray(data) ? data : [])
                .filter((e) => e.connected && ["facebook", "n8n_facebook", "whatsapp", "instagram"].includes(e.platform))
                .map((e) => ({
                    platform: e.platform === "n8n_facebook" ? "facebook" : e.platform,
                    name: e.name,
                    label: profileLabel(e),
                }));
            // Dedupe by canonical platform (facebook/n8n_facebook collapse)
            const seen = new Set<string>();
            const unique = connected.filter((p) => {
                if (seen.has(p.platform)) return false;
                seen.add(p.platform);
                return true;
            });
            setProfiles(unique);
        } catch {
            toast.error(t("autoTrain.loadError", "Failed to load connected profiles"));
        }
    }, [agentId, t]);

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
        loadProfiles();
        loadCredits();
    }, [loadProfiles, loadCredits]);

    const toggleProfile = (platform: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(platform)) {
                next.delete(platform);
            } else {
                next.add(platform);
                setCounts((c) => ({ ...c, [platform]: c[platform] ?? DEFAULT_CHAT_COUNT }));
            }
            return next;
        });
    };

    const setCount = (platform: string, count: number) => {
        setCounts((prev) => ({ ...prev, [platform]: count }));
    };

    const startTraining = async () => {
        if (selected.size === 0) return;

        const selections = Array.from(selected).map((platform) => ({
            platform,
            count: counts[platform] ?? DEFAULT_CHAT_COUNT,
        }));

        setBusy(true);
        setRunDone(false);
        setStage("running");

        try {
            const res = await fetch(`/api/chatbots/${agentId}/auto-train`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ selections }),
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

            if (data.warning === "no_conversations") {
                toast.info(
                    t("autoTrain.noConversations", "No conversations found on the selected platforms yet.")
                );
                setStage("picker");
                return;
            }

            // Snap progress to 100%, then flip to review
            setRunDone(true);
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

    const applyDrafts = async (kept: AutoTrainDrafts) => {
        setBusy(true);
        try {
            const res = await fetch(`/api/chatbots/${agentId}/auto-train/apply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(kept),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Failed");

            const added = data.added || {};
            const total = (added.faqs || 0) + (added.sampleReplies || 0) + (added.content || 0);
            toast.success(t("autoTrain.applied", "Added {{count}} items to your agent.", { count: total }));

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
            {stage === "picker" && (
                <AutoTrainProfilePicker
                    profiles={profiles}
                    selected={selected}
                    counts={counts}
                    fee={AUTO_TRAIN_FEE}
                    creditsAvailable={credits}
                    busy={busy}
                    onToggle={toggleProfile}
                    onCountChange={setCount}
                    onStart={startTraining}
                />
            )}

            {stage === "running" && <AutoTrainProgress done={runDone} />}

            {stage === "review" && (
                <AutoTrainReview drafts={drafts} busy={busy} onApply={applyDrafts} onCancel={cancelReview} />
            )}
        </div>
    );
}
