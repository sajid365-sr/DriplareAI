"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, Edit2, Trash2, Archive, ArchiveRestore, X } from "lucide-react";
import { toast } from "sonner";

import { useConfirm } from "@/hooks/use-confirm";
import type { KBSectionProps } from "./types";
import { AddFAQModal } from "./AddFAQModal";

type FAQItem = {
    id: string;
    question: string;
    answer: string;
    archived?: boolean;
};

/**
 * FAQs tab — direct question → answer pairs the AI uses for accurate responses.
 * Supports multi-select with bulk delete & archive/unarchive.
 */
export function FAQSection({ agentId }: KBSectionProps) {
    const { t } = useTranslation("knowledge-base");
    const confirm = useConfirm((s) => s.confirm);

    const [faqs, setFaqs] = useState<FAQItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [busy, setBusy] = useState(false);

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Add/Edit modal state
    const [showModal, setShowModal] = useState(false);
    const [editingFaq, setEditingFaq] = useState<FAQItem | null>(null);
    const [questionInput, setQuestionInput] = useState("");
    const [answerInput, setAnswerInput] = useState("");

    // Load FAQs for this agent
    const loadFaqs = useCallback(async () => {
        if (!agentId) return;
        try {
            const res = await fetch(`/api/chatbots/${agentId}/faqs`);
            const data = await res.json();
            setFaqs(Array.isArray(data) ? data : []);
        } catch {
            toast.error(t("faqs.loadError", "Failed to load FAQs"));
        }
    }, [agentId, t]);

    useEffect(() => {
        loadFaqs();
    }, [loadFaqs]);

    // ── Derived data (must come before selection helpers) ────────────────────────
    const filteredFaqs = faqs.filter((faq) => {
        const q = searchQuery.toLowerCase();
        return q === "" || faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q);
    });

    const selectedCount = selectedIds.size;

    const hasArchivedSelected = useMemo(
        () => faqs.filter((f) => selectedIds.has(f.id)).some((f) => f.archived),
        [faqs, selectedIds]
    );
    const hasActiveSelected = useMemo(
        () => faqs.filter((f) => selectedIds.has(f.id)).some((f) => !f.archived),
        [faqs, selectedIds]
    );

    // ── Selection helpers ──────────────────────────────────────────────────────
    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredFaqs.length && filteredFaqs.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredFaqs.map((f) => f.id)));
        }
    };

    const clearSelection = () => setSelectedIds(new Set());

    const isAllSelected = filteredFaqs.length > 0 && selectedIds.size === filteredFaqs.length;
    const isIndeterminate = selectedIds.size > 0 && selectedIds.size < filteredFaqs.length;

    // ── Bulk actions ───────────────────────────────────────────────────────────
    const bulkAction = async (action: "delete" | "archive" | "unarchive") => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;

        setBusy(true);
        try {
            const res = await fetch(`/api/chatbots/${agentId}/faqs/bulk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, ids }),
            });

            if (!res.ok) throw new Error("Bulk action failed");

            const label =
                action === "delete"
                    ? t("faqs.bulkDeleted", "{{count}} FAQs deleted", { count: ids.length })
                    : action === "archive"
                        ? t("faqs.bulkArchived", "{{count}} FAQs archived", { count: ids.length })
                        : t("faqs.bulkUnarchived", "{{count}} FAQs unarchived", { count: ids.length });

            toast.success(label);
            clearSelection();
            await loadFaqs();
        } catch {
            toast.error(t("faqs.bulkError", "Bulk action failed"));
        } finally {
            setBusy(false);
        }
    };

    // ── Single item actions ────────────────────────────────────────────────────
    const openAddModal = () => {
        setEditingFaq(null);
        setQuestionInput("");
        setAnswerInput("");
        setShowModal(true);
    };

    const openEditModal = (faq: FAQItem) => {
        setEditingFaq(faq);
        setQuestionInput(faq.question);
        setAnswerInput(faq.answer);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingFaq(null);
        setQuestionInput("");
        setAnswerInput("");
    };

    const saveFaq = async () => {
        if (!questionInput.trim() || !answerInput.trim()) {
            toast.error(t("faqs.validationError", "Please fill in both question and answer"));
            return;
        }

        setBusy(true);
        try {
            const method = editingFaq ? "PATCH" : "POST";
            const url = editingFaq
                ? `/api/chatbots/${agentId}/faqs/${editingFaq.id}`
                : `/api/chatbots/${agentId}/faqs`;

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: questionInput.trim(), answer: answerInput.trim() }),
            });

            if (!res.ok) throw new Error("Failed to save");

            toast.success(
                editingFaq
                    ? t("faqs.updated", "FAQ updated")
                    : t("faqs.created", "FAQ created")
            );
            closeModal();
            await loadFaqs();
        } catch {
            toast.error(t("faqs.saveError", "Failed to save FAQ"));
        } finally {
            setBusy(false);
        }
    };

    const deleteFaq = (faq: FAQItem) => {
        confirm(
            t("faqs.deleteTitle", "Delete FAQ"),
            t("faqs.deleteConfirm", "Are you sure? Your AI will no longer use this Q&A pair."),
            async () => {
                setBusy(true);
                try {
                    const res = await fetch(`/api/chatbots/${agentId}/faqs/${faq.id}`, { method: "DELETE" });
                    if (!res.ok) throw new Error("Failed to delete");
                    toast.success(t("faqs.deleted", "FAQ deleted"));
                    await loadFaqs();
                } catch {
                    toast.error(t("faqs.deleteError", "Failed to delete FAQ"));
                } finally {
                    setBusy(false);
                }
            }
        );
    };

    return (
        <div className="space-y-4">
            {/* Section description + Add button */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                    {t("faqs.description", "Manage your business FAQs so the AI answers customers accurately.")}
                </p>
                <button
                    type="button"
                    onClick={openAddModal}
                    className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                >
                    <Plus className="h-4 w-4" />
                    {t("faqs.addButton", "Add FAQ")}
                </button>
            </div>

            {/* Search bar */}
            {faqs.length > 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder={t("faqs.searchPlaceholder", "Search FAQs...")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                </div>
            )}

            {/* Bulk action bar — appears when items are selected */}
            {selectedCount > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
                    <span className="text-sm font-semibold text-primary">
                        {t("faqs.selectedCount", "{{count}} selected", { count: selectedCount })}
                    </span>

                    <div className="flex gap-2 ml-auto">
                        {/* Archive / Unarchive based on selection */}
                        {hasActiveSelected && (
                            <button
                                type="button"
                                onClick={() => bulkAction("archive")}
                                disabled={busy}
                                className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                            >
                                <Archive className="h-3.5 w-3.5" />
                                {t("faqs.archive", "Archive")}
                            </button>
                        )}
                        {hasArchivedSelected && (
                            <button
                                type="button"
                                onClick={() => bulkAction("unarchive")}
                                disabled={busy}
                                className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                            >
                                <ArchiveRestore className="h-3.5 w-3.5" />
                                {t("faqs.unarchive", "Unarchive")}
                            </button>
                        )}

                        {/* Delete */}
                        <button
                            type="button"
                            onClick={() =>
                                confirm(
                                    t("faqs.bulkDeleteTitle", "Delete Selected FAQs"),
                                    t("faqs.bulkDeleteConfirm", "Are you sure? This will permanently delete {{count}} FAQs.", { count: selectedCount }),
                                    () => bulkAction("delete")
                                )
                            }
                            disabled={busy}
                            className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t("faqs.delete", "Delete")}
                        </button>

                        {/* Clear selection */}
                        <button
                            type="button"
                            onClick={clearSelection}
                            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* FAQs list */}
            {filteredFaqs.length === 0 ? (
                <EmptyState
                    isSearching={searchQuery.length > 0}
                    searchLabel={t("faqs.emptySearch", "No FAQs match your search.")}
                    emptyLabel={t("faqs.empty", "No FAQs added yet. Click the 'Add FAQ' button to create one.")}
                />
            ) : (
                <>
                    {/* Mobile: stacked cards */}
                    <div className="space-y-2 sm:hidden">
                        {filteredFaqs.map((faq) => (
                            <div
                                key={faq.id}
                                className={`rounded-xl border p-4 transition-colors ${selectedIds.has(faq.id)
                                    ? "border-primary/50 bg-primary/5"
                                    : "border-border/60 bg-card"
                                    } ${faq.archived ? "opacity-60" : ""}`}
                            >
                                <div className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(faq.id)}
                                        onChange={() => toggleSelect(faq.id)}
                                        className="mt-1 h-4 w-4 shrink-0 rounded border-border accent-primary"
                                    />
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-foreground">{faq.question}</h4>
                                            {faq.archived && (
                                                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                                                    {t("faqs.archived", "Archived")}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">{faq.answer}</p>
                                    </div>
                                    <div className="flex shrink-0 gap-1">
                                        <button
                                            type="button"
                                            onClick={() => openEditModal(faq)}
                                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                            aria-label={t("common.edit", "Edit")}
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteFaq(faq)}
                                            disabled={busy}
                                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                            aria-label={t("common.delete", "Delete")}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop: table */}
                    <div className="hidden overflow-hidden rounded-2xl border border-border/60 bg-card sm:block">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-border/60 bg-secondary/10 text-xs uppercase tracking-wider text-muted-foreground">
                                    <th className="w-10 px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={isAllSelected}
                                            ref={(el) => {
                                                if (el) el.indeterminate = isIndeterminate;
                                            }}
                                            onChange={toggleSelectAll}
                                            className="h-4 w-4 rounded border-border accent-primary"
                                        />
                                    </th>
                                    <th className="px-4 py-3 font-semibold">
                                        {t("faqs.colQuestion", "Question")}
                                    </th>
                                    <th className="px-4 py-3 font-semibold">
                                        {t("faqs.colAnswer", "Answer")}
                                    </th>
                                    <th className="w-24 px-4 py-3 text-right font-semibold">
                                        {t("faqs.colActions", "Actions")}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredFaqs.map((faq) => (
                                    <tr
                                        key={faq.id}
                                        className={`group border-b border-border/40 transition-colors last:border-0 ${selectedIds.has(faq.id) ? "bg-primary/5" : "hover:bg-secondary/5"
                                            } ${faq.archived ? "opacity-60" : ""}`}
                                    >
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(faq.id)}
                                                onChange={() => toggleSelect(faq.id)}
                                                className="h-4 w-4 rounded border-border accent-primary"
                                            />
                                        </td>
                                        <td className="max-w-xs px-4 py-3 align-top">
                                            <span className="font-medium text-foreground">{faq.question}</span>
                                            {faq.archived && (
                                                <span className="ml-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                                                    {t("faqs.archived", "Archived")}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 align-top text-muted-foreground">
                                            {faq.answer}
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                                <button
                                                    type="button"
                                                    onClick={() => openEditModal(faq)}
                                                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                                    aria-label={t("common.edit", "Edit")}
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => deleteFaq(faq)}
                                                    disabled={busy}
                                                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                                    aria-label={t("common.delete", "Delete")}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Add/Edit Modal */}
            <AddFAQModal
                open={showModal}
                isEditing={!!editingFaq}
                question={questionInput}
                answer={answerInput}
                busy={busy}
                onQuestionChange={setQuestionInput}
                onAnswerChange={setAnswerInput}
                onSave={saveFaq}
                onClose={closeModal}
            />
        </div>
    );
}

/** Friendly SVG empty state for the FAQ list. */
function EmptyState({
    isSearching,
    searchLabel,
    emptyLabel,
}: {
    isSearching: boolean;
    searchLabel: string;
    emptyLabel: string;
}) {
    return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card py-16 text-center">
            <svg
                className="mb-4 h-16 w-16 text-muted-foreground/25"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
            </svg>
            <p className="max-w-xs text-sm text-muted-foreground">
                {isSearching ? searchLabel : emptyLabel}
            </p>
        </div>
    );
}
