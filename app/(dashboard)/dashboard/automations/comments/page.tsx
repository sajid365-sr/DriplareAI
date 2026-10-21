"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  MessageCircle,
  Plus,
  Loader2,
  X,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { SectionHeader } from "../_components/section-header";
import {
  CommentAutomationCard,
  type CommentAutomationRule,
} from "../_components/comment-automation/CommentAutomationCard";
import { PostProductLinker } from "../_components/comment-automation/PostProductLinker";
import { FollowUpDelayPicker } from "../_components/comment-automation/FollowUpDelayPicker";

export default function CommentAutomationPage() {
  const { t } = useTranslation("automations");

  const [rules, setRules] = useState<CommentAutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatbots, setChatbots] = useState<Array<{ chatbotId: string; name: string }>>([]);
  const [selectedChatbotId, setSelectedChatbotId] = useState<string>("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Editor Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [formChatbotId, setFormChatbotId] = useState("");
  const [formPostUrl, setFormPostUrl] = useState("");
  const [formPostId, setFormPostId] = useState("");
  const [formPostTitle, setFormPostTitle] = useState("");
  const [formProductIds, setFormProductIds] = useState<string[]>([]);
  const [formPublicReply, setFormPublicReply] = useState("");
  const [formAutoDm, setFormAutoDm] = useState("");
  const [formKeywords, setFormKeywords] = useState("");
  const [formEnableFollowUp, setFormEnableFollowUp] = useState(false);
  const [formFollowUpDelay, setFormFollowUpDelay] = useState(30);
  const [formFollowUpDm, setFormFollowUpDm] = useState("");

  // 1. Fetch available Chatbots
  useEffect(() => {
    let ignore = false;
    fetch("/api/chatbots")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ignore && data?.chatbots?.length) {
          setChatbots(data.chatbots);
          setSelectedChatbotId(data.chatbots[0].chatbotId);
          setFormChatbotId(data.chatbots[0].chatbotId);
        }
      })
      .catch((err) => console.warn("[FETCH_CHATBOTS_ERR]", err));

    return () => {
      ignore = true;
    };
  }, []);

  // 2. Fetch Comment Rules
  useEffect(() => {
    let ignore = false;
    const url = selectedChatbotId
      ? `/api/automations/comment?chatbotId=${selectedChatbotId}`
      : "/api/automations/comment";

    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ignore && data?.rules) {
          setRules(data.rules);
        }
      })
      .catch((err) => {
        console.warn("[FETCH_COMMENT_RULES_ERR]", err);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [selectedChatbotId, refreshTrigger]);

  const openCreateModal = () => {
    setEditingId(null);
    setFormPostUrl("");
    setFormPostId("");
    setFormPostTitle("");
    setFormProductIds([]);
    setFormPublicReply("Please check your inbox for details! 📩");
    setFormAutoDm("Hello! Here are the details and price for the product you asked about.");
    setFormKeywords("");
    setFormEnableFollowUp(false);
    setFormFollowUpDelay(30);
    setFormFollowUpDm("Hello again! Did you have any questions about this item? Stock is limited.");
    setIsModalOpen(true);
  };

  const openEditModal = (rule: CommentAutomationRule) => {
    setEditingId(rule.id);
    setFormChatbotId(rule.chatbotId);
    setFormPostUrl(rule.postUrl || "");
    setFormPostId(rule.postId);
    setFormPostTitle(rule.postTitle || "");
    setFormProductIds(rule.productIds || []);
    setFormPublicReply(rule.publicReplyText || "");
    setFormAutoDm(rule.autoDmText || "");
    setFormKeywords(rule.keywords.join(", "));
    setFormEnableFollowUp(rule.enableFollowUp);
    setFormFollowUpDelay(rule.followUpDelayMin || 30);
    setFormFollowUpDm(rule.followUpDmText || "");
    setIsModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPostId.trim()) {
      toast.error("Valid Post ID or Post URL is required");
      return;
    }
    if (!formAutoDm.trim()) {
      toast.error("Auto-DM message is required");
      return;
    }

    setIsSaving(true);
    try {
      const keywordsArray = formKeywords
        .split(/[,|]/)
        .map((k) => k.trim())
        .filter(Boolean);

      const res = await fetch("/api/automations/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId || undefined,
          chatbotId: formChatbotId || selectedChatbotId,
          postId: formPostId.trim(),
          postUrl: formPostUrl.trim() || undefined,
          postTitle: formPostTitle.trim() || undefined,
          productIds: formProductIds,
          publicReplyText: formPublicReply.trim() || undefined,
          autoDmText: formAutoDm.trim(),
          keywords: keywordsArray,
          enableFollowUp: formEnableFollowUp,
          followUpDelayMin: formFollowUpDelay,
          followUpDmText: formFollowUpDm.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save comment rule");

      toast.success(editingId ? "Comment rule updated" : "Comment rule created");
      setIsModalOpen(false);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      const targetRule = rules.find((r) => r.id === id);
      if (!targetRule) return;

      const res = await fetch("/api/automations/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...targetRule,
          isActive: active,
        }),
      });

      if (!res.ok) throw new Error("Failed to toggle status");
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isActive: active } : r))
      );
      toast.success(active ? "Rule activated" : "Rule paused");
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this comment rule?")) return;
    try {
      const res = await fetch(`/api/automations/comment?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.success("Rule deleted");
    } catch {
      toast.error("Failed to delete rule");
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={MessageCircle}
        title={t("commentAutomation.title", "Comment Auto-DM & Product Linking")}
        subtitle={t(
          "commentAutomation.subtitle",
          "Reply automatically to Facebook/Instagram comments with product-aware context and private DMs"
        )}
        action={
          <div className="flex items-center gap-2">
            {chatbots.length > 1 && (
              <select
                value={selectedChatbotId}
                onChange={(e) => setSelectedChatbotId(e.target.value)}
                className="rounded-xl border border-border/80 bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-none"
              >
                {chatbots.map((bot) => (
                  <option key={bot.chatbotId} value={bot.chatbotId}>
                    {bot.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-500/20 hover:opacity-95"
            >
              <Plus className="h-4 w-4" />
              <span>{t("commentAutomation.newRule", "+ New Comment Rule")}</span>
            </button>
          </div>
        }
      />

      {/* Rules Grid */}
      {loading ? (
        <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span>Loading comment automation rules...</span>
        </div>
      ) : rules.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rules.map((rule) => (
            <CommentAutomationCard
              key={rule.id}
              rule={rule}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
              onEdit={openEditModal}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/80 p-8 sm:p-12 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500">
            <MessageCircle className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground">No Comment Rules Configured</h3>
          <p className="mx-auto max-w-sm text-xs text-muted-foreground">
            Connect specific social media posts to catalog products and automatically reply with product cards & private DMs.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-muted/50"
          >
            <Plus className="h-3.5 w-3.5 text-violet-500" />
            <span>Create First Rule</span>
          </button>
        </div>
      )}

      {/* Editor Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <MessageCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {editingId ? "Edit Comment Rule" : "Create Comment-to-DM Rule"}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Automate public comment replies & instant private DMs
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveRule} className="space-y-4">
                {/* 1. Post & Product Linker Component */}
                <PostProductLinker
                  chatbotId={formChatbotId || selectedChatbotId}
                  selectedProductIds={formProductIds}
                  onChangeProductIds={setFormProductIds}
                  postUrl={formPostUrl}
                  onChangePostUrl={setFormPostUrl}
                  postId={formPostId}
                  onChangePostId={setFormPostId}
                />

                {/* 2. Public Reply & Private DM Configuration */}
                <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5 text-violet-500" />
                    <span>Responses</span>
                  </h4>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                      {t("commentAutomation.publicReply", "Public Comment Reply (on post)")}
                    </label>
                    <input
                      type="text"
                      value={formPublicReply}
                      onChange={(e) => setFormPublicReply(e.target.value)}
                      placeholder={t("commentAutomation.publicReplyPlaceholder", "e.g. Please check your inbox!")}
                      className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-violet-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                      {t("commentAutomation.autoDm", "Private Auto-DM Message")} *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={formAutoDm}
                      onChange={(e) => setFormAutoDm(e.target.value)}
                      placeholder={t("commentAutomation.autoDmPlaceholder", "e.g. Hello! Here are the details and price for the product...")}
                      className="w-full rounded-xl border border-border/80 bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-violet-600 focus:outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                      {t("commentAutomation.keywords", "Trigger Keywords")}
                    </label>
                    <input
                      type="text"
                      value={formKeywords}
                      onChange={(e) => setFormKeywords(e.target.value)}
                      placeholder={t("commentAutomation.keywordsPlaceholder", "price, dam, size, details (leave empty for all comments)")}
                      className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-violet-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 3. Follow-up Delay Picker Component (Feature #15) */}
                <FollowUpDelayPicker
                  enableFollowUp={formEnableFollowUp}
                  onToggleEnable={setFormEnableFollowUp}
                  delayMinutes={formFollowUpDelay}
                  onChangeDelay={setFormFollowUpDelay}
                  followUpText={formFollowUpDm}
                  onChangeText={setFormFollowUpDm}
                />

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
                  >
                    {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{t("commentAutomation.saveRule", "Save Rule")}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

