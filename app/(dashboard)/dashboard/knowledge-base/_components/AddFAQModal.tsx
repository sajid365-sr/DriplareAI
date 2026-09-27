"use client";

import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { HelpCircle, X } from "lucide-react";

type AddFAQModalProps = {
    open: boolean;
    isEditing: boolean;
    question: string;
    answer: string;
    busy: boolean;
    onQuestionChange: (value: string) => void;
    onAnswerChange: (value: string) => void;
    onSave: () => void;
    onClose: () => void;
};

/**
 * Add / Edit FAQ modal. A single Q&A pair the AI uses to answer customers accurately.
 * Fully localized (BN/EN) and theme-aware.
 */
export function AddFAQModal({
    open,
    isEditing,
    question,
    answer,
    busy,
    onQuestionChange,
    onAnswerChange,
    onSave,
    onClose,
}: AddFAQModalProps) {
    const { t } = useTranslation("knowledge-base");

    const canSave = question.trim().length > 0 && answer.trim().length > 0;

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 8 }}
                        transition={{ duration: 0.2 }}
                        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl"
                    >
                        {/* Modal header */}
                        <div className="flex items-center justify-between border-b border-border/50 bg-secondary/10 px-6 py-4">
                            <div className="flex items-center gap-2">
                                <HelpCircle className="h-5 w-5 text-primary" />
                                <h3 className="text-base font-bold text-foreground">
                                    {isEditing
                                        ? t("faqs.modalTitleEdit", "Edit FAQ")
                                        : t("faqs.modalTitle", "Add New FAQ")}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                aria-label={t("common.cancel", "Cancel")}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="space-y-4 p-6">
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                {t(
                                    "faqs.modalHelper",
                                    "Write a question a customer might ask, and the exact answer your AI should give."
                                )}
                            </p>

                            <div>
                                <label
                                    htmlFor="faq-question"
                                    className="mb-1.5 block text-sm font-medium text-foreground"
                                >
                                    {t("faqs.questionLabel", "Question (প্রশ্ন)")}
                                </label>
                                <input
                                    id="faq-question"
                                    type="text"
                                    value={question}
                                    onChange={(e) => onQuestionChange(e.target.value)}
                                    placeholder={t("faqs.questionPlaceholder", "What are your business hours?")}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="faq-answer"
                                    className="mb-1.5 block text-sm font-medium text-foreground"
                                >
                                    {t("faqs.answerLabel", "Answer (উত্তর)")}
                                </label>
                                <textarea
                                    id="faq-answer"
                                    value={answer}
                                    onChange={(e) => onAnswerChange(e.target.value)}
                                    placeholder={t(
                                        "faqs.answerPlaceholder",
                                        "We're open Monday to Friday, 9am to 6pm."
                                    )}
                                    rows={5}
                                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="flex justify-end gap-2 border-t border-border/50 bg-secondary/5 px-6 py-4">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={busy}
                                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                {t("common.cancel", "Cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={onSave}
                                disabled={busy || !canSave}
                                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                            >
                                {busy
                                    ? t("common.saving", "Saving…")
                                    : isEditing
                                        ? t("common.save", "Save")
                                        : t("common.create", "Create")}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
