"use client";

import { useState, useEffect, useCallback } from "react";
import Script from "next/script";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plug,
  Bot,
  CheckCircle2,
  AlertCircle,
  Settings,
  Trash2,
  ChevronDown,
  Check,
  Search,
  Plus,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  FacebookIcon,
  WhatsAppIcon,
  InstagramIcon,
  WebsiteWidgetIcon,
} from "@/components/icons/PlatformIcons";
import {
  ConfigureChannelModal,
  ChannelItem,
  ChatbotOption,
} from "@/components/integrations/ConfigureChannelModal";
import { FacebookModal } from "@/components/integrations/FacebookModal";
import { InstagramModal } from "@/components/integrations/InstagramModal";
import { WhatsAppModal } from "@/components/integrations/WhatsAppModal";
import { useFacebookIntegration } from "@/hooks/integrations/useFacebookIntegration";
import { useInstagramIntegration } from "@/hooks/integrations/useInstagramIntegration";
import { useWhatsAppIntegration } from "@/hooks/integrations/useWhatsAppIntegration";

export default function GlobalIntegrationsPage() {
  const { t } = useTranslation("integrations");

  // Meta / Facebook SDK configuration (shared with per-chatbot integrations page)
  const metaAppId =
    process.env.NEXT_PUBLIC_META_APP_ID || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "";
  const facebookAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || metaAppId;
  const whatsappConfigId = process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID || "";

  const [chatbots, setChatbots] = useState<ChatbotOption[]>([]);
  const [integrations, setIntegrations] = useState<ChannelItem[]>([]);
  const [selectedBotFilter, setSelectedBotFilter] = useState<string>("all");
  const [isBotFilterOpen, setIsBotFilterOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Quick bot reassign dropdown per card
  const [openCardDropdownId, setOpenCardDropdownId] = useState<string | null>(null);

  // Configure Channel Modal State
  const [configuringChannel, setConfiguringChannel] = useState<ChannelItem | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);

  // Connect New Channel Dropdown State
  const [isConnectDropdownOpen, setIsConnectDropdownOpen] = useState<boolean>(false);

  // Global panel has no chatbotId in the route, so the user must first pick which
  // AI Agent a new channel should be attached to. `connectBotId` holds that choice
  // and is fed into the Meta OAuth hooks below.
  const [connectBotId, setConnectBotId] = useState<string>("");

  // ── Load Integrations & Chatbots ──────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations");
      const data = await res.json();
      if (res.ok) {
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
    // Defer to a microtask so the initial fetch's synchronous setLoading(true)
    // runs outside the effect body (avoids react-hooks/set-state-in-effect and
    // mirrors the deferral used in the per-chatbot useIntegrationsData hook).
    const id = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(id);
  }, [loadData]);

  // ── Meta OAuth hooks (bound to the chosen connectBotId) ────────────────────
  // Reused verbatim from the per-chatbot integrations page. When connectBotId is
  // empty the hooks are inert; a channel connect only fires after an agent is
  // picked in the "Connect New Channel" flow. On success each hook calls loadData
  // to refresh the channel cards.
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

  // Launch a channel's OAuth/setup flow for the chosen agent. `connectBotId` state
  // is set synchronously here; the platform handlers read the id from closure via
  // the hooks, so we pass the freshly-picked id explicitly where needed.
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


  // ── Quick Bot Reassignment ────────────────────────────────────────────────
  const handleReassignBot = async (integrationId: string, newBotId: string) => {
    const targetBot = chatbots.find((b) => b.chatbotId === newBotId);
    if (!targetBot) return;

    // Optimistic UI update
    setIntegrations((prev) =>
      prev.map((item) =>
        item.integrationId === integrationId || item.id === integrationId
          ? {
              ...item,
              chatbotId: newBotId,
              botName: targetBot.name,
            }
          : item
      )
    );

    setOpenCardDropdownId(null);

    try {
      const res = await fetch(`/api/integrations/${integrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatbotId: newBotId }),
      });

      if (res.ok) {
        toast.success(`Assigned to "${targetBot.name}" successfully!`);
      } else {
        toast.error("Failed to update bot mapping on server.");
      }
    } catch {
      toast.error("Failed to update bot mapping.");
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

  // ── Filtered Integrations ─────────────────────────────────────────────────
  const filteredIntegrations = integrations.filter((item) => {
    const matchesBot =
      selectedBotFilter === "all" || item.chatbotId === selectedBotFilter;
    const matchesSearch =
      searchQuery.trim() === "" ||
      item.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.platform.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.botName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesBot && matchesSearch;
  });

  const getPlatformIcon = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes("facebook") || p.includes("fb"))
      return { icon: FacebookIcon, color: "text-[#1877F2]", bg: "bg-[#1877F2]/10" };
    if (p.includes("instagram") || p.includes("ig"))
      return { icon: InstagramIcon, color: "text-[#E1306C]", bg: "bg-[#E1306C]/10" };
    if (p.includes("whatsapp"))
      return { icon: WhatsAppIcon, color: "text-[#25D366]", bg: "bg-[#25D366]/10" };
    return { icon: WebsiteWidgetIcon, color: "text-violet-500", bg: "bg-violet-500/10" };
  };

  const selectedBotName =
    selectedBotFilter === "all"
      ? t("allBots", "All Bots (Workspace)")
      : chatbots.find((b) => b.chatbotId === selectedBotFilter)?.name || "Selected Bot";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-12 max-w-7xl mx-auto"
    >
      {/* Facebook JS SDK — required for Meta OAuth (Facebook Page / Instagram / WhatsApp) */}
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="lazyOnload"
        onLoad={() => {
          if (!facebookAppId) {
            console.error("Facebook SDK loaded but NEXT_PUBLIC_FACEBOOK_APP_ID is missing.");
            return;
          }
          if (window.FB) {
            window.FB.init({
              appId: metaAppId || facebookAppId,
              cookie: true,
              xfbml: true,
              version: "v20.0",
            });
          }
        }}
      />

      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Plug className="w-6 h-6 text-primary" />
            {t("title", "Channel Integrations & Bot Mapping")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "subtitle",
              "Connect Meta Pages, Instagram DMs, and WhatsApp numbers and map them to your designated AI Agents."
            )}
          </p>
        </div>

        {/* Action Button Dropdown */}
        <div className="relative">
          <Button
            onClick={() =>
              setIsConnectDropdownOpen((prev) => {
                const next = !prev;
                // If a specific agent is already active in the left "Filter by Bot",
                // attach the new channel to it directly and skip the agent-picker.
                // Only fall back to Step 1 when the filter is on "All Bots".
                if (next) {
                  setConnectBotId(selectedBotFilter === "all" ? "" : selectedBotFilter);
                }
                return next;
              })
            }
            className="gap-2 bg-gradient-to-r from-violet-600 to-blue-500 hover:opacity-90 text-white border-none shadow-md cursor-pointer font-semibold"
          >
            <Plus className="w-4 h-4" />
            {t("connectNewChannel", "Connect New Channel")}
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isConnectDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </Button>

          <AnimatePresence>
            {isConnectDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsConnectDropdownOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-80 bg-card border border-border/80 rounded-xl shadow-xl z-40 p-2 space-y-1"
                >
                  {/* ── Step 1: Choose which AI Agent the channel attaches to ── */}
                  {!connectBotId ? (
                    <>
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 border-b border-border/40 mb-1">
                        {t("selectAgentStep", "Step 1 — Select AI Agent")}
                      </div>
                      {chatbots.length === 0 ? (
                        <p className="px-3 py-4 text-[11px] text-muted-foreground text-center">
                          {t(
                            "noAgentsForConnect",
                            "Create an AI Agent first before connecting a channel."
                          )}
                        </p>
                      ) : (
                        chatbots.map((bot) => (
                          <button
                            key={bot.chatbotId}
                            type="button"
                            onClick={() => setConnectBotId(bot.chatbotId)}
                            className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left cursor-pointer"
                          >
                            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                              <Bot className="w-4 h-4 text-violet-500" />
                            </div>
                            <span className="text-xs font-bold text-foreground truncate">
                              {bot.name}
                            </span>
                          </button>
                        ))
                      )}
                    </>
                  ) : (
                    /* ── Step 2: Choose the channel platform (fires OAuth) ── */
                    <>
                      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border/40 mb-1">
                        {selectedBotFilter === "all" && (
                          <button
                            type="button"
                            onClick={() => setConnectBotId("")}
                            className="p-1 rounded-md hover:bg-muted/60 transition-colors cursor-pointer"
                            title={t("back", "Back")}
                          >
                            <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 truncate">
                          {selectedBotFilter === "all"
                            ? t("selectPlatformStep", "Step 2 — Select Platform")
                            : t("selectPlatform", "Select Platform")}
                          {" · "}
                          {chatbots.find((b) => b.chatbotId === connectBotId)?.name}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => startChannelConnect("facebook")}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left group cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#1877F2]/10 flex items-center justify-center">
                            <FacebookIcon className="w-4 h-4 text-[#1877F2]" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-foreground">Facebook Page</h4>
                            <p className="text-[11px] text-muted-foreground">Connect Meta Facebook Page</p>
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>

                      <button
                        type="button"
                        onClick={() => startChannelConnect("instagram")}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left group cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#E1306C]/10 flex items-center justify-center">
                            <InstagramIcon className="w-4 h-4 text-[#E1306C]" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-foreground">Instagram DM</h4>
                            <p className="text-[11px] text-muted-foreground">Link Instagram Business Account</p>
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>

                      <button
                        type="button"
                        onClick={() => startChannelConnect("whatsapp")}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left group cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
                            <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-foreground">WhatsApp Business API</h4>
                            <p className="text-[11px] text-muted-foreground">Connect Official WABA Phone Number</p>
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>
                    </>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Toolbar: Filter by Bot + Search Bar ─────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Filter by Bot Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsBotFilterOpen((prev) => !prev)}
            className="flex items-center gap-2.5 bg-card hover:bg-muted/40 border border-border/80 rounded-xl px-3.5 py-2.5 shadow-xs transition-all cursor-pointer"
          >
            <Bot className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs text-muted-foreground font-medium shrink-0">
              {t("filterByBot", "Filter by Bot")}:
            </span>
            <span className="text-xs font-bold text-foreground max-w-[160px] truncate">
              {selectedBotName}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${
                isBotFilterOpen ? "rotate-180 text-primary" : ""
              }`}
            />
          </button>

          <AnimatePresence>
            {isBotFilterOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsBotFilterOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-1.5 w-64 bg-card border border-border/80 rounded-xl shadow-xl z-40 p-1.5 space-y-0.5"
                >
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 border-b border-border/40 mb-1">
                    Select Active Agent
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBotFilter("all");
                      setIsBotFilterOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      selectedBotFilter === "all"
                        ? "bg-primary/10 text-primary font-bold"
                        : "text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Plug className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{t("allBots", "All Bots (Workspace)")}</span>
                    </div>
                    {selectedBotFilter === "all" && (
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                    )}
                  </button>

                  {chatbots.map((bot) => {
                    const isSelected = bot.chatbotId === selectedBotFilter;
                    return (
                      <button
                        key={bot.chatbotId}
                        type="button"
                        onClick={() => {
                          setSelectedBotFilter(bot.chatbotId);
                          setIsBotFilterOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          isSelected
                            ? "bg-primary/10 text-primary font-bold"
                            : "text-foreground hover:bg-muted/60"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Bot
                            className={`w-3.5 h-3.5 ${
                              isSelected ? "text-primary" : "text-muted-foreground"
                            }`}
                          />
                          <span className="truncate">{bot.name}</span>
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Search Bar */}
        <div className="bg-card border border-border/70 rounded-xl px-3 py-2 flex items-center gap-2 min-w-[280px]">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder={t("searchPlaceholder", "Search channels by name or handle...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* ── Connected Channel Cards Grid ────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-44 bg-card/60 animate-pulse border border-border/40 rounded-xl p-5"
            />
          ))}
        </div>
      ) : filteredIntegrations.length === 0 ? (
        <div className="bg-card border border-border/60 rounded-2xl p-12 text-center space-y-3">
          <Plug className="w-10 h-10 mx-auto opacity-20 text-primary" />
          <h3 className="text-base font-bold text-foreground">No channels found</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {searchQuery
              ? "No channels match your search query. Try adjusting your search."
              : "No channel integrations connected for the selected bot filter. Click \"Connect New Channel\" to link your Meta or WhatsApp accounts."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredIntegrations.map((item) => {
            const platformDetails = getPlatformIcon(item.platform);
            const Icon = platformDetails.icon;
            const isDropdownOpen = openCardDropdownId === (item.integrationId || item.id);

            return (
              <motion.div
                key={item.integrationId || item.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-card border border-border/60 rounded-xl p-5 space-y-4 shadow-xs hover:border-border transition-all"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl ${platformDetails.bg} flex items-center justify-center border border-border/40`}
                    >
                      <Icon className={`w-6 h-6 ${platformDetails.color}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">
                        {item.accountName}
                      </h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <span className="capitalize">{item.platform}</span>
                        {item.accountId && (
                          <span className="text-[10px] font-mono text-muted-foreground/70 bg-muted/60 px-1.5 py-0.5 rounded">
                            {item.accountId}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {item.connected && item.status === "active" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" />
                      {t("active", "Active")}
                    </span>
                  ) : item.status === "error" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      <AlertCircle className="w-3 h-3" />
                      {t("needsReauth", "Needs Re-auth")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/15 text-destructive border border-destructive/30">
                      <AlertCircle className="w-3 h-3" />
                      {t("disconnected", "Disconnected")}
                    </span>
                  )}
                </div>

                {/* Agent Assignment & Quick Action Controls */}
                <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-3 relative">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-violet-400 shrink-0" />
                    <span className="text-xs text-muted-foreground font-semibold">
                      {t("assignedAgent", "Assigned Agent")}:
                    </span>

                    {/* Quick Bot Selector Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenCardDropdownId(
                            isDropdownOpen ? null : item.integrationId || item.id
                          )
                        }
                        className="flex items-center gap-1.5 bg-muted/60 hover:bg-muted border border-border/60 rounded-lg px-2.5 py-1 text-xs font-bold text-foreground transition-all cursor-pointer"
                      >
                        <span className="truncate max-w-[130px]">{item.botName}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${
                            isDropdownOpen ? "rotate-180 text-primary" : ""
                          }`}
                        />
                      </button>

                      <AnimatePresence>
                        {isDropdownOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-30"
                              onClick={() => setOpenCardDropdownId(null)}
                            />
                            <motion.div
                              initial={{ opacity: 0, y: 4, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 4, scale: 0.98 }}
                              className="absolute left-0 top-full mt-1 w-52 bg-card border border-border/80 rounded-xl shadow-xl z-40 p-1 space-y-0.5 overflow-hidden"
                            >
                              <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-b border-border/40 mb-1">
                                Reassign AI Agent
                              </div>
                              {chatbots.map((bot) => {
                                const isSelected = bot.chatbotId === item.chatbotId;
                                return (
                                  <button
                                    key={bot.chatbotId}
                                    type="button"
                                    onClick={() =>
                                      handleReassignBot(
                                        item.integrationId || item.id,
                                        bot.chatbotId
                                      )
                                    }
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                      isSelected
                                        ? "bg-primary/10 text-primary font-bold"
                                        : "hover:bg-muted/60 text-foreground"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <Bot
                                        className={`w-3.5 h-3.5 ${
                                          isSelected ? "text-primary" : "text-muted-foreground"
                                        }`}
                                      />
                                      <span className="truncate">{bot.name}</span>
                                    </div>
                                    {isSelected && (
                                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Actions: Configure & Disconnect */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setConfiguringChannel(item);
                        setIsConfigModalOpen(true);
                      }}
                      className="p-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/60 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      title="Configure channel settings"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>{t("configure", "Configure")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDisconnectChannel(item)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border/60 rounded-lg transition-colors cursor-pointer"
                      title="Disconnect channel"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Configure Channel Modal ─────────────────────────────────────────── */}
      <ConfigureChannelModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        channel={configuringChannel}
        chatbots={chatbots}
        onUpdateChannel={handleUpdateChannelFromModal}
      />

      {/* ── Meta Connect Flow Modals (shared with per-chatbot page) ──────────── */}
      <FacebookModal
        open={isFbModalOpen}
        onOpenChange={(open) => {
          setIsFbModalOpen(open);
          if (!open) setSelectedPageId(null);
        }}
        loadingPages={loadingPages}
        fbPages={fbPages}
        selectedPageId={selectedPageId}
        onSelectPage={setSelectedPageId}
        onConnect={connectFacebookPage}
      />

      <WhatsAppModal
        open={isWaModalOpen}
        onOpenChange={setIsWaModalOpen}
        loading={waLoading}
        embeddedAvailable={Boolean(metaAppId && whatsappConfigId)}
        form={waForm}
        onFormChange={setWaForm}
        onEmbeddedConnect={startWhatsAppEmbeddedSignup}
        onManualConnect={connectWhatsApp}
      />

      <InstagramModal
        open={isInstagramModalOpen}
        onOpenChange={(open) => {
          setIsInstagramModalOpen(open);
          if (!open) setSelectedInstagramAccountId(null);
        }}
        loadingAccounts={loadingInstagramAccounts}
        accounts={instagramAccounts}
        pagesWithoutInstagram={instagramPagesWithoutIg}
        managedPageCount={instagramManagedPageCount}
        selectedAccountId={selectedInstagramAccountId}
        onSelectAccount={setSelectedInstagramAccountId}
        onConnect={connectInstagramAccount}
        onInstagramLoginConnect={handleInstagramOAuthConnect}
        onFacebookConnect={handleInstagramFacebookConnect}
      />
    </motion.div>
  );
}
