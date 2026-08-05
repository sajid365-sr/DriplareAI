"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search, FileText, Type, Globe, X, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { useConfirm } from "@/hooks/use-confirm";

// Reuse the fully-functional source components from the per-chatbot Sources page.
import { FilesTab } from "@/app/(dashboard)/dashboard/chatbots/[chatbotId]/sources/_components/tabs/files-tab";
import { TextTab } from "@/app/(dashboard)/dashboard/chatbots/[chatbotId]/sources/_components/tabs/text-tab";
import { WebsiteTab } from "@/app/(dashboard)/dashboard/chatbots/[chatbotId]/sources/_components/tabs/website-tab";
import { KnowledgeBaseList } from "@/app/(dashboard)/dashboard/chatbots/[chatbotId]/sources/_components/knowledge-base-list";
import { EditSourceModal } from "@/app/(dashboard)/dashboard/chatbots/[chatbotId]/sources/_components/edit-source-modal";

// Right-side Drawer
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerClose,
} from "@/components/ui/drawer";

import type { KBSectionProps, ContentSource } from "./types";

type AddTabDef = {
    id: "files" | "text" | "website";
    labelKey: string;
    fallback: string;
    icon: LucideIcon;
};

const ADD_TABS: AddTabDef[] = [
    { id: "files", labelKey: "contentTraining.sources.files", fallback: "Files", icon: FileText },
    { id: "text", labelKey: "contentTraining.sources.text", fallback: "Text", icon: Type },
    { id: "website", labelKey: "contentTraining.sources.website", fallback: "Website", icon: Globe },
];

/**
 * Content Training tab — trains the AI with custom content:
 * Files, pasted Text, and scraped Websites.
 * Reuses the existing per-chatbot source components inside a right-side Drawer.
 * (FB Smart Picker has been removed — it lives in the Auto Train Engine now.)
 */
export function ContentTrainingSection({ agentId, agentName }: KBSectionProps) {
    const { t } = useTranslation("knowledge-base");
    const confirm = useConfirm((s) => s.confirm);

    const [items, setItems] = useState<ContentSource[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [busy, setBusy] = useState(false);

    // Add-content drawer
    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [addTab, setAddTab] = useState<AddTabDef["id"]>("files");

    // Edit-source modal
    const [editingSource, setEditingSource] = useState<ContentSource | null>(null);
    const [editValue, setEditValue] = useState("");
    const [editUrl, setEditUrl] = useState("");

    // ── Data loading ───────────────────────────────────────────────────────────
    const loadSources = useCallback(async () => {
        if (!agentId) return;
        try {
            const r = await fetch(`/api/chatbots/${agentId}/sources`);
            const data = await r.json();
            setItems(Array.isArray(data) ? data : []);
        } catch {
            toast.error("Failed to load content");
        }
    }, [agentId]);

    useEffect(() => {
        loadSources();
    }, [loadSources]);

    // ── Mutations ──────────────────────────────────────────────────────────────
    const handleContentAdded = async () => {
        setShowAddDrawer(false);
        await loadSources();
    };

    const handleEdit = (source: ContentSource) => {
        setEditingSource(source);
        if (source.type === "text") {
            setEditValue(source.content || "");
        } else if (source.type === "website") {
            setEditUrl(source.name || "");
            setEditValue(source.content || "");
        }
    };

    const saveEdit = async () => {
        if (!editingSource) return;
        setBusy(true);
        try {
            const body: Record<string, string> = {};
            if (editingSource.type === "text") {
                body.content = editValue;
            } else if (editingSource.type === "website") {
                body.url = editUrl;
                body.content = editValue;
            }

            const res = await fetch(`/api/chatbots/${agentId}/sources/${editingSource.sourceId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error("Failed to update");
            toast.success("Content updated");
            setEditingSource(null);
            await loadSources();
        } catch {
            toast.error("Failed to update content");
        } finally {
            setBusy(false);
        }
    };

    const deleteSource = (sourceId: string) => {
        confirm(
            "Delete Content",
            "Are you sure? Your AI will lose access to this information.",
            async () => {
                setBusy(true);
                try {
                    const res = await fetch(`/api/chatbots/${agentId}/sources/${sourceId}`, { method: "DELETE" });
                    if (!res.ok) throw new Error("Failed to delete");
                    toast.success("Content deleted");
                    await loadSources();
                } catch {
                    toast.error("Failed to delete content");
                } finally {
                    setBusy(false);
                }
            }
        );
    };

    const filteredItems = items.filter(
        (item) => searchQuery.trim() === "" || item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-4">
            {/* Section description + toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                    {t("contentTraining.description", "Train the AI with your custom content for better responses.")}
                </p>
                <div className="flex items-center gap-2.5">
                    {/* Search */}
                    <div className="flex flex-1 items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 sm:w-56">
                        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder={t("contentTraining.searchPlaceholder", "Search content...")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                    </div>
                    {/* Add Content */}
                    <button
                        type="button"
                        onClick={() => {
                            setAddTab("files");
                            setShowAddDrawer(true);
                        }}
                        className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                    >
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">{t("contentTraining.addButton", "Add Content")}</span>
                    </button>
                </div>
            </div>

            {/* Content list / empty state */}
            {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card py-16 text-center">
                    <FileText className="mb-3 h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-foreground">
                        {searchQuery ? "No content matches your search." : t("contentTraining.empty", "No content found")}
                    </p>
                    {!searchQuery && (
                        <p className="mt-1 text-xs text-muted-foreground">
                            {t("contentTraining.emptyHint", "Get started by adding your first content.")}
                        </p>
                    )}
                </div>
            ) : (
                <KnowledgeBaseList items={filteredItems} onEdit={handleEdit} onDelete={deleteSource} />
            )}

            {/* Add Content Drawer — opens from the right side */}
            <Drawer open={showAddDrawer} onOpenChange={setShowAddDrawer} swipeDirection="right">
                <DrawerContent className="w-full sm:max-w-lg">
                    {/* Drawer header */}
                    <DrawerHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-secondary/10 px-6 py-4">
                        <div className="flex items-center gap-2">
                            <Plus className="h-5 w-5 text-primary" />
                            <DrawerTitle className="text-base font-bold text-foreground">
                                {t("contentTraining.addButton", "Add Content")}
                            </DrawerTitle>
                            <span className="ml-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                {agentName}
                            </span>
                        </div>
                        <DrawerClose
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <X className="h-4 w-4" />
                        </DrawerClose>
                    </DrawerHeader>

                    {/* Sub-tab navigation */}
                    <div className="no-scrollbar flex overflow-x-auto border-b border-border/50 bg-secondary/5 px-4">
                        {ADD_TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = addTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setAddTab(tab.id)}
                                    className={`-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-all ${isActive
                                        ? "border-primary text-primary"
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {t(tab.labelKey, tab.fallback)}
                                </button>
                            );
                        })}
                    </div>

                    {/* Sub-tab content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={`${addTab}-${agentId}`}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.15 }}
                            >
                                {addTab === "files" && <FilesTab chatbotId={agentId} onSuccess={handleContentAdded} />}
                                {addTab === "text" && <TextTab chatbotId={agentId} onSuccess={handleContentAdded} />}
                                {addTab === "website" && <WebsiteTab chatbotId={agentId} onSuccess={handleContentAdded} />}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </DrawerContent>
            </Drawer>

            {/* Edit Source Modal */}
            <EditSourceModal
                source={editingSource}
                editValue={editValue}
                editUrl={editUrl}
                busy={busy}
                onEditValueChange={setEditValue}
                onEditUrlChange={setEditUrl}
                onSave={saveEdit}
                onDelete={deleteSource}
                onClose={() => setEditingSource(null)}
            />
        </div>
    );
}
