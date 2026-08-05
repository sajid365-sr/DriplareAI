"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, Edit2, Trash2, Archive, ArchiveRestore, X } from "lucide-react";
import { toast } from "sonner";

import { useConfirm } from "@/hooks/use-confirm";
import type { KBSectionProps } from "./types";
import { AddSampleReplyModal } from "./AddSampleReplyModal";

type SampleReply = {
    id: string;
    customerMessage: string;
    reply: string;
    archived?: boolean;
};

/**
 * Sample Replies tab — tone/persona training examples.
 * Shows the AI how to respond in your voice by example.
 * Supports multi-select with bulk delete & archive/unarchive.
 */
export function SampleRepliesSection({ agentId }: KBSectionProps) {
    const { t } = useTranslation("knowledge-base");
    const confirm = useConfirm((s) => s.confirm);

    const [replies, setReplies] = useState<SampleReply[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [busy, setBusy] = useState(false);

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Add/Edit modal state
    const [showModal, setShowModal] = useState(false);
    const [editingReply, setEditingReply] = useState<SampleReply | null>(null);
    const [customerInput, setCustomerInput] = useState("");
    const [replyInput, setReplyInput] = useState("");

    // Load sample replies for this agent
    const loadReplies = useCallback(async () => {
        if (!agentId) return;
        try {
            const res = await fetch(`/api/chatbots/${agentId}/sample-replies`);
            const data = await res.json();
            setReplies(Array.isArray(data) ? data : []);
        } catch {
            toast.error(t("sampleReplies.loadError", "Failed to load sample replies"));
        }
    }, [agentId, t]);

    useEffect(() => {
        loadReplies();
    }, [loadReplies]);

    // ── Derived data (must come before selection helpers) ────────────────────────
    const filteredReplies = replies.filter((reply) => {
        const q = searchQuery.toLowerCase();
        return (
            q === "" ||
            reply.customerMessage.toLowerCase().includes(q) ||
            reply.reply.toLowerCase().includes(q)
        );
    });

    const selectedCount = selectedIds.size;

    const hasArchivedSelected = useMemo(
        () => replies.filter((r) => selectedIds.has(r.id)).some((r) => r.archived),
        [replies, selectedIds]
    );
    const hasActiveSelected = useMemo(
        () => replies.filter((r) => selectedIds.has(r.id)).some((r) => !r.archived),
        [replies, selectedIds]
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
        if (selectedIds.size === filteredReplies.length && filteredReplies.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredReplies.map((r) => r.id)));
        }
    };

    const clearSelection = () => setSelectedIds(new Set());

    const isAllSelected = filteredReplies.length > 0 && selectedIds.size === filteredReplies.length;
    const isIndeterminate = selectedIds.size > 0 && selectedIds.size < filteredReplies.length;

    // ── Bulk actions ───────────────────────────────────────────────────────────
    const bulkAction = async (action: "delete" | "archive" | "unarchive") => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;

        setBusy(true);
        try {
            const res = await fetch(`/api/chatbots/${agentId}/sample-replies/bulk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, ids }),
            });

            if (!res.ok) throw new Error("Bulk action failed");

            const label =
                action === "delete"
                    ? t("sampleReplies.bulkDeleted", "{{count}} sample replies deleted", { count: ids.length })
                    : action === "archive"
                        ? t("sampleReplies.bulkArchived", "{{count}} sample replies archived", { count: ids.length })
                        : t("sampleReplies.bulkUnarchived", "{{count}} sample replies unarchived", { count: ids.length });

            toast.success(label);
            clearSelection();
            await loadReplies();
        } catch {
            toast.error(t("sampleReplies.bulkError", "Bulk action failed"));
        } finally {
            setBusy(false);
        }
    };

    // ── Single item actions ────────────────────────────────────────────────────
    const openAddModal = () => {
        setEditingReply(null);
        setCustomerInput("");
        setReplyInput("");
        setShowModal(true);
    };

    const openEditModal = (reply: SampleReply) => {
        setEditingReply(reply);
        setCustomerInput(reply.customerMessage);
        setReplyInput(reply.reply);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingReply(null);
        setCustomerInput("");
        setReplyInput("");
    };

    const saveReply = async () => {
        if (!customerInput.trim() || !replyInput.trim()) {
            toast.error(t("sampleReplies.validationError", "Please fill in both fields"));
            return;
        }

        setBusy(true);
        try {
            const method = editingReply ? "PATCH" : "POST";
            const url = editingReply
                ? `/api/chatbots/${agentId}/sample-replies/${editingReply.id}`
                : `/api/chatbots/${agentId}/sample-replies`;

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerMessage: customerInput.trim(), reply: replyInput.trim() }),
            });

            if (!res.ok) throw new Error("Failed to save");

            toast.success(
                editingReply
                    ? t("sampleReplies.updated", "Sample reply updated")
                    : t("sampleReplies.created", "Sample reply created")
            );
            closeModal();
            await loadReplies();
        } catch {
            toast.error(t("sampleReplies.saveError", "Failed to save sample reply"));
        } finally {
            setBusy(false);
        }
    };

    const deleteReply = (reply: SampleReply) => {
        confirm(
            t("sampleReplies.deleteTitle", "Delete Sample Reply"),
            t("sampleReplies.deleteConfirm", "Are you sure? Your AI will no longer use this tone example."),
            async () => {
                setBusy(true);
                try {
                    const res = await fetch(`/api/chatbots/${agentId}/sample-replies/${reply.id}`, { method: "DELETE" });
                    if (!res.ok) throw new Error("Failed to delete");
                    toast.success(t("sampleReplies.deleted", "Sample reply deleted"));
                    await loadReplies();
                } catch {
                    toast.error(t("sampleReplies.deleteError", "Failed to delete sample reply"));
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
                    {t("sampleReplies.description", "Manage sample replies to help the AI generate consistent responses.")}
                </p>
                <button
                    type="button"
                    onClick={openAddModal}
                    className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                >
                    <Plus className="h-4 w-4" />
                    {t("sampleReplies.addButton", "Add Reply")}
                </button>
            </div>

            {/* Search bar */}
            {replies.length > 0 && (
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder={t("sampleReplies.searchPlaceholder", "Search sample replies...")}
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
                        {t("sampleReplies.selectedCount", "{{count}} selected", { count: selectedCount })}
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
                                {t("sampleReplies.archive", "Archive")}
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
                                {t("sampleReplies.unarchive", "Unarchive")}
                            </button>
                        )}

                        {/* Delete */}
                        <button
                            type="button"
                            onClick={() =>
                                confirm(
                                    t("sampleReplies.bulkDeleteTitle", "Delete Selected Sample Replies"),
                                    t("sampleReplies.bulkDeleteConfirm", "Are you sure? This will permanently delete {{count}} sample replies.", { count: selectedCount }),
                                    () => bulkAction("delete")
                                )
                            }
                            disabled={busy}
                            className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t("sampleReplies.delete", "Delete")}
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

            {/* Replies list */}
            {filteredReplies.length === 0 ? (
                <EmptyState
                    isSearching={searchQuery.length > 0}
                    searchLabel={t("sampleReplies.emptySearch", "No sample replies match your search.")}
                    emptyLabel={t("sampleReplies.empty", "No sample replies added yet. Click the 'Add Reply' button to create one.")}
                />
            ) : (
                <>
                    {/* Mobile: stacked cards */}
                    <div className="space-y-2 sm:hidden">
                        {filteredReplies.map((reply) => (
                            <div
                                key={reply.id}
                                className={`rounded-xl border p-4 transition-colors ${selectedIds.has(reply.id)
                                    ? "border-primary/50 bg-primary/5"
                                    : "border-border/60 bg-card"
                                    } ${reply.archived ? "opacity-60" : ""}`}
                            >
                                <div className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(reply.id)}
                                        onChange={() => toggleSelect(reply.id)}
                                        className="mt-1 h-4 w-4 shrink-0 rounded border-border accent-primary"
                                    />
                                    <div className="min-w-0 flex-1 space-y-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    {t("sampleReplies.customerLabel", "Customer Query Scenario")}
                                                </p>
                                                {reply.archived && (
                                                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                                                        {t("sampleReplies.archived", "Archived")}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-foreground">{reply.customerMessage}</p>
                                        </div>
                                        <div>
                                            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                {t("sampleReplies.replyLabel", "Ideal AI Response")}
                                            </p>
                                            <p className="text-sm text-primary">{reply.reply}</p>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 gap-1">
                                        <button
                                            type="button"
                                            onClick={() => openEditModal(reply)}
                                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                            aria-label={t("common.edit", "Edit")}
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteReply(reply)}
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
                                        {t("sampleReplies.customerLabel", "Customer Query Scenario")}
                                    </th>
                                    <th className="px-4 py-3 font-semibold">
                                        {t("sampleReplies.replyLabel", "Ideal AI Response")}
                                    </th>
                                    <th className="w-24 px-4 py-3 text-right font-semibold">
                                        {t("sampleReplies.colActions", "Actions")}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredReplies.map((reply) => (
                                    <tr
                                        key={reply.id}
                                        className={`group border-b border-border/40 transition-colors last:border-0 ${selectedIds.has(reply.id) ? "bg-primary/5" : "hover:bg-secondary/5"
                                            } ${reply.archived ? "opacity-60" : ""}`}
                                    >
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(reply.id)}
                                                onChange={() => toggleSelect(reply.id)}
                                                className="h-4 w-4 rounded border-border accent-primary"
                                            />
                                        </td>
                                        <td className="max-w-xs px-4 py-3 align-top">
                                            <span className="font-medium text-foreground">{reply.customerMessage}</span>
                                            {reply.archived && (
                                                <span className="ml-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                                                    {t("sampleReplies.archived", "Archived")}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 align-top text-primary">
                                            {reply.reply}
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                                <button
                                                    type="button"
                                                    onClick={() => openEditModal(reply)}
                                                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                                    aria-label={t("common.edit", "Edit")}
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => deleteReply(reply)}
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
            <AddSampleReplyModal
                open={showModal}
                isEditing={!!editingReply}
                customerMessage={customerInput}
                reply={replyInput}
                busy={busy}
                onCustomerMessageChange={setCustomerInput}
                onReplyChange={setReplyInput}
                onSave={saveReply}
                onClose={closeModal}
            />
        </div>
    );
}

/** Friendly SVG empty state for the sample-replies list. */
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
                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
                <path d="M8 12h.01" />
                <path d="M12 12h.01" />
                <path d="M16 12h.01" />
            </svg>
            <p className="max-w-xs text-sm text-muted-foreground">
                {isSearching ? searchLabel : emptyLabel}
            </p>
        </div>
    );
}
