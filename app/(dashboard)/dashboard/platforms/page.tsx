"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { type ChannelItem, type ChatbotOption } from "@/components/integrations/ConfigureChannelModal";
import { WebsiteWidgetModal } from "@/components/integrations/WebsiteWidgetModal";
import { useFacebookIntegration } from "@/hooks/integrations/useFacebookIntegration";
import { useInstagramIntegration } from "@/hooks/integrations/useInstagramIntegration";
import { useWhatsAppIntegration } from "@/hooks/integrations/useWhatsAppIntegration";
import {
  useWebsiteIntegration,
  type ConnectPlatformPayload,
} from "@/hooks/integrations/useWebsiteIntegration";

import { FacebookSDK } from "./_components/FacebookSDK";
import { PlatformsHeader, type ExtraPlatformOption } from "./_components/PlatformsHeader";

/**
 * Platforms that have a connect flow of their own — OAuth for Meta, a form for
 * WhatsApp, an embed code for the website widget. Everything else an admin
 * activates goes through the generic connect route, so these must stay out of
 * the "More Channels" list or one platform would appear twice.
 */
const DEDICATED_PLATFORMS = new Set([
  "facebook",
  "n8n_facebook",
  "instagram",
  "whatsapp",
  "website",
]);
import { BotFilterDropdown } from "./_components/BotFilterDropdown";
import { SearchBar } from "./_components/SearchBar";
import { ChannelGrid } from "./_components/ChannelGrid";
import { PlatformsModals } from "./_components/PlatformsModals";

export default function GlobalPlatformsPage() {
  const { t } = useTranslation("integrations");
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Environment variables ──────────────────────────────────────────────────
  const metaAppId =
    process.env.NEXT_PUBLIC_META_APP_ID || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "";
  const facebookAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || metaAppId;
  const whatsappConfigId = process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID || "";

  // ── Core state ─────────────────────────────────────────────────────────────
  const [chatbots, setChatbots] = useState<ChatbotOption[]>([]);
  const [integrations, setIntegrations] = useState<ChannelItem[]>([]);
  const [selectedBotFilter, setSelectedBotFilter] = useState<string>("");
  const [isBotFilterOpen, setIsBotFilterOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Configure Channel Modal state
  const [configuringChannel, setConfiguringChannel] = useState<ChannelItem | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);

  // Connect New Channel dropdown state
  const [isConnectDropdownOpen, setIsConnectDropdownOpen] = useState<boolean>(false);

  // The user must first pick which AI Agent a new channel should be attached to.
  const [connectBotId, setConnectBotId] = useState<string>("");

  /** Generic platforms offered in "Connect New Channel" for the chosen agent. */
  const [extraPlatforms, setExtraPlatforms] = useState<ExtraPlatformOption[]>([]);

  // ── Which agent's channels are on screen ──────────────────────────────────
  // A deep link (`?botId=…`, from the Setup checklist) names the
  // agent the viewer came here to connect. It is derived during render rather
  // than copied into state, so the link still works when this page is already
  // mounted and only the query string changes.
  const requestedBotId = searchParams?.get("botId") ?? "";
  const deepLinkedBotId =
    requestedBotId && chatbots.some((bot) => bot.chatbotId === requestedBotId)
      ? requestedBotId
      : "";

  // Precedence: the viewer's own pick, then the deep link, then any agent at all.
  const activeBotFilter =
    selectedBotFilter || deepLinkedBotId || chatbots[0]?.chatbotId || "";

  // Picking an agent here is the viewer's own decision, so the deep link is
  // dropped — otherwise a refresh would snap the selection back to it.
  const handleSelectBotFilter = (chatbotId: string) => {
    setSelectedBotFilter(chatbotId);
    if (requestedBotId) router.replace("/dashboard/platforms");
  };

  // ── Load Integrations & Chatbots ──────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations");
      const data = await res.json();
      if (res.ok) {
        // The active agent is no longer chosen here — it is derived from the
        // viewer's pick, the `?botId=` deep link, or the first agent, so this
        // callback stays free of selection state and of re-render churn.
        setChatbots(data.chatbots || []);
        setIntegrations(data.integrations || []);
      }
    } catch {
      toast.error("Failed to load channel integrations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(id);
  }, [loadData]);

  // ── Generic connect (Website widget, Telegram, Slack, Custom API, …) ───────
  // One route serves every platform without a dedicated OAuth flow. It answers
  // with the integration row, so a 4xx has to become a throw here — otherwise a
  // failed connect would be reported to the merchant as a success.
  const connectGenericPlatform = useCallback(
    async (platform: string, config: Record<string, unknown> = {}) => {
      const res = await fetch(
        `/api/chatbots/${connectBotId}/integrations/${platform}/connect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config }),
        }
      );
      if (!res.ok) throw new Error(`Failed to connect ${platform}`);
      await loadData();
    },
    [connectBotId, loadData]
  );

  const connectWebsite = useCallback(
    (payload: ConnectPlatformPayload) =>
      connectGenericPlatform(payload.platform, payload.config),
    [connectGenericPlatform]
  );

  const website = useWebsiteIntegration(connectBotId, loadData, connectWebsite);

  // Platforms the admin has switched on for the chosen agent, minus the ones
  // with a dedicated flow and minus the ones already connected — those are
  // cards in the grid below, not candidates for "Connect New Channel".
  useEffect(() => {
    if (!isConnectDropdownOpen || !connectBotId) return;
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(`/api/chatbots/${connectBotId}/integrations`);
        const data = await res.json();
        if (cancelled || !Array.isArray(data)) return;

        setExtraPlatforms(
          data.filter(
            (item: { platform: string; connected?: boolean; coming_soon?: boolean }) =>
              !item.coming_soon &&
              !item.connected &&
              !DEDICATED_PLATFORMS.has(item.platform)
          )
        );
      } catch {
        // Leave the list empty. The dedicated channels still work, and no
        // "More Channels" section beats a wrong one.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isConnectDropdownOpen, connectBotId]);

  // ── Meta OAuth hooks (bound to the chosen connectBotId) ────────────────────
  const {
    fbPages,
    isFbModalOpen,
    setIsFbModalOpen,
    loadingPages,
    selectedPageId,
    setSelectedPageId,
    handleFacebookConnect,
    connectFacebookPage,
    setActiveFbPlatform,
    canUseFacebookSdk,
  } = useFacebookIntegration(connectBotId, facebookAppId, loadData);

  const {
    instagramAccounts,
    instagramPagesWithoutIg,
    instagramManagedPageCount,
    selectedInstagramAccountId,
    setSelectedInstagramAccountId,
    isInstagramModalOpen,
    setIsInstagramModalOpen,
    loadingInstagramAccounts,
    handleInstagramOAuthConnect,
    handleInstagramFacebookConnect,
    connectInstagramAccount,
  } = useInstagramIntegration(connectBotId, facebookAppId, canUseFacebookSdk, loadData);

  const {
    isWaModalOpen,
    setIsWaModalOpen,
    waLoading,
    waForm,
    setWaForm,
    connectWhatsApp,
    startWhatsAppEmbeddedSignup,
  } = useWhatsAppIntegration(connectBotId, metaAppId, whatsappConfigId, canUseFacebookSdk, loadData);

  // ── Channel connect handler ────────────────────────────────────────────────
  // Every platform enters here, whether it has a flow of its own or goes
  // straight through the generic connect route.
  const startChannelConnect = (platform: string) => {
    if (!connectBotId) {
      toast.error(t("selectAgentFirst", "Please select an AI Agent to attach this channel to."));
      return;
    }
    setIsConnectDropdownOpen(false);

    if (platform === "facebook") {
      setActiveFbPlatform("facebook");
      handleFacebookConnect("facebook");
      return;
    }
    if (platform === "instagram") {
      handleInstagramFacebookConnect();
      return;
    }
    if (platform === "whatsapp") {
      setIsWaModalOpen(true);
      return;
    }
    if (platform === "website") {
      void website.handleConnect();
      return;
    }

    // Anything an admin activated that has no dedicated flow: no OAuth, just
    // upsert the integration row.
    void (async () => {
      try {
        await connectGenericPlatform(platform);
        toast.success(t("connectSuccess", "Channel connected successfully"));
      } catch {
        toast.error(t("connectFailed", "Failed to connect the channel. Please try again."));
      }
    })();
  };

  // ── Disconnect Channel ───────────────────────────────────────────────────
  const handleDisconnectChannel = async (channelItem: ChannelItem) => {
    if (
      !confirm(
        `Are you sure you want to disconnect "${channelItem.accountName}"? AI auto-replies will stop for this channel.`
      )
    ) {
      return;
    }

    setIntegrations((prev) =>
      prev.filter(
        (item) => item.integrationId !== channelItem.integrationId && item.id !== channelItem.id
      )
    );

    try {
      await fetch(`/api/integrations/${channelItem.integrationId}`, {
        method: "DELETE",
      });
      toast.success(`Disconnected "${channelItem.accountName}"`);
    } catch {
      toast.error("Failed to disconnect channel.");
    }
  };

  // ── Modal Update Handler ─────────────────────────────────────────────────
  const handleUpdateChannelFromModal = (updatedChannel: ChannelItem) => {
    setIntegrations((prev) =>
      prev.map((item) =>
        item.integrationId === updatedChannel.integrationId || item.id === updatedChannel.id
          ? updatedChannel
          : item
      )
    );
  };

  // ── Filtered Integrations (only show connected channels) ─────────────────
  const filteredIntegrations = integrations.filter((item) => {
    if (!item.connected) return false;
    const matchesBot = item.chatbotId === activeBotFilter;
    const matchesSearch =
      searchQuery.trim() === "" ||
      item.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.platform.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.botName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesBot && matchesSearch;
  });

  const selectedBotName = chatbots.find((b) => b.chatbotId === activeBotFilter)?.name || "";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-12 max-w-7xl mx-auto"
    >
      {/* Facebook JS SDK */}
      <FacebookSDK facebookAppId={facebookAppId} metaAppId={metaAppId} />

      {/* Top Header + Connect New Channel dropdown */}
      <PlatformsHeader
        chatbots={chatbots}
        selectedBotFilter={activeBotFilter}
        isConnectDropdownOpen={isConnectDropdownOpen}
        connectBotId={connectBotId}
        extraPlatforms={extraPlatforms}
        onToggleConnectDropdown={() => setIsConnectDropdownOpen((prev) => !prev)}
        onCloseConnectDropdown={() => setIsConnectDropdownOpen(false)}
        onSetConnectBotId={setConnectBotId}
        onStartChannelConnect={startChannelConnect}
      />

      {/* Toolbar: Filter by Bot + Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BotFilterDropdown
          chatbots={chatbots}
          selectedBotFilter={activeBotFilter}
          isBotFilterOpen={isBotFilterOpen}
          selectedBotName={selectedBotName}
          onToggle={() => setIsBotFilterOpen((prev) => !prev)}
          onSelect={handleSelectBotFilter}
          onClose={() => setIsBotFilterOpen(false)}
        />
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* Connected Channel Cards Grid */}
      <ChannelGrid
        loading={loading}
        filteredIntegrations={filteredIntegrations}
        searchQuery={searchQuery}
        onConfigure={(item) => {
          setConfiguringChannel(item);
          setIsConfigModalOpen(true);
        }}
        onDisconnect={handleDisconnectChannel}
      />

      {/* All Integration Modals */}
      <PlatformsModals
        configure={{
          isOpen: isConfigModalOpen,
          onClose: () => setIsConfigModalOpen(false),
          channel: configuringChannel,
          chatbots,
          onUpdateChannel: handleUpdateChannelFromModal,
        }}
        facebook={{
          open: isFbModalOpen,
          onOpenChange: (open) => {
            setIsFbModalOpen(open);
            if (!open) setSelectedPageId(null);
          },
          loadingPages,
          fbPages,
          selectedPageId,
          onSelectPage: setSelectedPageId,
          onConnect: connectFacebookPage,
        }}
        whatsapp={{
          open: isWaModalOpen,
          onOpenChange: setIsWaModalOpen,
          loading: waLoading,
          embeddedAvailable: Boolean(metaAppId && whatsappConfigId),
          form: waForm,
          onFormChange: setWaForm,
          onEmbeddedConnect: startWhatsAppEmbeddedSignup,
          onManualConnect: connectWhatsApp,
        }}
        instagram={{
          open: isInstagramModalOpen,
          onOpenChange: (open) => {
            setIsInstagramModalOpen(open);
            if (!open) setSelectedInstagramAccountId(null);
          },
          loadingAccounts: loadingInstagramAccounts,
          accounts: instagramAccounts,
          pagesWithoutInstagram: instagramPagesWithoutIg,
          managedPageCount: instagramManagedPageCount,
          selectedAccountId: selectedInstagramAccountId,
          onSelectAccount: setSelectedInstagramAccountId,
          onConnect: connectInstagramAccount,
          onInstagramLoginConnect: handleInstagramOAuthConnect,
          onFacebookConnect: handleInstagramFacebookConnect,
        }}
      />

      {/* Website widget embed code — this flow used to exist only on the retired
          per-chatbot integrations page, which is why Channels now owns it. */}
      <WebsiteWidgetModal
        open={website.isModalOpen}
        onOpenChange={website.setIsModalOpen}
        embedCode={website.embedCode}
        onCopy={website.copyToClipboard}
      />
    </motion.div>
  );
}
