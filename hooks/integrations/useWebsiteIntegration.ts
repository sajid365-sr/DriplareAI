"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { buildWidgetEmbedCode, parseWidgetKey } from "@/lib/domain/widget-key";

/** What every "connect a platform" call needs, however the route is wired. */
export type ConnectPlatformPayload = {
  platform: string;
  config?: Record<string, unknown>;
};

/**
 * What the generic connect route answers with.
 *
 * Only `integrationId` is read, because that is what the embed code is built
 * from — see `lib/domain/widget-key.ts` for why the widget key is the
 * integration's own id.
 */
export type ConnectPlatformResult = { integrationId?: string } | null | undefined;

/**
 * The host the merchant is looking at right now.
 *
 * `window.location.origin` is the real answer in the browser; the fallback only
 * runs during SSR, but it still has to name a host that serves the widget —
 * `driplare.com` is not attached to this project, so it would embed nothing.
 * The same rule is used when the merchant copies the code, so the tag they paste
 * matches the dashboard that showed it to them.
 */
function currentOrigin(): string {
  return typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL ?? "https://driplare-ai.vercel.app";
}

/**
 * useWebsiteIntegration — the Website Widget channel for one AI agent.
 *
 * The widget has no OAuth round-trip: connecting it upserts an integration row
 * and hands the merchant an embed code, so it shares the generic connect route
 * with the other platforms that have no dedicated flow.
 *
 * ## The ordering here is the whole point
 *
 * The embed code cannot be built before the connect call answers, because it
 * carries the **server-minted** widget key — the integration's `integrationId`.
 * The previous version built the tag first, from the `chatbotId`, and pointed
 * at `/widget/<chatbotId>.js`: a URL no route has ever served. The merchant
 * pasted it, saw nothing, and had no way to tell why.
 *
 * So: connect, read the key out of the answer, then build the tag. If the
 * answer carries no usable key the connect is reported as failed rather than
 * handing over a snippet that silently does nothing.
 *
 * `connectPlatform` is expected to reject on failure, and to resolve with the
 * route's JSON on success — without that, a 4xx body would read as a real
 * connection and produce exactly the same silent-nothing outcome.
 *
 * The agent being connected is not a parameter here: the caller binds it, since
 * `connectPlatform` already closes over the agent the merchant picked. Naming it
 * again would suggest this hook could disagree with the route about the target.
 */
export function useWebsiteIntegration(
  load: () => Promise<void>,
  connectPlatform: (payload: ConnectPlatformPayload) => Promise<ConnectPlatformResult>
) {
  const { t } = useTranslation("integrations");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [embedCode, setEmbedCode] = useState("");

  /**
   * Shows the snippet for a widget that is already connected.
   *
   * Without this, the only way back to the embed code would be to connect
   * again — which works, but reads as "you have to reinstall it", and a
   * merchant who has lost the tag has no reason to believe that is safe.
   */
  const showEmbedCode = useCallback((widgetKey: string) => {
    const key = parseWidgetKey(widgetKey);
    if (!key) return false;

    setEmbedCode(buildWidgetEmbedCode(currentOrigin(), key));
    setIsModalOpen(true);
    return true;
  }, []);

  const handleConnect = useCallback(async () => {
    try {
      const integration = await connectPlatform({
        platform: "website",
        // `embedCode` is deliberately not sent. It is derived, not stored — and
        // at this point the key it depends on does not exist yet, so anything
        // written here would be a URL that 404s.
        config: {
          widgetPosition: "right",
          connectedAt: new Date().toISOString(),
        },
      });

      const widgetKey = parseWidgetKey(String(integration?.integrationId ?? ""));

      if (!widgetKey) {
        throw new Error("Connect route returned no usable widget key");
      }

      setEmbedCode(buildWidgetEmbedCode(currentOrigin(), widgetKey));
      setIsModalOpen(true);
      await load();
    } catch {
      toast.error(
        t("website_widget.connectFailed", "Failed to connect website widget")
      );
    }
  }, [connectPlatform, load, t]);

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
    showEmbedCode,
    copyToClipboard,
  };
}
