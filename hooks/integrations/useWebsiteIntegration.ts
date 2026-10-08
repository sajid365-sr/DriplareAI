"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

/** What every "connect a platform" call needs, however the route is wired. */
export type ConnectPlatformPayload = {
  platform: string;
  config?: Record<string, unknown>;
};

/**
 * The widget script tag is derived, never stored as the source of truth — one
 * URL per agent, always the same. It is persisted alongside the connection only
 * so `PlatformDetailsModal` has something to show.
 */
function buildEmbedCode(chatbotId: string) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://driplare.com";
  return `<script src="${origin}/widget/${chatbotId}.js"></script>`;
}

/**
 * useWebsiteIntegration — the Website Widget channel for one AI agent.
 *
 * The widget has no OAuth round-trip: connecting it just upserts an integration
 * row and hands the merchant an embed code, so it shares the generic connect
 * route with the other platforms that have no dedicated flow.
 *
 * `connectPlatform` is expected to reject on failure. The generic route returns
 * the integration row on success, so without a check a 4xx would read as a
 * successful connection.
 */
export function useWebsiteIntegration(
  chatbotId: string,
  load: () => Promise<void>,
  connectPlatform: (payload: ConnectPlatformPayload) => Promise<void>
) {
  const { t } = useTranslation("integrations");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [embedCode, setEmbedCode] = useState("");

  const handleConnect = useCallback(async () => {
    try {
      const code = buildEmbedCode(chatbotId);

      await connectPlatform({
        platform: "website",
        config: {
          embedCode: code,
          widgetPosition: "right",
          connectedAt: new Date().toISOString(),
        },
      });

      setEmbedCode(code);
      setIsModalOpen(true);
      await load();
    } catch {
      toast.error(
        t("website_widget.connectFailed", "Failed to connect website widget")
      );
    }
  }, [chatbotId, connectPlatform, load, t]);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      toast.success(t("website_widget.copied", "Embed code copied to clipboard!"));
    } catch {
      toast.error(
        t(
          "website_widget.copyFailed",
          "Failed to copy. Please select and copy manually."
        )
      );
    }
  }, [embedCode, t]);

  return {
    isModalOpen,
    setIsModalOpen,
    embedCode,
    handleConnect,
    copyToClipboard,
  };
}
