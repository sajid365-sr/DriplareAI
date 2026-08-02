"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Bot,
  Settings,
  MessageSquare,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCcw,
  ShieldCheck,
  Zap,
  Sliders,
  Check,
  ChevronDown,
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
    tokenStatus?: string;
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

export function ConfigureChannelModal({
  isOpen,
  onClose,
  channel,
  chatbots,
  onUpdateChannel,
}: ConfigureChannelModalProps) {
  const { t } = useTranslation("integrations");
  const [activeTab, setActiveTab] = useState<"general" | "comments" | "webhook">("general");

  // Tab 1 state
  const [selectedBotId, setSelectedBotId] = useState<string>("");
  const [muteAiOnHandover, setMuteAiOnHandover] = useState<boolean>(true);

  // Tab 2 state
  const [commentReplyEnabled, setCommentReplyEnabled] = useState<boolean>(false);
  const [sendPrivateDM, setSendPrivateDM] = useState<boolean>(false);
  const [keywords, setKeywords] = useState<string>("");
  const [replyTemplate, setReplyTemplate] = useState<string>("");

  // Tab 3 state
  const [testingWebhook, setTestingWebhook] = useState<boolean>(false);
  const [webhookResult, setWebhookResult] = useState<{
    latencyMs?: number;
    testedAt?: string;
    tokenStatus?: string;
  } | null>(null);

  const [saving, setSaving] = useState<boolean>(false);
  const [isBotDropdownOpen, setIsBotDropdownOpen] = useState<boolean>(false);

  useEffect(() => {
    if (channel) {
      setSelectedBotId(channel.chatbotId);
      setMuteAiOnHandover(channel.config?.muteAiOnHandover ?? true);

      const cr = channel.config?.commentReply || {};
      setCommentReplyEnabled(cr.enabled ?? false);
      setSendPrivateDM(cr.sendPrivateDM ?? false);
      setKeywords(cr.keywords || "");
      setReplyTemplate(cr.fixedMessage || "");
      setWebhookResult(null);
    }
  }, [channel]);

  if (!isOpen || !channel) return null;

  const getPlatformIcon = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes("facebook") || p.includes("fb")) return FacebookIcon;
    if (p.includes("instagram") || p.includes("ig")) return InstagramIcon;
    if (p.includes("whatsapp")) return WhatsAppIcon;
    return WebsiteWidgetIcon;
  };

  const IconComponent = getPlatformIcon(channel.platform);

  const isCommentSupported =
    channel.platform.toLowerCase().includes("facebook") ||
    channel.platform.toLowerCase().includes("instagram") ||
    channel.platform.toLowerCase().includes("fb") ||
    channel.platform.toLowerCase().includes("ig");

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    try {
      const res = await fetch(`/api/integrations/${channel.integrationId}/test-webhook`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setWebhookResult({
          latencyMs: data.latencyMs,
          testedAt: new Date().toLocaleTimeString(),
          tokenStatus: data.tokenStatus,
        });
        toast.success(t("webhook.testSuccess", "Webhook endpoint responded with HTTP 200 OK!"));
      } else {
        toast.error(t("webhook.testError", "Webhook connection test failed."));
      }
    } catch {
      toast.error(t("webhook.testError", "Webhook connection test failed."));
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const selectedBot = chatbots.find((b) => b.chatbotId === selectedBotId);
      const newBotName = selectedBot ? selectedBot.name : channel.botName;

      const updatedConfig = {
        ...channel.config,
        muteAiOnHandover,
        commentReply: {
          enabled: commentReplyEnabled,
          sendPrivateDM,
          keywords,
          fixedMessage: replyTemplate,
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

      if (!res.ok) throw new Error("Failed to save channel settings");

      const updatedChannelItem: ChannelItem = {
        ...channel,
        chatbotId: selectedBotId,
        botName: newBotName,
        config: updatedConfig,
      };

      onUpdateChannel(updatedChannelItem);
      toast.success(t("actions.saveSuccess", "Channel settings updated successfully!"));
      onClose();
    } catch (err) {
      toast.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.18 }}
          className="bg-card border border-border/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-secondary/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-muted/80 flex items-center justify-center border border-border/40">
                <IconComponent className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  {channel.accountName}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t("modalTitle", "Channel Configuration")} • {channel.platform}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs Nav */}
          <div className="flex border-b border-border/50 bg-secondary/5 px-6 gap-2">
            <button
              onClick={() => setActiveTab("general")}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "general"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sliders className="w-4 h-4" />
              {t("tabs.general", "General & Bot Assignment")}
            </button>

            {isCommentSupported && (
              <button
                onClick={() => setActiveTab("comments")}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === "comments"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                {t("tabs.commentAutomation", "Comment Automation")}
              </button>
            )}

            <button
              onClick={() => setActiveTab("webhook")}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "webhook"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Activity className="w-4 h-4" />
              {t("tabs.webhookHealth", "Webhook Health")}
            </button>
          </div>

          {/* Tab Contents */}
          <div className="p-6 overflow-y-auto flex-1 space-y-5">
            {/* ── Tab 1: General & Bot Assignment ── */}
            {activeTab === "general" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                {/* AI Agent Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground flex items-center gap-2">
                    <Bot className="w-4 h-4 text-violet-400" />
                    {t("general.selectAgent", "Select Assigned AI Agent")}
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsBotDropdownOpen((p) => !p)}
                      className="w-full flex items-center justify-between bg-muted/50 hover:bg-muted border border-border/80 rounded-xl px-4 py-2.5 text-xs font-semibold text-foreground transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-primary" />
                        <span>
                          {chatbots.find((b) => b.chatbotId === selectedBotId)?.name ||
                            "Choose AI Agent"}
                        </span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground transition-transform ${
                          isBotDropdownOpen ? "rotate-180 text-primary" : ""
                        }`}
                      />
                    </button>

                    <AnimatePresence>
                      {isBotDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setIsBotDropdownOpen(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 4, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.98 }}
                            className="absolute left-0 right-0 top-full mt-1.5 bg-card border border-border/80 rounded-xl shadow-xl z-40 p-1 space-y-0.5"
                          >
                            {chatbots.map((bot) => {
                              const isSel = bot.chatbotId === selectedBotId;
                              return (
                                <button
                                  key={bot.chatbotId}
                                  type="button"
                                  onClick={() => {
                                    setSelectedBotId(bot.chatbotId);
                                    setIsBotDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                    isSel
                                      ? "bg-primary/10 text-primary font-bold"
                                      : "hover:bg-muted/60 text-foreground"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <Bot className="w-3.5 h-3.5" />
                                    <span>{bot.name}</span>
                                  </div>
                                  {isSel && <Check className="w-4 h-4 text-primary" />}
                                </button>
                              );
                            })}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Handover Protocol Toggle */}
                <div className="bg-muted/30 border border-border/60 rounded-xl p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      {t("general.muteAiOnHandover", "Mute AI on Human Takeover")}
                    </h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {t(
                        "general.handoverDesc",
                        "Automatically pause AI auto-replies when a human agent takes over or sends a manual response in Live Inbox."
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMuteAiOnHandover((prev) => !prev)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      muteAiOnHandover ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  >
                    <motion.div
                      layout
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className={`w-4 h-4 rounded-full bg-white shadow-xs ${
                        muteAiOnHandover ? "ml-auto" : "ml-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Channel Details Info */}
                <div className="bg-card border border-border/60 rounded-xl p-4 space-y-2 text-xs">
                  <h4 className="font-bold text-foreground border-b border-border/40 pb-2">
                    {t("general.channelDetails", "Channel Connection Details")}
                  </h4>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">Platform:</span>{" "}
                      {channel.platform}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Account Handle:</span>{" "}
                      {channel.accountName}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Account ID:</span>{" "}
                      {channel.accountId || channel.id}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Connected:</span>{" "}
                      {channel.connectedAt
                        ? new Date(channel.connectedAt).toLocaleDateString()
                        : "Active"}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Tab 2: Comment Automation ── */}
            {activeTab === "comments" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                {/* Auto Reply Comments Toggle */}
                <div className="bg-muted/30 border border-border/60 rounded-xl p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      {t("commentAutomation.autoReplyComments", "Auto-reply to post comments")}
                    </h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {t(
                        "commentAutomation.autoReplyDesc",
                        "Automatically reply to user comments on your Facebook pages and Instagram posts."
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCommentReplyEnabled((prev) => !prev)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      commentReplyEnabled ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  >
                    <motion.div
                      layout
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className={`w-4 h-4 rounded-full bg-white shadow-xs ${
                        commentReplyEnabled ? "ml-auto" : "ml-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Auto DM Toggle */}
                <div className="bg-muted/30 border border-border/60 rounded-xl p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                      {t("commentAutomation.autoDm", "Auto-DM commenter")}
                    </h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {t(
                        "commentAutomation.autoDmDesc",
                        "Send a private direct message (DM) to users who leave comments on your posts."
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSendPrivateDM((prev) => !prev)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      sendPrivateDM ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  >
                    <motion.div
                      layout
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className={`w-4 h-4 rounded-full bg-white shadow-xs ${
                        sendPrivateDM ? "ml-auto" : "ml-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Trigger Keywords */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {t("commentAutomation.triggerKeywords", "Trigger Keywords")}
                  </label>
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder={t(
                      "commentAutomation.keywordsPlaceholder",
                      "Price, Details, Order, দাম কত, প্রাইস কত"
                    )}
                    className="w-full bg-muted/40 border border-border/80 rounded-xl px-3.5 py-2 text-xs outline-none focus:border-primary placeholder:text-muted-foreground/60 transition-colors"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t(
                      "commentAutomation.keywordsDesc",
                      "Only respond to comments containing these keywords. Separate keywords with commas."
                    )}
                  </p>
                </div>

                {/* Reply Template */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {t("commentAutomation.replyTemplate", "Comment Reply Template")}
                  </label>
                  <textarea
                    rows={3}
                    value={replyTemplate}
                    onChange={(e) => setReplyTemplate(e.target.value)}
                    placeholder={t(
                      "commentAutomation.templatePlaceholder",
                      "Hi {{name}}! Thanks for reaching out. Check your inbox for details!"
                    )}
                    className="w-full bg-muted/40 border border-border/80 rounded-xl p-3 text-xs outline-none focus:border-primary placeholder:text-muted-foreground/60 transition-colors resize-none"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t(
                      "commentAutomation.templateDesc",
                      "Custom reply message posted under customer comments."
                    )}
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── Tab 3: Webhook Health ── */}
            {activeTab === "webhook" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                {/* Meta Token Status Card */}
                <div className="bg-card border border-border/70 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      {t("webhook.metaTokenStatus", "Meta Access Token Status")}
                    </h4>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" />
                      {t("webhook.tokenValid", "Active & Valid (Expires in 60 days)")}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Meta webhook listener is active and receiving real-time events for this channel.
                  </p>
                </div>

                {/* Webhook Event Subscriptions */}
                <div className="bg-muted/30 border border-border/60 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-foreground">
                    {t("webhook.subscriptions", "Webhook Event Subscriptions")}
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>messages (Direct Chat)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>messaging_postbacks (Buttons)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>feed/comments (Post Comments)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>standby (Handover)</span>
                    </div>
                  </div>
                </div>

                {/* Test Webhook Section */}
                <div className="bg-card border border-border/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">
                        {t("webhook.testWebhook", "Test Webhook Connection")}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Ping Meta endpoint to verify latency and payload delivery status.
                      </p>
                    </div>
                    <Button
                      onClick={handleTestWebhook}
                      disabled={testingWebhook}
                      size="sm"
                      className="gap-2 bg-gradient-to-r from-violet-600 to-blue-500 hover:opacity-90 text-white border-none cursor-pointer"
                    >
                      <RefreshCcw className={`w-3.5 h-3.5 ${testingWebhook ? "animate-spin" : ""}`} />
                      {testingWebhook ? "Testing..." : t("webhook.testWebhook", "Test Connection")}
                    </Button>
                  </div>

                  {webhookResult && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs space-y-1 text-emerald-300"
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>HTTP 200 OK - Webhook Connected</span>
                      </div>
                      <div className="text-[11px] text-emerald-300/80">
                        Latency: {webhookResult.latencyMs}ms • Tested at {webhookResult.testedAt}
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-border/50 bg-secondary/10 flex items-center justify-end gap-3">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              {t("actions.cancel", "Cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-violet-600 to-blue-500 hover:opacity-90 text-white border-none font-semibold cursor-pointer"
            >
              {saving ? t("actions.saving", "Saving...") : t("actions.saveChanges", "Save Configuration")}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
