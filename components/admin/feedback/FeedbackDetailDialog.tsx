"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FeedbackThread } from "@/components/feedback/FeedbackThread";
import { FEEDBACK_STATUS_ORDER, feedbackStatusClass } from "@/components/feedback/status-styles";
import { cn } from "@/lib/utils";
import type { FeedbackStatus } from "@/lib/domain/feedback-schema";
import type { FeedbackThreadView } from "@/components/feedback/types";

/**
 * Admin view of a single feedback ticket.
 * ─────────────────────────────────────────────────────────────────────────────
 * Everything an admin needs to act without leaving the page: the captured
 * environment, the attachments, the whole conversation, a reply box and the
 * status controls. Replying and changing status both notify the merchant.
 */

interface FeedbackDetailDialogProps {
  feedbackId: string | null;
  open: boolean;
  onClose: () => void;
  /** Called after any successful change, so the queue behind can refresh. */
  onChanged: () => void;
}

export function FeedbackDetailDialog({
  feedbackId,
  open,
  onClose,
  onChanged,
}: FeedbackDetailDialogProps) {
  const { t } = useTranslation("admin");

  const [thread, setThread] = useState<FeedbackThreadView | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    if (!feedbackId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/feedback/${feedbackId}`);
      if (!response.ok) throw new Error("Failed to load");

      const data = (await response.json()) as { thread: FeedbackThreadView };
      setThread(data.thread);
    } catch {
      toast.error(t("feedback.loadError", "Could not load this feedback."));
    } finally {
      setLoading(false);
    }
  }, [feedbackId, t]);

  useEffect(() => {
    if (open && feedbackId) void load();
    if (!open) setThread(null);
  }, [open, feedbackId, load]);

  /** Shared PATCH call for both replying and changing status. */
  const send = useCallback(
    async (body: Record<string, unknown>) => {
      if (!feedbackId) return false;

      const response = await fetch(`/api/admin/feedback/${feedbackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Request failed");
      }

      return true;
    },
    [feedbackId]
  );

  const handleReply = useCallback(
    async (body: string) => {
      try {
        await send({ action: "reply", body });
        toast.success(t("feedback.replySent", "Reply sent — the merchant has been notified."));
        await load();
        onChanged();
      } catch {
        toast.error(t("feedback.replyError", "Could not send the reply."));
        // Rethrow so the thread keeps the admin's draft instead of clearing it.
        throw new Error("reply_failed");
      }
    },
    [send, load, onChanged, t]
  );

  const handleStatus = useCallback(
    async (status: FeedbackStatus) => {
      setUpdating(true);
      try {
        await send({ action: "set_status", status });
        toast.success(t("feedback.statusUpdated", "Status updated."));
        await load();
        onChanged();
      } catch {
        toast.error(t("feedback.updateError", "Could not update the status."));
      } finally {
        setUpdating(false);
      }
    },
    [send, load, onChanged, t]
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl w-[calc(100%-2rem)] max-h-[92vh] flex flex-col gap-3 p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 sm:px-5 sm:pt-5">
          <DialogTitle>{t("feedback.detailTitle", "Feedback details")}</DialogTitle>
          <DialogDescription>
            {t(
              "feedback.detailDescription",
              "Review the reported issue, reply to the merchant, and move the ticket along."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-4 pb-5 sm:px-5">
          {loading && !thread ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : thread ? (
            <FeedbackThread
              thread={thread}
              viewer="admin"
              onReply={handleReply}
              showContext
              merchant={{ name: thread.merchantName, email: thread.merchantEmail }}
              actions={
                <div className="flex flex-wrap items-center gap-1.5 mr-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void load()}
                    aria-label={t("feedback.refresh", "Refresh")}
                  >
                    <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                  </Button>
                  {FEEDBACK_STATUS_ORDER.map((status) => (
                    <Button
                      key={status}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={updating || thread.status === status}
                      onClick={() => handleStatus(status)}
                      className={cn(
                        "rounded-full h-7 text-[11px]",
                        thread.status === status && feedbackStatusClass(status)
                      )}
                    >
                      {t(`feedback.status.${status}`, status)}
                    </Button>
                  ))}
                </div>
              }
            />
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {t("feedback.notFound", "Feedback not found.")}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
