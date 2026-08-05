"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { type ChannelItem, type ChatbotOption } from "@/components/integrations/ConfigureChannelModal";
import { useFacebookIntegration } from "@/hooks/integrations/useFacebookIntegration";
import { useInstagramIntegration } from "@/hooks/integrations/useInstagramIntegration";
import { useWhatsAppIntegration } from "@/hooks/integrations/useWhatsAppIntegration";

import { FacebookSDK } from "./_components/FacebookSDK";
import { IntegrationsHeader } from "./_components/IntegrationsHeader";
import { BotFilterDropdown } from "./_components/BotFilterDropdown";
import { SearchBar } from "./_components/SearchBar";
import { ChannelGrid } from "./_components/ChannelGrid";
import { IntegrationsModals } from "./_components/IntegrationsModals";

export default function GlobalIntegrationsPage() {
  const { t } = useTranslation("integrations");

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

  // ── Load Integrations & Chatbots ──────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations");
      const data = await res.json();
      if (res.ok) {
        const bots = data.chatbots || [];
        setChatbots(bots);
        setIntegrations(data.integrations || []);
        setSelectedBotFilter((prev) => {
          if (prev) return prev;
          return bots.length > 0 ? bots[0].chatbotId : "";
        });
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
  const startChannelConnect = (platform: "facebook" | "instagram" | "whatsapp") => {
    if (!connectBotId) {
      toast.error(t("selectAgentFirst", "Please select an AI Agent to attach this channel to."));
      return;
    }
    setIsConnectDropdownOpen(false);

    if (platform === "facebook") {
      setActiveFbPlatform("facebook");
      handleFacebookConnect("facebook");
    } else if (platform === "instagram") {
      handleInstagramFacebookConnect();
    } else if (platform === "whatsapp") {
      setIsWaModalOpen(true);
    }
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
    const matchesBot = item.chatbotId === selectedBotFilter;
    const matchesSearch =
      searchQuery.trim() === "" ||
      item.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.platform.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.botName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesBot && matchesSearch;
  });

  const selectedBotName = chatbots.find((b) => b.chatbotId === selectedBotFilter)?.name || "";

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
      <IntegrationsHeader
        chatbots={chatbots}
        selectedBotFilter={selectedBotFilter}
        isConnectDropdownOpen={isConnectDropdownOpen}
        connectBotId={connectBotId}
        onToggleConnectDropdown={() => setIsConnectDropdownOpen((prev) => !prev)}
        onCloseConnectDropdown={() => setIsConnectDropdownOpen(false)}
        onSetConnectBotId={setConnectBotId}
        onStartChannelConnect={startChannelConnect}
      />

      {/* Toolbar: Filter by Bot + Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BotFilterDropdown
          chatbots={chatbots}
          selectedBotFilter={selectedBotFilter}
          isBotFilterOpen={isBotFilterOpen}
          selectedBotName={selectedBotName}
          onToggle={() => setIsBotFilterOpen((prev) => !prev)}
          onSelect={setSelectedBotFilter}
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
      <IntegrationsModals
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
    </motion.div>
  );
}
