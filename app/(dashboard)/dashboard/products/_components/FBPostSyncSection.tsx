"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { SyncConfigPicker } from "./SyncConfigPicker";
import { SyncProgress } from "./SyncProgress";
import { ProductReviewTable } from "./ProductReviewTable";
import type { ExtractedProduct } from "@/lib/ai/product-extract";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = "picker" | "running" | "review";

type ConnectedProfile = {
  platform: string;
  name: string;
  label: string;
};

type IntegrationEntry = {
  platform: string;
  name: string;
  connected: boolean;
  config?: Record<string, unknown>;
};

type FBSyncConfig = {
  limit: number;
  since: string | undefined;
};

function profileLabel(entry: IntegrationEntry): string {
  const cfg = entry.config || {};
  return (
    (cfg.pageName as string) ||
    (cfg.instagramUsername as string) ||
    (cfg.verifiedName as string) ||
    entry.name
  );
}

const FB_PLATFORMS = ["facebook", "n8n_facebook"];

type FBPostSyncSectionProps = {
  agentId: string;
  onProductsSaved: () => void; // Notify parent to refresh catalog
};

/**
 * FB Post Auto-Sync Section — 3-step wizard:
 * Step 1: SyncConfigPicker — select platform, post count, date range
 * Step 2: SyncProgress — animated fetch + AI analysis animation
 * Step 3: ProductReviewTable — review, edit, and save extracted products
 */
export function FBPostSyncSection({ agentId, onProductsSaved }: FBPostSyncSectionProps) {
  const { t } = useTranslation("products");

  const [stage, setStage] = useState<Stage>("picker");
  const [profiles, setProfiles] = useState<ConnectedProfile[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<ExtractedProduct[]>([]);
  const [runDone, setRunDone] = useState(false);
  const [busy, setBusy] = useState(false);

  // Load connected FB profiles
  const loadProfiles = useCallback(async () => {
    if (!agentId) return;
    try {
      const res = await fetch(`/api/chatbots/${agentId}/integrations`);
      const data = (await res.json()) as IntegrationEntry[];
      const connected = (Array.isArray(data) ? data : [])
        .filter((e) => e.connected && FB_PLATFORMS.includes(e.platform))
        .map((e) => ({
          platform: e.platform === "n8n_facebook" ? "facebook" : e.platform,
          name: e.name,
          label: profileLabel(e),
        }));

      // Deduplicate by platform
      const seen = new Set<string>();
      const unique = connected.filter((p) => {
        if (seen.has(p.platform)) return false;
        seen.add(p.platform);
        return true;
      });
      setProfiles(unique);
    } catch {
      // Non-fatal
    }
  }, [agentId]);

  // Load credit balance
  const loadCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/user/credits");
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data?.creditsBalance === "number") setCredits(data.creditsBalance);
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    loadProfiles();
    loadCredits();
  }, [loadProfiles, loadCredits]);

  // Start the sync
  const handleSync = async (config: FBSyncConfig) => {
    setBusy(true);
    setRunDone(false);
    setStage("running");

    try {
      const res = await fetch(`/api/chatbots/${agentId}/products/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: config.limit, since: config.since }),
      });

      const data = await res.json();

      if (res.status === 402) {
        toast.error(t("sync.insufficientCredits"));
        setStage("picker");
        return;
      }
      if (res.status === 404 && data?.error?.includes("Facebook")) {
        toast.error(t("sync.noFbIntegration"));
        setStage("picker");
        return;
      }
      if (!res.ok) {
        throw new Error(data?.error || "Sync failed");
      }

      if (data.warning === "no_posts") {
        toast.info(t("sync.noPosts"));
        setStage("picker");
        return;
      }
      if (data.warning === "no_products_found") {
        toast.info(t("sync.noProducts"));
        setStage("picker");
        return;
      }

      // Update credits balance
      if (typeof data?.meta?.creditsSpent === "number" && credits !== null) {
        setCredits(credits - data.meta.creditsSpent);
      }

      setDrafts(data.products as ExtractedProduct[]);
      setRunDone(true);
      // Small delay so user sees the 100% state
      setTimeout(() => setStage("review"), 600);
    } catch {
      toast.error(t("sync.syncFailed"));
      setStage("picker");
    } finally {
      setBusy(false);
    }
  };

  // Save reviewed products
  const handleSave = async (products: ExtractedProduct[]) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/chatbots/${agentId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");

      toast.success(t("sync.saved", { count: data.saved }));
      setStage("picker");
      setDrafts([]);
      onProductsSaved(); // Refresh catalog below
    } catch {
      toast.error(t("sync.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    setStage("picker");
    setDrafts([]);
  };

  return (
    <div className="space-y-4">
      {/* Step header info */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">{t("sync.title")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground max-w-2xl">{t("sync.subtitle")}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {stage === "picker" && (
          <motion.div
            key="picker"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <SyncConfigPicker
              profiles={profiles}
              credits={credits}
              busy={busy}
              onSync={handleSync}
            />
          </motion.div>
        )}

        {stage === "running" && (
          <motion.div
            key="running"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <SyncProgress done={runDone} />
          </motion.div>
        )}

        {stage === "review" && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ProductReviewTable
              drafts={drafts}
              busy={busy}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
