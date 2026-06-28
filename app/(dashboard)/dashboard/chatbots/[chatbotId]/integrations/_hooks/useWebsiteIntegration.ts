"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

export function useWebsiteIntegration(
  chatbotId: string,
  load: () => Promise<void>,
  connectGenericPlatform: (platform: any) => Promise<void>
) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [embedCode, setEmbedCode] = useState("");
  const [connecting, setConnecting] = useState(false);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://driplare.com";
      const code = `<script src="${origin}/widget/${chatbotId}.js"></script>`;

      await connectGenericPlatform({
        platform: "website",
        connected: false,
        coming_soon: false,
        name: "Website Widget",
        description: "",
        color: "",
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
      toast.error("Failed to connect website widget");
    } finally {
      setConnecting(false);
    }
  }, [chatbotId, connectGenericPlatform, load]);

  const refreshEmbedCode = useCallback(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://driplare.com";
    const code = `<script src="${origin}/widget/${chatbotId}.js"></script>`;
    setEmbedCode(code);
  }, [chatbotId]);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      toast.success("Embed code copied to clipboard!");
    } catch {
      toast.error("Failed to copy. Please select and copy manually.");
    }
  }, [embedCode]);

  return {
    isModalOpen,
    setIsModalOpen,
    embedCode,
    connecting,
    handleConnect,
    refreshEmbedCode,
    copyToClipboard,
  };
}
