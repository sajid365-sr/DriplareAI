"use client";

import { useTranslation } from "react-i18next";
import { Megaphone } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

import { BroadcastCard } from "./broadcast-card";
import type { Broadcast } from "./types";

/**
 * The broadcast grid.
 *
 * The empty state is written to teach the WhatsApp rule, because that is the
 * thing a merchant discovers the hard way: a free-text broadcast goes out on
 * Messenger and silently fails for everyone on WhatsApp who has not written in
 * the last 24 hours. Saying it here, before the first send, is the difference
 * between a feature that works and one that looks broken.
 */
export function BroadcastList({
  broadcasts,
  loading,
  busyId,
  filtered,
  isBn,
  onEdit,
  onSend,
  onDelete,
}: {
  broadcasts: Broadcast[];
  loading: boolean;
  busyId: string | null;
  filtered: boolean;
  isBn: boolean;
  onEdit: (broadcast: Broadcast) => void;
  onSend: (broadcast: Broadcast) => void;
  onDelete: (broadcast: Broadcast) => void;
}) {
  const { t } = useTranslation("automations");

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (broadcasts.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-xl border border-dashed border-border/60 p-10 text-center">
        <Megaphone className="mx-auto h-6 w-6 text-muted-foreground/60" />
        <p className="mt-2.5 text-sm font-semibold text-foreground">
          {filtered
            ? t("broadcasts.emptyFiltered", "No broadcasts with this status")
            : t("broadcasts.empty", "No broadcasts yet")}
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          {filtered
            ? t("broadcasts.emptyFilteredHint", "Try another status, or clear the filter.")
            : t(
                "broadcasts.emptyHint",
                "A broadcast is one message to many customers at once — an offer, a restock, a delivery notice. On WhatsApp it must use an approved template unless the customer wrote to you in the last 24 hours."
              )}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {broadcasts.map((broadcast) => (
        <BroadcastCard
          key={broadcast.broadcastId}
          broadcast={broadcast}
          busy={busyId === broadcast.broadcastId}
          isBn={isBn}
          onEdit={() => onEdit(broadcast)}
          onSend={() => onSend(broadcast)}
          onDelete={() => onDelete(broadcast)}
        />
      ))}
    </div>
  );
}
