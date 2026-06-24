"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquareQuote, Bot, Text, Save, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Comment reply config shape stored in Integration.config.commentReply
type CommentReplyConfig = {
  enabled: boolean;
  mode: "ai" | "fixed";
  fixedMessage: string;
  sendPrivateDM: boolean;
};

interface CommentReplySettingsProps {
  integrationId: string;
  initialConfig?: Partial<CommentReplyConfig>;
}

export function CommentReplySettings({
  integrationId,
  initialConfig,
}: CommentReplySettingsProps) {
  const { t } = useTranslation("chatbots");

  const [enabled, setEnabled] = useState(initialConfig?.enabled ?? false);
  const [mode, setMode] = useState<"ai" | "fixed">(initialConfig?.mode ?? "ai");
  const [fixedMessage, setFixedMessage] = useState(initialConfig?.fixedMessage ?? "");
  const [sendPrivateDM, setSendPrivateDM] = useState(initialConfig?.sendPrivateDM ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/integrations/facebook/comment-reply", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId, enabled, mode, fixedMessage, sendPrivateDM }),
      });

      if (!res.ok) throw new Error("Save failed");
      toast.success(t("comment_reply.saved"));
    } catch {
      toast.error(t("comment_reply.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4 rounded-xl border border-border bg-muted/20 p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <MessageSquareQuote className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("comment_reply.title")}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("comment_reply.subtitle")}
            </p>
          </div>
        </div>
        <Switch
          id="comment-reply-enable"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>

      {/* Settings — visible only when enabled */}
      <AnimatePresence>
        {enabled && (
          <motion.div
            key="comment-settings"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden space-y-4"
          >
            {/* Mode Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                {t("comment_reply.replyMode")}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {(["ai", "fixed"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all ${
                      mode === m
                        ? "border-primary bg-primary/5 text-primary font-semibold"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {m === "ai" ? (
                      <Bot className="size-3.5 shrink-0" />
                    ) : (
                      <Text className="size-3.5 shrink-0" />
                    )}
                    {t(`comment_reply.mode_${m}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Fixed Message Textarea */}
            <AnimatePresence>
              {mode === "fixed" && (
                <motion.div
                  key="fixed-message"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-1.5"
                >
                  <Label htmlFor="fixed-msg" className="text-xs font-medium text-muted-foreground">
                    {t("comment_reply.fixedMessageLabel")}
                  </Label>
                  <Textarea
                    id="fixed-msg"
                    value={fixedMessage}
                    onChange={(e) => setFixedMessage(e.target.value)}
                    placeholder={t("comment_reply.fixedMessagePlaceholder")}
                    className="min-h-[80px] resize-none rounded-xl text-sm"
                    maxLength={500}
                  />
                  <p className="text-right text-[10px] text-muted-foreground">
                    {fixedMessage.length}/500
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Private DM Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5">
              <div>
                <p className="text-xs font-medium text-foreground">
                  {t("comment_reply.sendDM")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("comment_reply.sendDMSubtitle")}
                </p>
              </div>
              <Switch
                id="comment-dm-toggle"
                checked={sendPrivateDM}
                onCheckedChange={setSendPrivateDM}
              />
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={saving || (mode === "fixed" && !fixedMessage.trim())}
              size="sm"
              className="w-full rounded-xl"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Save className="size-4 mr-2" />
              )}
              {t("comment_reply.save")}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
