"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Pencil, HelpCircle, MessageSquare, FileText, Sparkles } from "lucide-react";

import type { AutoTrainDrafts } from "./autoTrainTypes";

type FaqDraft = { keep: boolean; editing: boolean; question: string; answer: string };
type SampleDraft = { keep: boolean; editing: boolean; customerMessage: string; reply: string };
type ContentDraft = { keep: boolean; editing: boolean; title: string; content: string };

type TabId = "faqs" | "sampleReplies" | "content";

type AutoTrainReviewProps = {
    drafts: AutoTrainDrafts;
    busy: boolean;
    onApply: (kept: AutoTrainDrafts) => void;
    onCancel: () => void;
};

/**
 * Auto-Train step 3 — review, edit and pick which AI drafts to keep.
 * Everything is checked by default; only kept (and edited) items are applied.
 */
export function AutoTrainReview({ drafts, busy, onApply, onCancel }: AutoTrainReviewProps) {
    const { t } = useTranslation("knowledge-base");

    const [faqs, setFaqs] = useState<FaqDraft[]>(
        drafts.faqs.map((f) => ({ ...f, keep: true, editing: false }))
    );
    const [samples, setSamples] = useState<SampleDraft[]>(
        drafts.sampleReplies.map((s) => ({ ...s, keep: true, editing: false }))
    );
    const [content, setContent] = useState<ContentDraft[]>(
        drafts.content.map((c) => ({ ...c, keep: true, editing: false }))
    );

    const [activeTab, setActiveTab] = useState<TabId>(
        faqs.length > 0 ? "faqs" : samples.length > 0 ? "sampleReplies" : "content"
    );

    const totalDrafts = faqs.length + samples.length + content.length;
    const keptCount =
        faqs.filter((f) => f.keep).length +
        samples.filter((s) => s.keep).length +
        content.filter((c) => c.keep).length;

    const tabs: Array<{ id: TabId; label: string; count: number; Icon: typeof HelpCircle }> = [
        { id: "faqs", label: t("autoTrain.tabFaqs", "FAQs"), count: faqs.length, Icon: HelpCircle },
        {
            id: "sampleReplies",
            label: t("autoTrain.tabSampleReplies", "Sample replies"),
            count: samples.length,
            Icon: MessageSquare,
        },
        { id: "content", label: t("autoTrain.tabContent", "Content"), count: content.length, Icon: FileText },
    ];

    function handleApply() {
        onApply({
            faqs: faqs.filter((f) => f.keep).map((f) => ({ question: f.question, answer: f.answer })),
            sampleReplies: samples
                .filter((s) => s.keep)
                .map((s) => ({ customerMessage: s.customerMessage, reply: s.reply })),
            content: content.filter((c) => c.keep).map((c) => ({ title: c.title, content: c.content })),
        });
    }

    function deselectAll() {
        setFaqs((prev) => prev.map((f) => ({ ...f, keep: false })));
        setSamples((prev) => prev.map((s) => ({ ...s, keep: false })));
        setContent((prev) => prev.map((c) => ({ ...c, keep: false })));
    }

    // Empty state — AI found nothing usable
    if (totalDrafts === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card py-16 text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <Sparkles className="h-7 w-7" />
                </span>
                <p className="max-w-sm text-sm text-muted-foreground">
                    {t(
                        "autoTrain.emptyDrafts",
                        "We couldn't find enough in these conversations to draft training. Try selecting more chats or another platform."
                    )}
                </p>
                <button
                    type="button"
                    onClick={onCancel}
                    className="mt-5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                    {t("common.back", "Back")}
                </button>
            </div>
        );
    }

    const inputCls =
        "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

    return (
        <div className="space-y-4">
            {/* Header */}
            <div>
                <h3 className="text-base font-bold text-foreground">
                    {t("autoTrain.reviewTitle", "Review & edit")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    {t("autoTrain.foundCount", "Found {{count}} suggestions. Uncheck anything you don't want.", {
                        count: totalDrafts,
                    })}
                </p>
            </div>

            {/* Tab pills */}
            <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === tab.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/70"
                            }`}
                    >
                        <tab.Icon className="h-4 w-4" />
                        {tab.label} ({tab.count})
                    </button>
                ))}
            </div>

            {/* Draft list */}
            <div className="space-y-2.5">
                {activeTab === "faqs" &&
                    faqs.map((item, i) => (
                        <DraftCard
                            key={i}
                            keep={item.keep}
                            onToggle={() =>
                                setFaqs((prev) => prev.map((f, j) => (j === i ? { ...f, keep: !f.keep } : f)))
                            }
                            editing={item.editing}
                            onEditToggle={() =>
                                setFaqs((prev) => prev.map((f, j) => (j === i ? { ...f, editing: !f.editing } : f)))
                            }
                            title={item.question}
                            body={item.answer}
                            editContent={
                                <div className="space-y-2">
                                    <input
                                        className={inputCls}
                                        value={item.question}
                                        onChange={(e) =>
                                            setFaqs((prev) =>
                                                prev.map((f, j) => (j === i ? { ...f, question: e.target.value } : f))
                                            )
                                        }
                                    />
                                    <textarea
                                        className={`${inputCls} resize-none`}
                                        rows={3}
                                        value={item.answer}
                                        onChange={(e) =>
                                            setFaqs((prev) =>
                                                prev.map((f, j) => (j === i ? { ...f, answer: e.target.value } : f))
                                            )
                                        }
                                    />
                                </div>
                            }
                        />
                    ))}

                {activeTab === "sampleReplies" &&
                    samples.map((item, i) => (
                        <DraftCard
                            key={i}
                            keep={item.keep}
                            onToggle={() =>
                                setSamples((prev) => prev.map((s, j) => (j === i ? { ...s, keep: !s.keep } : s)))
                            }
                            editing={item.editing}
                            onEditToggle={() =>
                                setSamples((prev) =>
                                    prev.map((s, j) => (j === i ? { ...s, editing: !s.editing } : s))
                                )
                            }
                            title={item.customerMessage}
                            body={item.reply}
                            editContent={
                                <div className="space-y-2">
                                    <input
                                        className={inputCls}
                                        value={item.customerMessage}
                                        onChange={(e) =>
                                            setSamples((prev) =>
                                                prev.map((s, j) => (j === i ? { ...s, customerMessage: e.target.value } : s))
                                            )
                                        }
                                    />
                                    <textarea
                                        className={`${inputCls} resize-none`}
                                        rows={3}
                                        value={item.reply}
                                        onChange={(e) =>
                                            setSamples((prev) =>
                                                prev.map((s, j) => (j === i ? { ...s, reply: e.target.value } : s))
                                            )
                                        }
                                    />
                                </div>
                            }
                        />
                    ))}

                {activeTab === "content" &&
                    content.map((item, i) => (
                        <DraftCard
                            key={i}
                            keep={item.keep}
                            onToggle={() =>
                                setContent((prev) => prev.map((c, j) => (j === i ? { ...c, keep: !c.keep } : c)))
                            }
                            editing={item.editing}
                            onEditToggle={() =>
                                setContent((prev) =>
                                    prev.map((c, j) => (j === i ? { ...c, editing: !c.editing } : c))
                                )
                            }
                            title={item.title}
                            body={item.content}
                            editContent={
                                <div className="space-y-2">
                                    <input
                                        className={inputCls}
                                        value={item.title}
                                        onChange={(e) =>
                                            setContent((prev) =>
                                                prev.map((c, j) => (j === i ? { ...c, title: e.target.value } : c))
                                            )
                                        }
                                    />
                                    <textarea
                                        className={`${inputCls} resize-none`}
                                        rows={4}
                                        value={item.content}
                                        onChange={(e) =>
                                            setContent((prev) =>
                                                prev.map((c, j) => (j === i ? { ...c, content: e.target.value } : c))
                                            )
                                        }
                                    />
                                </div>
                            }
                        />
                    ))}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-4">
                <button
                    type="button"
                    onClick={deselectAll}
                    disabled={busy || keptCount === 0}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                    {t("autoTrain.deselectAll", "Deselect all")}
                </button>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        {t("common.cancel", "Cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={handleApply}
                        disabled={busy || keptCount === 0}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                        {busy
                            ? t("common.saving", "Saving…")
                            : t("autoTrain.addToAgent", "Add {{count}} to agent", { count: keptCount })}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Draft card ─────────────────────────────────────────────────────────────

type DraftCardProps = {
    keep: boolean;
    onToggle: () => void;
    editing: boolean;
    onEditToggle: () => void;
    title: string;
    body: string;
    editContent: React.ReactNode;
};

function DraftCard({ keep, onToggle, editing, onEditToggle, title, body, editContent }: DraftCardProps) {
    const { t } = useTranslation("knowledge-base");

    return (
        <div
            className={`rounded-xl border p-3.5 transition-colors ${keep ? "border-border/60 bg-card" : "border-border/40 bg-muted/30 opacity-60"
                }`}
        >
            <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button
                    type="button"
                    onClick={onToggle}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${keep ? "border-primary bg-primary text-primary-foreground" : "border-border"
                        }`}
                    aria-pressed={keep}
                >
                    {keep && <Check className="h-3 w-3" />}
                </button>

                <div className="min-w-0 flex-1">
                    {editing ? (
                        editContent
                    ) : (
                        <>
                            <p className="text-sm font-medium text-foreground">{title}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{body}</p>
                        </>
                    )}
                </div>

                {/* Edit toggle */}
                <button
                    type="button"
                    onClick={onEditToggle}
                    className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                    <Pencil className="h-3 w-3" />
                    {editing ? t("common.done", "Done") : t("common.edit", "Edit")}
                </button>
            </div>
        </div>
    );
}
