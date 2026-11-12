"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ArchiveRestore, Edit2, Loader2, MessageSquareText, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";

type BusinessAnswer = {
  id: string;
  kind: "faq" | "sample_reply";
  context: string;
  answer: string;
  archived: boolean;
  embeddingStatus: string;
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
  const [loading, setLoading] = useState(true);
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
      setAnswers(data as BusinessAnswer[]);
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
    if (!normalizedQuery) return answers;
    return answers.filter((item) =>
      item.context.toLocaleLowerCase().includes(normalizedQuery)
      || item.answer.toLocaleLowerCase().includes(normalizedQuery)
    );
  }, [answers, query]);

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
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {t("businessAnswers.description")}
        </p>
        <Button type="button" onClick={openAdd} className="shrink-0 gap-2">
          <Plus className="size-4" />{t("businessAnswers.add")}
        </Button>
      </div>

      {answers.length > 0 && (
        <label className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("businessAnswers.searchPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
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
            {query ? t("businessAnswers.emptySearch") : t("businessAnswers.empty")}
          </p>
          {!query && <Button type="button" variant="outline" size="sm" onClick={openAdd} className="mt-4 gap-2"><Plus className="size-4" />{t("businessAnswers.addFirst")}</Button>}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAnswers.map((item) => (
            <article key={item.id} className={`rounded-xl border p-4 transition-colors ${item.archived ? "border-border/50 bg-muted/20 opacity-75" : "border-border/70 bg-card"}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1 space-y-3">
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
