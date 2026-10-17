"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FileText, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TEMPLATE_CHANNELS } from "@/lib/automations/schema";

import { ConfirmDeleteDialog } from "../_components/confirm-delete-dialog";
import { SectionHeader } from "../_components/section-header";
import { TemplateEditorSheet } from "../_components/templates/template-editor-sheet";
import { TemplateList } from "../_components/templates/template-list";
import { buttonsForWrite, type MessageTemplate } from "../_components/templates/types";

/**
 * The Templates tab.
 *
 * Templates are the vocabulary the other three tabs speak: a rule's
 * `send_template` action picks one, and a WhatsApp broadcast cannot legally be
 * anything else. That is why this page exists as its own surface rather than as
 * a field inside the rule builder — a template is written once and reused in
 * many rules, so editing it in one rule's context would make it look like that
 * rule's private copy.
 */

const SEARCH_DEBOUNCE_MS = 300;
const ANY = "__any__";

export default function AutomationTemplatesPage() {
  const { t } = useTranslation("automations");

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [channel, setChannel] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  /** `null` = closed. Inside, `template: null` means "creating". */
  const [editor, setEditor] = useState<{ template: MessageTemplate | null } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MessageTemplate | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      if (channel) params.set("channel", channel);
      if (showArchived) params.set("archived", "true");

      try {
        const response = await fetch(`/api/automations/templates?${params.toString()}`, {
          signal,
        });
        const data = await response.json();
        if (!response.ok) {
          toast.error(t("templates.loadFailed", "Could not load your templates."));
          return;
        }
        setTemplates(data.templates ?? []);
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") return;
        toast.error(t("templates.loadFailed", "Could not load your templates."));
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, channel, showArchived, t]
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function toggleArchive(template: MessageTemplate) {
    setBusyId(template.templateId);
    try {
      const response = await fetch(`/api/automations/templates/${template.templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // The full write payload, not just `archived`: the API's PATCH is a
        // whole-record replace for anything that is not a status-only payload,
        // so a partial body would blank the message. Everything else is echoed
        // back exactly as loaded.
        body: JSON.stringify({
          name: template.name,
          channel: template.channel,
          category: template.category,
          language: template.language,
          body: template.body,
          headerType: template.headerType ?? "none",
          headerValue: template.headerValue,
          buttons: buttonsForWrite(template.buttons),
          archived: !template.archived,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error(data?.error ?? t("templates.saveFailed", "Could not save the template."));
        return;
      }

      setTemplates((current) =>
        current.map((item) =>
          item.templateId === template.templateId ? { ...item, archived: !item.archived } : item
        )
      );
    } catch {
      toast.error(t("templates.saveFailed", "Could not save the template."));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;

    setBusyId(target.templateId);
    try {
      const response = await fetch(`/api/automations/templates/${target.templateId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        // A 409 means a scheduled broadcast is holding it. The API's `hint`
        // already explains what to do, so it is shown verbatim rather than
        // replaced with a generic failure.
        toast.error(data?.hint ?? data?.error ?? t("templates.deleteFailed", "Could not delete the template."));
        return;
      }

      setTemplates((current) => current.filter((item) => item.templateId !== target.templateId));
      toast.success(t("templates.deleted", "Template deleted."));
      setPendingDelete(null);
    } catch {
      toast.error(t("templates.deleteFailed", "Could not delete the template."));
    } finally {
      setBusyId(null);
    }
  }

  const filtered = Boolean(debouncedSearch.trim() || channel || showArchived);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <SectionHeader
        icon={FileText}
        title={t("templates.title", "Templates")}
        subtitle={t(
          "templates.pageSubtitle",
          "Reusable message copy — and on WhatsApp, the only way to start a conversation."
        )}
        action={
          <Button
            onClick={() => setEditor({ template: null })}
            className="gap-2 border-none bg-brand-gradient text-white hover:opacity-90"
            data-testid="create-template-btn"
          >
            <Plus className="h-4 w-4" />
            {t("templates.create", "New Template")}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("templates.search", "Search by name or message…")}
            className="h-9 pl-8 text-sm"
            data-testid="template-search"
          />
        </div>

        <Select
          value={channel || ANY}
          onValueChange={(value) => setChannel(value && value !== ANY ? value : "")}
        >
          <SelectTrigger className="h-9 w-[10rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{t("templates.allChannels", "All channels")}</SelectItem>
            {TEMPLATE_CHANNELS.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`templates.channel.${option}`, option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
          <Switch
            checked={showArchived}
            onCheckedChange={setShowArchived}
            aria-label={t("templates.showArchived", "Show archived")}
          />
          <span className="text-xs font-medium text-muted-foreground">
            {t("templates.showArchived", "Show archived")}
          </span>
        </label>
      </div>

      <TemplateList
        templates={templates}
        loading={loading}
        busyId={busyId}
        filtered={filtered}
        onEdit={(template) => setEditor({ template })}
        onArchive={toggleArchive}
        onDelete={setPendingDelete}
      />

      {editor && (
        <TemplateEditorSheet
          // Remounting per template is what resets the form — see the note in
          // the sheet itself.
          key={editor.template?.templateId ?? "new"}
          open
          template={editor.template}
          onOpenChange={(open) => {
            if (!open) setEditor(null);
          }}
          onSaved={() => {
            setEditor(null);
            toast.success(t("templates.saved", "Template saved."));
            void load();
          }}
        />
      )}

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title={t("templates.deleteTitle", "Delete this template?")}
        body={t(
          "templates.deleteBody",
          '"{{name}}" will be removed permanently. Rules that used it will need a new message.',
          { name: pendingDelete?.name ?? "" }
        )}
        busy={busyId === pendingDelete?.templateId}
        testId="template-delete-confirm"
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onConfirm={confirmDelete}
      />
    </motion.div>
  );
}
