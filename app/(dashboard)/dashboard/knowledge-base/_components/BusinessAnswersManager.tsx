"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ArchiveRestore, Edit2, Loader2, MessageSquareText, PencilLine, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InstagramIcon, MessengerIcon, WhatsAppIcon } from "@/components/icons/PlatformIcons";
import { useConfirm } from "@/hooks/use-confirm";

type BusinessAnswer = {
  id: string;
  kind: "faq" | "sample_reply";
  context: string;
  answer: string;
  archived: boolean;
  embeddingStatus: string;
  sourcePlatforms: Array<"facebook" | "whatsapp" | "instagram">;
};

type BusinessAnswersManagerProps = {
  workspaceId: string;
  onKnowledgeChange: () => void;
};

export function BusinessAnswersManager({ workspaceId, onKnowledgeChange }: BusinessAnswersManagerProps) {
  const { t } = useTranslation("knowledge-base");
  const confirm = useConfirm((state) => state.confirm);
  const [answers, setAnswers] = useState<BusinessAnswer[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("active");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const platformIcons = {
    facebook: { Icon: MessengerIcon, label: t("businessAnswers.sources.messenger") },
    whatsapp: { Icon: WhatsAppIcon, label: t("businessAnswers.sources.whatsapp") },
    instagram: { Icon: InstagramIcon, label: t("businessAnswers.sources.instagram") },
  } as const;
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessAnswer | null>(null);
  const [context, setContext] = useState("");
  const [answer, setAnswer] = useState("");

  const loadAnswers = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/knowledge-items`, { cache: "no-store" });
      const data: unknown = await response.json();
      if (!response.ok || !Array.isArray(data)) throw new Error("load_failed");
      const nextAnswers = data as BusinessAnswer[];
      setAnswers(nextAnswers);
      setSelectedIds((previous) => new Set(
        [...previous].filter((id) => nextAnswers.some((item) => item.id === id))
      ));
      onKnowledgeChange();
    } catch (error) {
      console.error("[BUSINESS_ANSWERS_LOAD]", error);
      setLoadError(true);
      toast.error(t("businessAnswers.loadError"));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, onKnowledgeChange, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load shared answers when the workspace changes.
    void loadAnswers();
  }, [loadAnswers]);

  const filteredAnswers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return answers.filter((item) => {
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "archived" ? item.archived : !item.archived);
      const matchesQuery = !normalizedQuery
        || item.context.toLocaleLowerCase().includes(normalizedQuery)
        || item.answer.toLocaleLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [answers, query, statusFilter]);
  const selectedAnswers = answers.filter((item) => selectedIds.has(item.id));
  const hasActiveSelected = selectedAnswers.some((item) => !item.archived);
  const hasArchivedSelected = selectedAnswers.some((item) => item.archived);
  const allVisibleSelected = filteredAnswers.length > 0
    && filteredAnswers.every((item) => selectedIds.has(item.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectVisible = () => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (allVisibleSelected) filteredAnswers.forEach((item) => next.delete(item.id));
      else filteredAnswers.forEach((item) => next.add(item.id));
      return next;
    });
  };

  const bulkAction = async (action: "delete" | "archive" | "unarchive") => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/knowledge-items/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      });
      if (!response.ok) throw new Error("bulk_action_failed");
      const messageKey = action === "delete"
        ? "businessAnswers.bulkDeleted"
        : action === "archive" ? "businessAnswers.bulkArchived" : "businessAnswers.bulkRestored";
      toast.success(t(messageKey, { count: ids.length }));
      setSelectedIds(new Set());
      await loadAnswers();
    } catch (error) {
      console.error("[BUSINESS_ANSWERS_BULK_ACTION]", error);
      toast.error(t("businessAnswers.actionError"));
    } finally {
      setBusy(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setContext("");
    setAnswer("");
    setModalOpen(true);
  };

  const openEdit = (item: BusinessAnswer) => {
    setEditing(item);
    setContext(item.context);
    setAnswer(item.answer);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (busy) return;
    setModalOpen(false);
    setEditing(null);
    setContext("");
    setAnswer("");
  };

  const saveAnswer = async () => {
    if (!answer.trim()) {
      toast.error(t("businessAnswers.answerRequired"));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/knowledge-items${editing ? `/${encodeURIComponent(editing.id)}` : ""}`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "answer", context: context.trim(), answer: answer.trim() }),
        }
      );
      if (!response.ok) {
        const result: unknown = await response.json();
        const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error
          : t("businessAnswers.saveError");
        throw new Error(message);
      }
      toast.success(editing ? t("businessAnswers.updated") : t("businessAnswers.created"));
      setModalOpen(false);
      setEditing(null);
      setContext("");
      setAnswer("");
      await loadAnswers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("businessAnswers.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const updateArchivedState = async (item: BusinessAnswer) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/knowledge-items/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: item.archived ? "unarchive" : "archive",
          ids: [item.id],
          kind: item.kind,
        }),
      });
      if (!response.ok) throw new Error("archive_failed");
      toast.success(item.archived ? t("businessAnswers.restored") : t("businessAnswers.archived"));
      setSelectedIds((previous) => {
        const next = new Set(previous);
        next.delete(item.id);
        return next;
      });
      await loadAnswers();
    } catch (error) {
      console.error("[BUSINESS_ANSWER_ARCHIVE]", error);
      toast.error(t("businessAnswers.actionError"));
    } finally {
      setBusy(false);
    }
  };

  const deleteAnswer = (item: BusinessAnswer) => {
    confirm(t("businessAnswers.deleteTitle"), t("businessAnswers.deleteConfirm"), async () => {
      setBusy(true);
      try {
        const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/knowledge-items/${encodeURIComponent(item.id)}`, { method: "DELETE" });
        if (!response.ok) throw new Error("delete_failed");
        toast.success(t("businessAnswers.deleted"));
        await loadAnswers();
      } catch (error) {
        console.error("[BUSINESS_ANSWER_DELETE]", error);
        toast.error(t("businessAnswers.actionError"));
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-3xl space-y-1">
          <p className="text-sm leading-6 text-muted-foreground">{t("businessAnswers.description")}</p>
          <p className="text-xs leading-5 text-muted-foreground">{t("businessAnswers.archiveHelp")}</p>
        </div>
        <Button type="button" onClick={openAdd} className="shrink-0 gap-2">
          <Plus className="size-4" />{t("businessAnswers.add")}
        </Button>
      </div>

      {answers.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("businessAnswers.searchPlaceholder")}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
            <div className="flex shrink-0 rounded-xl border border-border/60 bg-card p-1" role="group" aria-label={t("businessAnswers.statusFilter.label")}>
              {(["all", "active", "archived"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={statusFilter === filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === filter ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  {t(`businessAnswers.statusFilter.${filter}`)}
                </button>
              ))}
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectVisible}
              className="size-4 rounded border-border accent-primary"
              aria-label={t("businessAnswers.selectVisible")}
            />
            {t("businessAnswers.selectVisible")}
          </label>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-semibold text-primary">
            {t("businessAnswers.selectedCount", { count: selectedIds.size })}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            {hasActiveSelected && (
              <Button type="button" variant="outline" size="sm" onClick={() => void bulkAction("archive")} disabled={busy} className="gap-1.5">
                <Archive className="size-3.5" />{t("businessAnswers.archiveSelected")}
              </Button>
            )}
            {hasArchivedSelected && (
              <Button type="button" variant="outline" size="sm" onClick={() => void bulkAction("unarchive")} disabled={busy} className="gap-1.5">
                <ArchiveRestore className="size-3.5" />{t("businessAnswers.restoreSelected")}
              </Button>
            )}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => confirm(
                t("businessAnswers.bulkDeleteTitle"),
                t("businessAnswers.bulkDeleteConfirm", { count: selectedIds.size }),
                () => bulkAction("delete")
              )}
              disabled={busy}
              className="gap-1.5"
            >
              <Trash2 className="size-3.5" />{t("businessAnswers.deleteSelected")}
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label={t("businessAnswers.clearSelection")} onClick={() => setSelectedIds(new Set())} disabled={busy}>
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />{t("businessAnswers.loading")}
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("businessAnswers.loadError")}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadAnswers()} className="mt-3">{t("common.retry")}</Button>
        </div>
      ) : filteredAnswers.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card px-5 py-10 text-center">
          <MessageSquareText className="mb-3 size-8 text-muted-foreground/50" />
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            {query
              ? t("businessAnswers.emptySearch")
              : answers.length > 0
                ? t(`businessAnswers.statusFilter.empty.${statusFilter}`)
                : t("businessAnswers.empty")}
          </p>
          {!query && <Button type="button" variant="outline" size="sm" onClick={openAdd} className="mt-4 gap-2"><Plus className="size-4" />{t("businessAnswers.addFirst")}</Button>}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAnswers.map((item) => (
            <article key={item.id} className={`rounded-xl border p-4 transition-colors ${selectedIds.has(item.id) ? "border-primary/50 bg-primary/5" : item.archived ? "border-border/50 bg-muted/20 opacity-75" : "border-border/70 bg-card"}`}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="mt-1 size-4 shrink-0 rounded border-border accent-primary"
                  aria-label={t("businessAnswers.selectAnswer", { answer: item.context || item.answer.slice(0, 60) })}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-label={t("businessAnswers.sources.label")}>
                    {item.sourcePlatforms.length > 0 ? (
                      <>
                        <span>{t("businessAnswers.sources.conversations")}</span>
                        {item.sourcePlatforms.map((platform) => {
                          const { Icon, label } = platformIcons[platform];
                          return (
                            <span
                              key={platform}
                              className="inline-flex size-7 items-center justify-center rounded-full border border-border/70 bg-muted/50"
                              title={label}
                              aria-label={label}
                            >
                              <Icon className="size-4" />
                            </span>
                          );
                        })}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2 py-1" title={t("businessAnswers.sources.manual")}>
                        <PencilLine className="size-3.5" aria-hidden="true" />
                        {t("businessAnswers.sources.manual")}
                      </span>
                    )}
                  </div>
                  {item.context && (
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("businessAnswers.contextLabel")}</p>
                      <p className="whitespace-pre-wrap text-sm font-medium text-foreground">{item.context}</p>
                    </div>
                  )}
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {item.context ? t("businessAnswers.answerLabel") : t("businessAnswers.generalExampleLabel")}
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{item.answer}</p>
                  </div>
                  {item.archived && <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{t("businessAnswers.archivedBadge")}</span>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
                    <Button type="button" variant="ghost" size="icon" aria-label={t("common.edit")} onClick={() => openEdit(item)} disabled={busy}>
                      <Edit2 className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={item.archived ? t("businessAnswers.restore") : t("businessAnswers.archive")} onClick={() => void updateArchivedState(item)} disabled={busy}>
                      {item.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={t("common.delete")} onClick={() => deleteAnswer(item)} disabled={busy} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="business-answer-title"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-xl overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border/50 bg-secondary/10 px-5 py-4 sm:px-6">
                <div>
                  <h3 id="business-answer-title" className="text-base font-bold text-foreground">
                    {editing ? t("businessAnswers.editTitle") : t("businessAnswers.addTitle")}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("businessAnswers.formDescription")}</p>
                </div>
                <button type="button" onClick={closeModal} disabled={busy} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={t("common.cancel")}>
                  <X className="size-4" />
                </button>
              </div>
              <div className="space-y-4 p-5 sm:p-6">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-foreground">{t("businessAnswers.contextLabel")} <span className="text-xs font-normal text-muted-foreground">({t("businessAnswers.optional")})</span></span>
                  <textarea
                    value={context}
                    onChange={(event) => setContext(event.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder={t("businessAnswers.contextPlaceholder")}
                    className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-foreground">{t("businessAnswers.answerLabel")}</span>
                  <textarea
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    rows={5}
                    maxLength={6000}
                    placeholder={t("businessAnswers.answerPlaceholder")}
                    className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-border/50 bg-secondary/5 px-5 py-4 sm:px-6">
                <Button type="button" variant="outline" onClick={closeModal} disabled={busy}>{t("common.cancel")}</Button>
                <Button type="button" onClick={() => void saveAnswer()} disabled={busy || !answer.trim()}>
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {busy ? t("common.saving") : editing ? t("common.save") : t("common.create")}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
