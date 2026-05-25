import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { PlatformIntegration } from "../_components/PlatformCard";

export type UsageSummary = {
  maxIntegrationsPerChatbot?: number;
  integrationsLimit?: number;
  integrationsUsed?: number;
  [key: string]: unknown;
};

export function useIntegrationsData(chatbotId: string) {
  const [items, setItems] = useState<PlatformIntegration[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [platformSearch, setPlatformSearch] = useState("");
  const [detailsPlatform, setDetailsPlatform] = useState<PlatformIntegration | null>(null);

  const load = useCallback(async () => {
    if (!chatbotId) return;
    try {
      const r = await fetch(`/api/chatbots/${chatbotId}/integrations`);
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);

      const usageRes = await fetch("/api/usage");
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setUsage(usageData);
      }
    } catch (e) {
      console.error("Failed to load integrations", e);
    }
  }, [chatbotId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const disconnectPlatform = async (it: PlatformIntegration) => {
    setDetailsPlatform(null);
    await fetch(`/api/chatbots/${chatbotId}/integrations/${it.platform}/disconnect`, { method: "POST" });
    toast.success(`${it.name} disconnected successfully`);
    load();
  };

  const connectGenericPlatform = async (it: PlatformIntegration) => {
    await fetch(`/api/chatbots/${chatbotId}/integrations/${it.platform}/connect`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: {} })
    });
    toast.success(`${it.name} connected successfully`);
    load();
  };

  return {
    items,
    usage,
    platformSearch,
    setPlatformSearch,
    detailsPlatform,
    setDetailsPlatform,
    load,
    disconnectPlatform,
    connectGenericPlatform
  };
}
