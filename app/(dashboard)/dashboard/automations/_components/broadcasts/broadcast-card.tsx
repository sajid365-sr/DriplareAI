"use client";

import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { CalendarClock, MoreVertical, Pencil, Send, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { STATUS_CLASSES, statusMeta } from "../types";
import { absoluteTime, relativeTime } from "../format";
import type { Broadcast } from "./types";

/**
 * One broadcast in the list.
 *
 * The progress bar is the point of this card. "Did it actually go out, and to
 * how many?" is the only question a merchant has after pressing send, and a
 * status word alone cannot answer it: `sent` is true of a broadcast that
 * reached 400 people and of one that reached none because every recipient was
 * outside the WhatsApp window.
 */
export function BroadcastCard({
  broadcast,
  busy,
  isBn,
  onEdit,
  onSend,
  onDelete,
}: {
  broadcast: Broadcast;
  busy: boolean;
  isBn: boolean;
  onEdit: () => void;
  onSend: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("automations");

  const meta = statusMeta(broadcast.status);
  const { targeted, sent, failed, queued } = broadcast.progress;

  // Delivered is counted from `sent`, not from `targeted`: a broadcast that
  // found 400 people and delivered to 12 has a delivery rate of 3%, and
  // measuring it against the audience would hide exactly that failure.
  const ratio = targeted > 0 ? Math.round((sent / targeted) * 100) : 0;

  const locked = broadcast.status === "sending" || broadcast.status === "sent";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col rounded-xl border border-border/60 bg-card p-4"
      data-testid={`broadcast-${broadcast.broadcastId}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-foreground">{broadcast.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                STATUS_CLASSES[meta.tone]
              )}
            >
              {t(meta.labelKey, broadcast.status)}
            </span>
            <span className="rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {t(`templates.channel.${broadcast.channel}`, broadcast.channel)}
            </span>
            {broadcast.scheduledAt && broadcast.status === "scheduled" && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                title={absoluteTime(broadcast.scheduledAt, isBn)}
              >
                <CalendarClock className="h-3 w-3" />
                {relativeTime(broadcast.scheduledAt, isBn)}
              </span>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                aria-label={t("broadcasts.actions", "Broadcast actions")}
                className="shrink-0 text-muted-foreground"
              />
            }
          >
            <MoreVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit} disabled={locked}>
              <Pencil />
              {t("menu.edit", "Edit")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSend} disabled={locked}>
              <Send />
              {t("broadcasts.sendNow", "Send now")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Deleting a finished broadcast would erase the only record that
                the messages were sent, so the server refuses it and the menu
                does not offer it. */}
            <DropdownMenuItem
              onClick={onDelete}
              disabled={locked}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 />
              {t("menu.delete", "Delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <p className="mt-3 line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
        {broadcast.body}
      </p>

      {/* ── Delivery ──────────────────────────────────────────────────────── */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Users className="h-3 w-3" />
            {t("broadcasts.targeted", "{{count}} targeted", { count: targeted })}
          </span>
          <span className="font-mono text-foreground">
            {sent}/{targeted}
          </span>
        </div>

        {/* A single track, not a stacked bar: sent and failed are the only two
            outcomes a merchant acts on, and a third colour would make the one
            that matters harder to spot. */}
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-success transition-all"
            style={{ width: `${ratio}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {queued > 0 && (
            <span>{t("broadcasts.queued", "{{count}} still queued", { count: queued })}</span>
          )}
          {failed > 0 && (
            <span className="text-destructive">
              {t("broadcasts.failedCount", "{{count}} failed", { count: failed })}
            </span>
          )}
          <span className="ml-auto" title={absoluteTime(broadcast.createdAt, isBn)}>
            {relativeTime(broadcast.createdAt, isBn)}
          </span>
        </div>
      </div>
    </motion.article>
  );
}
