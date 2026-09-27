"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Loader2, MessageSquarePlus, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeedbackComposer } from "./FeedbackComposer";
import { FeedbackHistoryList } from "./FeedbackHistoryList";
import { FeedbackThread } from "./FeedbackThread";
import type { FeedbackThreadView, MerchantFeedbackSummary } from "./types";

/**
 * Feedback dialog — the merchant's single entry point.
 * ─────────────────────────────────────────────────────────────────────────────
 * Two tabs: write a new report, or follow up on one already sent. Both live in
 * one dialog because they are the same task from the merchant's point of view —
 * "tell the team something" — and a merchant with an open ticket usually wants
 * to check it before writing another.
 *
 * The auto screenshot is captured by the caller *before* this dialog opens;
 * the dialog only receives the file. Capturing here would photograph the dialog
 * itself.
 */

interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
  autoScreenshot: File | null;
  chatbotId?: string | null;
  /** Fires whenever the unread count changes, so the header dot stays in sync. */
  onUnreadChange?: (count: number) => void;
}

export function FeedbackDialog({
  open,
  onClose,
  autoScreenshot,
  chatbotId,
  onUnreadChange,
}: FeedbackDialogProps) {
  const { t } = useTranslation("feedback");

  const [tab, setTab] = useState<"new" | "history">("new");
  const [items, setItems] = useState<MerchantFeedbackSummary[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<FeedbackThreadView | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const response = await fetch("/api/feedback");
      if (!response.ok) throw new Error("Failed to load");

      const data = (await response.json()) as {
        items: MerchantFeedbackSummary[];
        unreadCount: number;
      };

      setItems(data.items);
      onUnreadChange?.(data.unreadCount);
    } catch {
      toast.error(t("errors.loadList", "Could not load your feedback."));
    } finally {
      setListLoading(false);
    }
  }, [onUnreadChange, t]);

  // Load once per open, and reset to the compose tab each time.
  useEffect(() => {
    if (!open) return;
    setTab("new");
    setActiveId(null);
    setThread(null);
    void loadList();
  }, [open, loadList]);

  /** Opens one ticket and clears its unread flag. */
  const openThread = useCallback(
    async (feedbackId: string) => {
      setActiveId(feedbackId);
      setThreadLoading(true);

      try {
        const response = await fetch(`/api/feedback/${feedbackId}`);
        if (!response.ok) throw new Error("Failed to load");

        const data = (await response.json()) as { thread: FeedbackThreadView };
        setThread(data.thread);

        if (data.thread.hasUnreadReply) {
          // Best-effort: the thread is already on screen, so a failed mark-read
          // only means the dot lingers until the next open.
          const marked = await fetch(`/api/feedback/${feedbackId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "mark_read" }),
          })
            .then((response) => response.ok)
            .catch(() => false);

          // Re-reads the list so the header dot's count matches what is on screen.
          if (marked) void loadList();
        }
      } catch {
        toast.error(t("errors.loadThread", "Could not load this conversation."));
        setActiveId(null);
      } finally {
        setThreadLoading(false);
      }
    },
    [loadList, t]
  );

  const handleReply = useCallback(
    async (body: string) => {
      if (!activeId) return;

      try {
        const response = await fetch(`/api/feedback/${activeId}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });

        if (!response.ok) throw new Error("Failed to send");

        // Re-read the thread rather than appending locally, so status changes
        // (a resolved ticket reopening) come from the server's own answer.
        const refreshed = await fetch(`/api/feedback/${activeId}`);
        if (refreshed.ok) {
          const data = (await refreshed.json()) as { thread: FeedbackThreadView };
          setThread(data.thread);
        }

        void loadList();
      } catch {
        toast.error(t("errors.reply", "Could not send your reply."));
        // Rethrow so the thread keeps the merchant's draft instead of clearing it.
        throw new Error("reply_failed");
      }
    },
    [activeId, loadList, t]
  );

  /** After a successful submission: jump straight to the ticket that was created. */
  const handleSubmitted = useCallback(
    async (feedbackId: string) => {
      await loadList();
      setTab("history");
      void openThread(feedbackId);
    },
    [loadList, openThread]
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        // Keeps the dialog out of any screenshot captured while it is open.
        data-html2canvas-ignore="true"
        className="max-w-2xl w-[calc(100%-2rem)] max-h-[92vh] flex flex-col gap-3 p-0 overflow-hidden"
      >
        <DialogHeader className="px-4 pt-4 sm:px-5 sm:pt-5">
          <DialogTitle>{t("dialog.title", "Send feedback")}</DialogTitle>
          <DialogDescription>
            {t(
              "dialog.description",
              "Found a bug or something that feels wrong? Tell us — attach a screenshot, a voice note or a screen recording."
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as "new" | "history")}
          className="gap-0"
        >
          <TabsList className="mx-4 sm:mx-5 mb-3 w-fit">
            <TabsTrigger value="new" className="gap-1.5 px-3">
              <MessageSquarePlus className="size-4" />
              {t("dialog.tabs.new", "New")}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 px-3">
              <MessagesSquare className="size-4" />
              {t("dialog.tabs.history", "My Feedback")}
              {items.some((item) => item.hasUnreadReply) && (
                <span className="size-1.5 rounded-full bg-primary" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* Native scroll with a viewport-relative cap — the dialog's own height
              is content-driven, so nothing here may depend on a flex chain. */}
          <div className="max-h-[65vh] overflow-y-auto px-4 pb-5 sm:px-5">
            {/* `keepMounted` matters: without it, glancing at My Feedback would
                unmount the composer and throw away a half-written report. */}
            <TabsContent value="new" keepMounted>
              <FeedbackComposer
                autoScreenshot={autoScreenshot}
                chatbotId={chatbotId}
                onSubmitted={handleSubmitted}
              />
            </TabsContent>

            <TabsContent value="history">
              {activeId ? (
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setActiveId(null);
                      setThread(null);
                    }}
                    className="gap-1.5 -ml-2"
                  >
                    <ArrowLeft className="size-4" />
                    {t("dialog.back", "All feedback")}
                  </Button>

                  {threadLoading || !thread ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <FeedbackThread thread={thread} viewer="merchant" onReply={handleReply} />
                  )}
                </div>
              ) : (
                <FeedbackHistoryList items={items} loading={listLoading} onSelect={openThread} />
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
