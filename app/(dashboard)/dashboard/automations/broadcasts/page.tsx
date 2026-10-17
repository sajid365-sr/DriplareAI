"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Megaphone, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ConfirmDeleteDialog } from "../_components/confirm-delete-dialog";
import { SectionHeader } from "../_components/section-header";
import { BroadcastComposerSheet } from "../_components/broadcasts/broadcast-composer-sheet";
import { BroadcastList } from "../_components/broadcasts/broadcast-list";
import { VISIBLE_BROADCAST_STATUSES, type Broadcast } from "../_components/broadcasts/types";

/**
 * The Broadcasts tab.
 *
 * Three data sets are loaded up front, and all three are dependencies of the
 * composer rather than of the list: the agents scope the audience, the tags are
 * the audience filter, and the templates are required for WhatsApp. Fetching
 * them lazily when the sheet opens would put a spinner between the merchant and
 * the first field they want to type in.
 */

const ANY = "__any__";

export default function AutomationBroadcastsPage() {
  const { t, i18n } = useTranslation("automations");
  const isBn = i18n.language === "bn";

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [tags, setTags] = useState<{ tagId: string; name: string }[]>([]);
  const [templates, setTemplates] = useState<
    { templateId: string; name: string; waStatus: string }[]
  >([]);

  /** `null` = closed. Inside, `broadcast: null` means "composing a new one". */
  const [composer, setComposer] = useState<{ broadcast: Broadcast | null } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Broadcast | null>(null);
  const [pendingSend, setPendingSend] = useState<Broadcast | null>(null);

  // ── Bootstrap: everything the composer needs ──────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const [botResponse, tagResponse, templateResponse] = await Promise.all([
          fetch("/api/chatbots"),
          fetch("/api/automations/tags"),
          // Archived templates are excluded: a broadcast cannot be composed
          // against one, and offering it in the picker would produce a send
          // that fails on the first recipient.
          fetch("/api/automations/templates"),
        ]);

        if (cancelled) return;

        const bots = await botResponse.json();
        if (Array.isArray(bots)) {
          setAgents(
            bots.map((bot: { chatbotId: string; name: string }) => ({
              id: bot.chatbotId,
              name: bot.name,
            }))
          );
        }

        const tagData = await tagResponse.json();
        if (Array.isArray(tagData?.tags)) setTags(tagData.tags);

        const templateData = await templateResponse.json();
        if (Array.isArray(templateData?.templates)) {
          setTemplates(
            (templateData.templates as { templateId: string; name: string; waStatus: string }[]).map(
              (template) => ({
                templateId: template.templateId,
                name: template.name,
                waStatus: template.waStatus,
              })
            )
          );
        }
      } catch {
        // The composer degrades to free text without templates — the list below
        // loads separately and is unaffected.
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── The list ──────────────────────────────────────────────────────────────
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (status) params.set("status", status);

      try {
        const response = await fetch(`/api/automations/broadcasts?${params.toString()}`, { signal });
        const data = await response.json();
        if (!response.ok) {
          toast.error(t("broadcasts.loadFailed", "Could not load your broadcasts."));
          return;
        }
        setBroadcasts(data.broadcasts ?? []);
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") return;
        toast.error(t("broadcasts.loadFailed", "Could not load your broadcasts."));
      } finally {
        setLoading(false);
      }
    },
    [status, t]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function confirmSend() {
    const target = pendingSend;
    if (!target) return;

    setBusyId(target.broadcastId);
    try {
      const response = await fetch(`/api/automations/broadcasts/${target.broadcastId}/send`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // The API's `hint` explains an empty audience better than any generic
        // message could, so it is shown verbatim when present.
        toast.error(data?.hint ?? data?.error ?? t("broadcasts.sendFailed", "Could not send."));
      } else {
        if (data?.warning) toast.warning(data.warning);
        toast.success(
          t("broadcasts.sendResult", "Queued {{targeted}}, sent {{sent}}, failed {{failed}}", {
            targeted: data?.targeted ?? 0,
            sent: data?.sent ?? 0,
            failed: data?.failed ?? 0,
          })
        );
      }
      setPendingSend(null);
      void load();
    } catch {
      toast.error(t("broadcasts.sendFailed", "Could not send the broadcast."));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;

    setBusyId(target.broadcastId);
    try {
      const response = await fetch(`/api/automations/broadcasts/${target.broadcastId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error(
          data?.error ?? t("broadcasts.deleteFailed", "Could not delete the broadcast.")
        );
        return;
      }

      setBroadcasts((current) =>
        current.filter((item) => item.broadcastId !== target.broadcastId)
      );
      toast.success(t("broadcasts.deleted", "Broadcast deleted."));
      setPendingDelete(null);
    } catch {
      toast.error(t("broadcasts.deleteFailed", "Could not delete the broadcast."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <SectionHeader
        icon={Megaphone}
        title={t("broadcasts.title", "Broadcasts")}
        subtitle={t(
          "broadcasts.pageSubtitle",
          "One message to many customers — offers, restocks and delivery notices."
        )}
        action={
          <Button
            onClick={() => setComposer({ broadcast: null })}
            className="gap-2 border-none bg-brand-gradient text-white hover:opacity-90"
            data-testid="create-broadcast-btn"
          >
            <Plus className="h-4 w-4" />
            {t("broadcasts.create", "New Broadcast")}
          </Button>
        }
      />

      <Select
        value={status || ANY}
        onValueChange={(value) => setStatus(value && value !== ANY ? value : "")}
      >
        <SelectTrigger className="h-9 w-[11rem] text-xs" data-testid="broadcast-status-filter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{t("broadcasts.allStatuses", "All statuses")}</SelectItem>
          {VISIBLE_BROADCAST_STATUSES.map((option) => (
            <SelectItem key={option} value={option}>
              {t(`status.${option}`, option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <BroadcastList
        broadcasts={broadcasts}
        loading={loading}
        busyId={busyId}
        filtered={Boolean(status)}
        isBn={isBn}
        onEdit={(broadcast) => setComposer({ broadcast })}
        onSend={setPendingSend}
        onDelete={setPendingDelete}
      />

      {composer && (
        <BroadcastComposerSheet
          // Remounting per broadcast is what resets the form — see the note in
          // the composer itself.
          key={composer.broadcast?.broadcastId ?? "new"}
          open
          broadcast={composer.broadcast}
          agents={agents}
          tags={tags}
          templates={templates}
          onOpenChange={(open) => {
            if (!open) setComposer(null);
          }}
          onSaved={() => {
            setComposer(null);
            void load();
          }}
        />
      )}

      <ConfirmDeleteDialog
        open={pendingSend !== null}
        title={t("broadcasts.confirmTitle", "Send to {{count}} contacts?", {
          count: pendingSend?.progress.targeted ?? 0,
        })}
        body={t(
          "broadcasts.confirmBody",
          "This cannot be undone or recalled. Each customer receives the message once."
        )}
        busy={busyId === pendingSend?.broadcastId}
        testId="broadcast-list-send-confirm"
        confirmLabel={t("broadcasts.sendNow", "Send now")}
        onOpenChange={(open) => {
          if (!open) setPendingSend(null);
        }}
        onConfirm={confirmSend}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title={t("broadcasts.deleteTitle", "Delete this broadcast?")}
        body={t(
          "broadcasts.deleteBody",
          '"{{name}}" will be removed. Nothing has been sent to anyone yet.',
          { name: pendingDelete?.name ?? "" }
        )}
        busy={busyId === pendingDelete?.broadcastId}
        testId="broadcast-delete-confirm"
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onConfirm={confirmDelete}
      />
    </motion.div>
  );
}
