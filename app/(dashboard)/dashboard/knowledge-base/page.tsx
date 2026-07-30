"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Globe, Type, MessageSquare, Database, Bot, ChevronDown, Search, Plus, Trash2, CheckCircle2, X, Check } from "lucide-react";
import { toast } from "sonner";

import { useConfirm } from "@/hooks/use-confirm";

// Reuse fully-functional tab components from the original sources page
import { FilesTab } from "../chatbots/[chatbotId]/sources/_components/tabs/files-tab";
import { TextTab } from "../chatbots/[chatbotId]/sources/_components/tabs/text-tab";
import { WebsiteTab } from "../chatbots/[chatbotId]/sources/_components/tabs/website-tab";
import { ChatHistoryTab } from "../chatbots/[chatbotId]/sources/_components/tabs/chat-history-tab";
import { KnowledgeBaseList } from "../chatbots/[chatbotId]/sources/_components/knowledge-base-list";
import { EditSourceModal } from "../chatbots/[chatbotId]/sources/_components/edit-source-modal";
import { SourcesSummaryCard } from "../chatbots/[chatbotId]/sources/_components/sources-summary-card";

type SourceItem = {
  sourceId: string;
  type: "file" | "text" | "website";
  name: string;
  charCount: number;
  content?: string;
};

const ADD_TABS = [
  { id: "files",        label: "Files",        icon: FileText    },
  { id: "text",         label: "Text",         icon: Type        },
  { id: "website",      label: "Website",      icon: Globe       },
  { id: "chat_history", label: "Chat History", icon: MessageSquare },
] as const;

type AddTabId = (typeof ADD_TABS)[number]["id"];

export default function GlobalKnowledgeBasePage() {
  const searchParams = useSearchParams();
  const confirm = useConfirm((s) => s.confirm);

  // ── State ──────────────────────────────────────────────────────────────────
  const [chatbots, setChatbots] = useState<any[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>("");
  const [isBotDropdownOpen, setIsBotDropdownOpen] = useState(false);
  const [items, setItems] = useState<SourceItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [isFacebookConnected, setIsFacebookConnected] = useState(false);

  // Add-source modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState<AddTabId>("files");

  // Edit source modal
  const [editingSource, setEditingSource] = useState<SourceItem | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editUrl, setEditUrl] = useState("");

  // ── Load chatbots on mount ─────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/chatbots");
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setChatbots(data);
          const paramBotId = searchParams?.get("botId");
          const initial = paramBotId && data.some((b: any) => b.id === paramBotId)
            ? paramBotId
            : data[0].id;
          setSelectedBotId(initial);
        }
      } catch {
        toast.error("Failed to load AI Agents.");
      }
    }
    init();
  }, []);

  // ── Reload sources + integrations whenever bot changes ────────────────────
  useEffect(() => {
    if (!selectedBotId) return;

    // Sync URL without hard navigation
    const url = new URL(window.location.href);
    url.searchParams.set("botId", selectedBotId);
    window.history.replaceState({}, "", url.toString());

    loadSources();
    loadIntegrations();
  }, [selectedBotId]);

  const loadSources = useCallback(async () => {
    if (!selectedBotId) return;
    try {
      const r = await fetch(`/api/chatbots/${selectedBotId}/sources`);
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load sources");
    }
  }, [selectedBotId]);

  const loadIntegrations = useCallback(async () => {
    if (!selectedBotId) return;
    try {
      const res = await fetch(`/api/chatbots/${selectedBotId}/integrations`);
      const integrations = await res.json();
      const fb = integrations.some(
        (i: any) => (i.platform === "facebook" || i.platform === "n8n_facebook") && i.connected
      );
      setIsFacebookConnected(fb);
    } catch {}
  }, [selectedBotId]);

  const deleteSource = async (sourceId: string) => {
    confirm(
      "Delete Knowledge Source",
      "Are you sure? Your AI will lose access to this information.",
      async () => {
        setBusy(true);
        try {
          const res = await fetch(`/api/chatbots/${selectedBotId}/sources/${sourceId}`, { method: "DELETE" });
          if (!res.ok) throw new Error("Failed to delete");
          toast.success("Knowledge source deleted");
          await loadSources();
        } catch {
          toast.error("Failed to delete source");
        } finally {
          setBusy(false);
        }
      }
    );
  };

  const handleEdit = (source: SourceItem) => {
    setEditingSource(source);
    if (source.type === "text") setEditValue(source.content || "");
    else if (source.type === "website") { setEditUrl(source.name || ""); setEditValue(source.content || ""); }
  };

  const saveEdit = async () => {
    if (!editingSource) return;
    setBusy(true);
    try {
      const body: any = {};
      if (editingSource.type === "text") body.content = editValue;
      else if (editingSource.type === "website") { body.url = editUrl; body.content = editValue; }

      const res = await fetch(`/api/chatbots/${selectedBotId}/sources/${editingSource.sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success("Knowledge source updated");
      setEditingSource(null);
      await loadSources();
    } catch {
      toast.error("Failed to update source");
    } finally {
      setBusy(false);
    }
  };

  const handleSourceAdded = async () => {
    setShowAddModal(false);
    await loadSources();
  };

  const activeBotName = chatbots.find((b) => b.id === selectedBotId)?.name ?? "AI Agent";

  // Filtered display items
  const filteredItems = items.filter((item) =>
    searchQuery.trim() === "" || item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Derived display data ───────────────────────────────────────────────────
  const typeLabel = (type: string) => {
    if (type === "file") return "FILE";
    if (type === "text") return "TEXT";
    if (type === "website") return "URL";
    return type.toUpperCase();
  };

  const typeIcon = (type: string) => {
    if (type === "file") return <FileText className="w-4 h-4 text-blue-400 shrink-0" />;
    if (type === "website") return <Globe className="w-4 h-4 text-emerald-400 shrink-0" />;
    return <Database className="w-4 h-4 text-violet-400 shrink-0" />;
  };

  const formatSize = (chars: number) => {
    if (chars > 1_000_000) return `${(chars / 1_000_000).toFixed(1)} M chars`;
    if (chars > 1_000) return `${Math.round(chars / 1_000)} K chars`;
    return `${chars} chars`;
  };

  if (!selectedBotId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center space-y-2">
          <Database className="w-8 h-8 mx-auto opacity-30" />
          <p className="text-sm">Loading AI Agents…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Database className="w-6 h-6 text-primary" />
          Knowledge Base &amp; RAG Sources
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage vector documents, web scrapes, and custom text prompts assigned across your AI Agents.
        </p>
      </div>

      {/* ── Filter Bot Dropdown + Add Source Button ──────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Premium Custom Bot Selector */}
        <div className="relative">
          <button
            onClick={() => setIsBotDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2.5 bg-card hover:bg-muted/40 border border-border/80 rounded-xl px-3.5 py-2 shadow-xs transition-all cursor-pointer focus:ring-2 focus:ring-primary/30"
          >
            <Bot className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs text-muted-foreground font-medium shrink-0">Filter Bot:</span>
            <span className="text-xs font-bold text-foreground">
              {chatbots.find((b) => b.id === selectedBotId)?.name ?? "Select AI Agent"}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${isBotDropdownOpen ? "rotate-180 text-primary" : ""}`} />
          </button>

          <AnimatePresence>
            {isBotDropdownOpen && (
              <>
                {/* Backdrop click listener */}
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsBotDropdownOpen(false)}
                />

                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-1.5 w-60 bg-card border border-border/80 rounded-xl shadow-xl z-40 p-1.5 space-y-0.5 overflow-hidden"
                >
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 border-b border-border/40 mb-1">
                    Select Active Agent
                  </div>
                  <div className="max-h-56 overflow-y-auto no-scrollbar space-y-0.5">
                    {chatbots.map((bot) => {
                      const isSelected = bot.id === selectedBotId;
                      return (
                        <button
                          key={bot.id}
                          onClick={() => {
                            setSelectedBotId(bot.id);
                            setItems([]);
                            setIsBotDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            isSelected
                              ? "bg-primary/10 text-primary font-bold"
                              : "text-foreground hover:bg-muted/60"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Bot className={`w-3.5 h-3.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                            <span className="truncate">{bot.name}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Add Source Button */}
        <button
          onClick={() => { setAddTab("files"); setShowAddModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Add Knowledge Source
        </button>
      </div>

      {/* ── Search Bar ──────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border/60 rounded-xl px-4 py-2.5 flex items-center gap-3">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Search by source title, URL, or document name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* ── Sources Table ────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border/40 text-[11px] uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Source Title</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Assigned Bot Badge</th>
                <th className="px-4 py-3.5">Size / Vectors</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <Database className="w-7 h-7 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">
                      {searchQuery ? "No sources match your search." : "No knowledge sources yet. Click \"Add Knowledge Source\" to get started."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((src) => (
                  <tr key={src.sourceId} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        {typeIcon(src.type)}
                        <span className="font-medium text-foreground truncate max-w-[280px]">
                          {src.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                        {typeLabel(src.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                        <Bot className="w-3 h-3 text-violet-400" />
                        {activeBotName}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">
                      {formatSize(src.charCount)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        Indexed
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => deleteSource(src.sourceId)}
                        className="p-1.5 text-muted-foreground/40 hover:text-destructive transition-colors rounded opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add Knowledge Source Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              className="bg-card border border-border/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-secondary/10">
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">Add Knowledge Source</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30 ml-1">
                    {activeBotName}
                  </span>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="flex border-b border-border/50 bg-secondary/5 px-4">
                {ADD_TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setAddTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
                        addTab === tab.id
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content — uses fully functional existing components */}
              <div className="p-6 overflow-y-auto flex-1">
                <AnimatePresence mode="wait">
                  {addTab === "files" && (
                    <motion.div
                      key={`modal-files-${selectedBotId}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      <FilesTab chatbotId={selectedBotId} onSuccess={handleSourceAdded} />
                    </motion.div>
                  )}
                  {addTab === "text" && (
                    <motion.div
                      key={`modal-text-${selectedBotId}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      <TextTab chatbotId={selectedBotId} onSuccess={handleSourceAdded} />
                    </motion.div>
                  )}
                  {addTab === "website" && (
                    <motion.div
                      key={`modal-website-${selectedBotId}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      <WebsiteTab chatbotId={selectedBotId} onSuccess={handleSourceAdded} />
                    </motion.div>
                  )}
                  {addTab === "chat_history" && (
                    <motion.div
                      key={`modal-chat-${selectedBotId}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      <ChatHistoryTab
                        chatbotId={selectedBotId}
                        isFacebookConnected={isFacebookConnected}
                        onSuccess={handleSourceAdded}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Edit Source Modal ────────────────────────────────────────────────── */}
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
