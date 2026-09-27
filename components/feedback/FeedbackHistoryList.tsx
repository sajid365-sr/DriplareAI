"use client";

import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, Inbox, MessageSquare, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { feedbackStatusClass } from "./status-styles";
import type { MerchantFeedbackSummary } from "./types";

/**
 * The merchant's own feedback history.
 * ─────────────────────────────────────────────────────────────────────────────
 * Every ticket the merchant has opened, newest first, with a dot when an admin
 * has replied and the merchant has not read it yet. Selecting a row hands the
 * id to the dialog, which swaps this list for the thread.
 */

interface FeedbackHistoryListProps {
  items: MerchantFeedbackSummary[];
  loading: boolean;
  onSelect: (feedbackId: string) => void;
}

export function FeedbackHistoryList({ items, loading, onSelect }: FeedbackHistoryListProps) {
  const { t } = useTranslation("feedback");

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <div className="size-11 rounded-full bg-muted flex items-center justify-center">
          <Inbox className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">
          {t("history.empty", "No feedback yet")}
        </p>
        <p className="text-xs text-muted-foreground max-w-xs">
          {t(
            "history.emptyHint",
            "Anything you report from here shows up in this list, along with our replies."
          )}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              "w-full text-left rounded-xl border border-border bg-card p-3 transition-colors",
              "hover:border-primary/40 hover:bg-primary/[0.03]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {/* Unread marker — an admin has replied since the merchant last looked. */}
                {item.hasUnreadReply && (
                  <span
                    className="size-2 rounded-full bg-primary shrink-0"
                    aria-label={t("history.unread", "New reply")}
                  />
                )}
                <span className="text-sm font-medium text-foreground truncate">
                  {item.subject}
                </span>
              </div>
              <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-0.5" />
            </div>

            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {item.lastMessageFrom === "admin" && (
                <span className="text-primary font-medium">
                  {t("history.team", "Team")}:{" "}
                </span>
              )}
              {item.lastMessage}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("text-[10px]", feedbackStatusClass(item.status))}
              >
                {t(`status.${item.status}`, item.status)}
              </Badge>

              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </span>

              {item.replyCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MessageSquare className="size-3" />
                  {item.replyCount}
                </span>
              )}

              {item.attachmentCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Paperclip className="size-3" />
                  {item.attachmentCount}
                </span>
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
