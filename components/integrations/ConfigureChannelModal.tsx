"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  MessageSquare,
  RefreshCcw,
  ShieldCheck,
  Sliders,
  X,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  FacebookIcon,
  InstagramIcon,
  WebsiteWidgetIcon,
  WhatsAppIcon,
} from "@/components/icons/PlatformIcons";

export interface ChannelItem {
  id: string;
  integrationId: string;
  chatbotId: string;
  botName: string;
  platform: string;
  accountName: string;
  accountId?: string;
  connected: boolean;
  status: string;
  lastError?: string | null;
  connectedAt?: string | null;
  config: {
    muteAiOnHandover?: boolean;
    directMessagingAiEnabled?: boolean;
    tokenStatus?: string;
    pageId?: string;
    commentReply?: {
      enabled?: boolean;
      sendPrivateDM?: boolean;
      keywords?: string;
      fixedMessage?: string;
    };
    [key: string]: any;
  };
}

export interface ChatbotOption {
  id?: string;
  chatbotId: string;
  name: string;
}

interface ConfigureChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: ChannelItem | null;
  chatbots: ChatbotOption[];
  onUpdateChannel: (updatedChannel: ChannelItem) => void;
}

type ModalTab = "general" | "permissions" | "webhook";

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors ${
        checked ? "bg-primary" : "bg-muted-foreground/30"
      }`}
      aria-pressed={checked}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`h-4 w-4 rounded-full bg-white shadow-xs ${checked ? "ml-auto" : "ml-0"}`}
      />
    </button>
  );
}

function getPlatformIcon(platform: string) {
  const normalized = platform.toLowerCase();
  if (normalized.includes("facebook") || normalized.includes("fb")) return FacebookIcon;
  if (normalized.includes("instagram") || normalized.includes("ig")) return InstagramIcon;
  if (normalized.includes("whatsapp")) return WhatsAppIcon;
  return WebsiteWidgetIcon;
}

export function ConfigureChannelModal({
  isOpen,
  onClose,
  channel,
  chatbots,
  onUpdateChannel,
}: ConfigureChannelModalProps) {
  const { t } = useTranslation("integrations");
  const [activeTab, setActiveTab] = useState<ModalTab>("general");
  const [selectedBotId, setSelectedBotId] = useState("");
  const [muteAiOnHandover, setMuteAiOnHandover] = useState(true);
  const [directMessagingAiEnabled, setDirectMessagingAiEnabled] = useState(true);
  const [commentAutomationEnabled, setCommentAutomationEnabled] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [syncingWebhook, setSyncingWebhook] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isBotDropdownOpen, setIsBotDropdownOpen] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{
    latencyMs?: number;
    testedAt?: string;
    tokenStatus?: string;
  } | null>(null);

  useEffect(() => {
    if (!channel) return;

    setActiveTab("general");
    setSelectedBotId(channel.chatbotId);
    setMuteAiOnHandover(channel.config?.muteAiOnHandover ?? true);
    setDirectMessagingAiEnabled(channel.config?.directMessagingAiEnabled ?? true);
    setCommentAutomationEnabled(channel.config?.commentReply?.enabled ?? false);
    setWebhookResult(null);
  }, [channel]);

  if (!isOpen || !channel) return null;

  const IconComponent = getPlatformIcon(channel.platform);
  const normalizedPlatform = channel.platform.toLowerCase();
  const isFacebookChannel = normalizedPlatform.includes("facebook") || normalizedPlatform.includes("fb");
  const pageId = channel.config?.pageId || channel.accountId || channel.id;
  const selectedBotName =
    chatbots.find((bot) => bot.chatbotId === selectedBotId)?.name ||
    t("general.chooseAgent", "Choose AI Agent");
  const tokenStatus = webhookResult?.tokenStatus || channel.config?.tokenStatus || "valid";
  const tokenHealthy = !/expired|invalid|error/i.test(tokenStatus);

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    try {
      const res = await fetch(`/api/integrations/${channel.integrationId}/test-webhook`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t("webhook.testError", "Webhook connection test failed."));
      }

      setWebhookResult({
        latencyMs: data.latencyMs,
        testedAt: new Date().toLocaleTimeString(),
        tokenStatus: data.tokenStatus,
      });
      toast.success(t("webhook.testSuccess", "Webhook endpoint responded with HTTP 200 OK!"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("webhook.testError", "Webhook connection test failed."));
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleSyncWebhook = async () => {
    if (!isFacebookChannel || !pageId) {
      toast.error(t("webhook.syncUnavailable", "Webhook sync is available for connected Facebook Pages only."));
      return;
    }

    setSyncingWebhook(true);
    try {
      const res = await fetch("/api/integrations/facebook/sync-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatbotId: channel.chatbotId,
          pageId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t("webhook.syncError", "Facebook webhook sync failed."));
      }

      toast.success(data.message || t("webhook.syncSuccess", "Page webhooks & message echoes synced successfully!"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("webhook.syncError", "Facebook webhook sync failed."));
    } finally {
      setSyncingWebhook(false);
    }
  };

  const handleReconnectPageToken = () => {
    toast.info(
      t(
        "general.reconnectPageTokenInfo",
        "Use Connect New Channel to refresh this Page token, then sync webhooks again."
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const selectedBot = chatbots.find((bot) => bot.chatbotId === selectedBotId);
      const newBotName = selectedBot ? selectedBot.name : channel.botName;
      const updatedConfig = {
        ...channel.config,
        muteAiOnHandover,
        directMessagingAiEnabled,
        commentReply: {
          ...(channel.config?.commentReply || {}),
          enabled: commentAutomationEnabled,
        },
      };

      const res = await fetch(`/api/integrations/${channel.integrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatbotId: selectedBotId,
          config: updatedConfig,
        }),
      });

      if (!res.ok) {
        throw new Error(t("actions.saveError", "Failed to save channel settings."));
      }

      onUpdateChannel({
        ...channel,
        chatbotId: selectedBotId,
        botName: newBotName,
        config: updatedConfig,
      });
      toast.success(t("actions.saveSuccess", "Channel settings updated successfully!"));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("actions.saveError", "Failed to save channel settings."));
    } finally {
      setSaving(false);
    }
  };

  const subscriptionItems = [
    "messages (Direct Chat)",
    "message_echoes (Business Suite Sync)",
    "messaging_postbacks (Interactive Buttons)",
    "feed/comments (Post Comments)",
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.18 }}
          className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-border/50 bg-secondary/10 px-6 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-muted/80">
                <IconComponent className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-foreground">{channel.accountName}</h2>
                <p className="text-xs text-muted-foreground">
                  {t("modalTitle", "Channel Configuration")} - {channel.platform}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
              aria-label={t("actions.close", "Close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto border-b border-border/50 bg-secondary/5 px-6">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`flex items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition-all ${
                activeTab === "general"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sliders className="h-4 w-4" />
              {t("tabs.general", "General & Bot Assignment")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("permissions")}
              className={`flex items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition-all ${
                activeTab === "permissions"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              {t("tabs.channelPermissions", "Channel Permissions")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("webhook")}
              className={`flex items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition-all ${
                activeTab === "webhook"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Activity className="h-4 w-4" />
              {t("tabs.webhookSyncHealth", "Webhook & Sync Health")}
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            {activeTab === "general" && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Bot className="h-4 w-4 text-primary" />
                    {t("general.selectAgent", "Select Assigned AI Agent")}
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsBotDropdownOpen((open) => !open)}
                      className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-border/80 bg-muted/50 px-4 py-2.5 text-xs font-semibold text-foreground transition-all hover:bg-muted"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Bot className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate">{selectedBotName}</span>
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${
                          isBotDropdownOpen ? "rotate-180 text-primary" : ""
                        }`}
                      />
                    </button>

                    <AnimatePresence>
                      {isBotDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setIsBotDropdownOpen(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: 4, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.98 }}
                            className="absolute left-0 right-0 top-full z-40 mt-1.5 space-y-0.5 rounded-xl border border-border/80 bg-card p-1 shadow-xl"
                          >
                            {chatbots.map((bot) => {
                              const selected = bot.chatbotId === selectedBotId;
                              return (
                                <button
                                  key={bot.chatbotId}
                                  type="button"
                                  onClick={() => {
                                    setSelectedBotId(bot.chatbotId);
                                    setIsBotDropdownOpen(false);
                                  }}
                                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                                    selected ? "bg-primary/10 font-bold text-primary" : "text-foreground hover:bg-muted/60"
                                  }`}
                                >
                                  <span className="flex min-w-0 items-center gap-2">
                                    <Bot className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{bot.name}</span>
                                  </span>
                                  {selected && <Check className="h-4 w-4 text-primary" />}
                                </button>
                              );
                            })}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 p-4">
                  <div className="space-y-1">
                    <h4 className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      {t("general.muteAiOnHandover", "Mute AI on Human Takeover")}
                    </h4>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {t(
                        "general.handoverDesc",
                        "Automatically pause AI auto-replies when a human agent takes over or sends a manual response in Live Inbox."
                      )}
                    </p>
                  </div>
                  <ToggleSwitch checked={muteAiOnHandover} onChange={() => setMuteAiOnHandover((value) => !value)} />
                </div>

                <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 text-xs">
                  <div className="flex flex-col gap-3 border-b border-border/40 pb-3 sm:flex-row sm:items-center sm:justify-between">
                    <h4 className="font-bold text-foreground">{t("general.channelDetails", "Channel Connection Details")}</h4>
                    <Button type="button" variant="outline" size="sm" onClick={handleReconnectPageToken} className="h-8 gap-2 text-xs">
                      <RefreshCcw className="h-3.5 w-3.5" />
                      {t("general.reconnectPageToken", "Re-connect Page Token")}
                    </Button>
                  </div>
                  <div className="grid gap-2 pt-1 text-muted-foreground sm:grid-cols-2">
                    <div>
                      <span className="font-medium text-foreground">{t("general.platform", "Platform")}:</span>{" "}
                      {channel.platform}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">{t("general.accountHandle", "Account Handle")}:</span>{" "}
                      {channel.accountName}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">{t("general.accountId", "Account ID")}:</span>{" "}
                      {channel.accountId || channel.id}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">{t("general.connected", "Connected")}:</span>{" "}
                      {channel.connectedAt ? new Date(channel.connectedAt).toLocaleDateString() : t("active", "Active")}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "permissions" && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 p-4">
                  <div className="space-y-1">
                    <h4 className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      {t("channelPermissions.directMessagingAi", "Enable Direct Messaging AI (Messenger)")}
                    </h4>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {t(
                        "channelPermissions.directMessagingAiDesc",
                        "Allow the assigned AI Agent to respond to Messenger direct chats for this channel."
                      )}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={directMessagingAiEnabled}
                    onChange={() => setDirectMessagingAiEnabled((value) => !value)}
                  />
                </div>

                <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 p-4">
                  <div className="space-y-1">
                    <h4 className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <Zap className="h-4 w-4 text-primary" />
                      {t("channelPermissions.commentAutomation", "Enable Comment Automation (Post Comments)")}
                    </h4>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {t(
                        "channelPermissions.commentAutomationDesc",
                        "Allow automated handling for Facebook or Instagram post comments on this channel."
                      )}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={commentAutomationEnabled}
                    onChange={() => setCommentAutomationEnabled((value) => !value)}
                  />
                </div>

                <div className="flex gap-3 rounded-xl border border-border/70 bg-primary/5 p-4 text-xs text-muted-foreground dark:bg-primary/10">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="leading-relaxed">
                    {t(
                      "channelPermissions.automationNote",
                      "Note: Configure detailed comment keywords, triggers, and reply templates under the Automations tab."
                    )}
                  </p>
                </div>
              </motion.div>
            )}

            {activeTab === "webhook" && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h4 className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      {t("webhook.metaTokenStatus", "Meta Access Token Status")}
                    </h4>
                    <span
                      className={`inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                        tokenHealthy
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-destructive/30 bg-destructive/10 text-destructive"
                      }`}
                    >
                      {tokenHealthy ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                      {tokenHealthy ? t("webhook.tokenValid", "Active & Valid") : t("webhook.tokenExpired", "Token Expired")}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {t(
                      "webhook.listenerDesc",
                      "Meta webhook listener is active and receiving real-time events for this channel."
                    )}
                  </p>
                </div>

                <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-4">
                  <h4 className="text-xs font-bold text-foreground">
                    {t("webhook.subscriptions", "Webhook Event Subscriptions")}
                  </h4>
                  <div className="grid gap-2 pt-1 text-xs text-muted-foreground sm:grid-cols-2">
                    {subscriptionItems.map((item) => (
                      <div key={item} className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">
                        {t("webhook.syncTitle", "Webhook & Echo Sync")}
                      </h4>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {t(
                          "webhook.syncDesc",
                          "Subscribe this Page to messages, message echoes, postbacks, and feed events."
                        )}
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleSyncWebhook}
                      disabled={syncingWebhook || !isFacebookChannel}
                      size="sm"
                      className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {syncingWebhook ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                      {syncingWebhook
                        ? t("webhook.syncing", "Syncing...")
                        : t("webhook.syncButton", "Sync Webhook & Echoes")}
                    </Button>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">
                        {t("webhook.testWebhook", "Test Webhook Connection")}
                      </h4>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {t("webhook.testDesc", "Ping the webhook endpoint to verify latency and delivery health.")}
                      </p>
                    </div>
                    <Button type="button" onClick={handleTestWebhook} disabled={testingWebhook} size="sm" variant="outline" className="gap-2">
                      <RefreshCcw className={`h-3.5 w-3.5 ${testingWebhook ? "animate-spin" : ""}`} />
                      {testingWebhook ? t("webhook.testingButton", "Testing...") : t("webhook.testConnection", "Test Connection")}
                    </Button>
                  </div>

                  {webhookResult && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-1 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-primary"
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{t("webhook.connected", "HTTP 200 OK - Webhook Connected")}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {t("webhook.latency", "Latency")}: {webhookResult.latencyMs}ms -{" "}
                        {t("webhook.testedAt", "Tested at")} {webhookResult.testedAt}
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border/50 bg-secondary/10 px-6 py-4">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              {t("actions.cancel", "Cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {saving ? t("actions.saving", "Saving...") : t("actions.saveChanges", "Save Configuration")}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
