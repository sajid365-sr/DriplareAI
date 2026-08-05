"use client";

import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, X } from "lucide-react";

type AddSampleReplyModalProps = {
    open: boolean;
    isEditing: boolean;
    customerMessage: string;
    reply: string;
    busy: boolean;
    onCustomerMessageChange: (value: string) => void;
    onReplyChange: (value: string) => void;
    onSave: () => void;
    onClose: () => void;
};

/**
 * Add / Edit Sample Reply modal. A scenario → ideal-response pair that teaches
 * the AI your tone and persona. Fully localized (BN/EN) and theme-aware.
 */
export function AddSampleReplyModal({
    open,
    isEditing,
    customerMessage,
    reply,
    busy,
    onCustomerMessageChange,
    onReplyChange,
    onSave,
    onClose,
}: AddSampleReplyModalProps) {
    const { t } = useTranslation("knowledge-base");

    const canSave = customerMessage.trim().length > 0 && reply.trim().length > 0;

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
                                <MessageSquare className="h-5 w-5 text-primary" />
                                <h3 className="text-base font-bold text-foreground">
                                    {isEditing
                                        ? t("sampleReplies.modalTitleEdit", "Edit Sample Reply")
                                        : t("sampleReplies.modalTitle", "Add Sample Reply")}
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
                                    "sampleReplies.modalHelper",
                                    "Show the AI a real customer situation and how you'd ideally respond. It learns your voice from these examples."
                                )}
                            </p>

                            <div>
                                <label
                                    htmlFor="sample-customer"
                                    className="mb-1.5 block text-sm font-medium text-foreground"
                                >
                                    {t("sampleReplies.customerLabel", "Customer Query Scenario")}
                                </label>
                                <textarea
                                    id="sample-customer"
                                    value={customerMessage}
                                    onChange={(e) => onCustomerMessageChange(e.target.value)}
                                    placeholder={t(
                                        "sampleReplies.customerPlaceholder",
                                        "Do you deliver to Dhaka?"
                                    )}
                                    rows={3}
                                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="sample-reply"
                                    className="mb-1.5 block text-sm font-medium text-foreground"
                                >
                                    {t("sampleReplies.replyLabel", "Ideal AI Response")}
                                </label>
                                <textarea
                                    id="sample-reply"
                                    value={reply}
                                    onChange={(e) => onReplyChange(e.target.value)}
                                    placeholder={t(
                                        "sampleReplies.replyPlaceholder",
                                        "Yes! We deliver to Dhaka within 1-2 days. 🚚"
                                    )}
                                    rows={4}
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
