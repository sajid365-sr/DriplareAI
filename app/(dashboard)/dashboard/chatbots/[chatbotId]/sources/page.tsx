"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { FileText, Globe, Type, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { useConfirm } from "@/hooks/use-confirm";
import { N8nSourceUploader } from "@/components/integrations/n8n-source-uploader";

import { SourcesSummaryCard } from "./_components/sources-summary-card";
import { KnowledgeBaseList } from "./_components/knowledge-base-list";
import { EditSourceModal } from "./_components/edit-source-modal";
import { FilesTab } from "./_components/tabs/files-tab";
import { TextTab } from "./_components/tabs/text-tab";
import { WebsiteTab } from "./_components/tabs/website-tab";
import { ChatHistoryTab } from "./_components/tabs/chat-history-tab";

type SourceItem = {
  sourceId: string;
  type: "file" | "text" | "website";
  name: string;
  charCount: number;
  content?: string;
};

const TABS = [
  { id: "files", label: "Files", icon: FileText },
  { id: "text", label: "Text", icon: Type },
  { id: "website", label: "Website", icon: Globe },
  { id: "chat_history", label: "Chat History", icon: MessageSquare },
] as const;

export default function Sources() {
  const params = useParams();
  const chatbotId = params?.chatbotId as string;
  const confirm = useConfirm((state) => state.confirm);

  const [items, setItems] = useState<SourceItem[]>([]);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("files");
  const [busy, setBusy] = useState(false);
  const [isFacebookConnected, setIsFacebookConnected] = useState(false);

  // Edit states
  const [editingSource, setEditingSource] = useState<SourceItem | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [n8nConfig, setN8nConfig] = useState<any>(null);

  const load = async () => {
    if (!chatbotId) return;
    try {
      const r = await fetch(`/api/chatbots/${chatbotId}/sources`);
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load sources");
    }
  };

  useEffect(() => {
    if (!chatbotId) return;
    void (async () => {
      await load();

      // Fetch chatbot integrations to check FB status & n8n config
      try {
        const intRes = await fetch(`/api/chatbots/${chatbotId}/integrations`);
        const integrations = await intRes.json();

        // Check FB connected
        const isFb = integrations.some(
          (i: any) =>
            (i.platform === "facebook" || i.platform === "n8n_facebook") && i.connected
        );
        setIsFacebookConnected(isFb);

        // n8n source config
        const n8nSource = integrations.find(
          (i: any) => i.platform === "n8n_source" && i.connected
        );
        if (n8nSource) setN8nConfig(n8nSource.config);
      } catch {
        console.error("Failed to fetch integrations");
      }
    })();
  }, [chatbotId]);

  const del = async (sourceId: string) => {
    confirm(
      "Delete Knowledge Source",
      "Are you sure you want to delete this source? Your AI will no longer have access to this information.",
      async () => {
        setBusy(true);
        try {
          const response = await fetch(`/api/chatbots/${chatbotId}/sources/${sourceId}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: "Failed to delete source" }));
            throw new Error(error.error || "Failed to delete source");
          }

          toast.success("Knowledge source deleted successfully");
          await load();
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to delete source";
          toast.error(message);
        } finally {
          setBusy(false);
        }
      }
    );
  };

  const handleEdit = (source: SourceItem) => {
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
      const body: any = {};
      if (editingSource.type === "text") {
        body.content = editValue;
      } else if (editingSource.type === "website") {
        body.url = editUrl;
        body.content = editValue;
      }

      const response = await fetch(`/api/chatbots/${chatbotId}/sources/${editingSource.sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to update source" }));
        throw new Error(error.error || "Failed to update source");
      }

      toast.success("Knowledge source updated successfully");
      setEditingSource(null);
      await load();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update source";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Sources</h1>
        <SourcesSummaryCard items={items} />
      </div>

      <div className="bg-card rounded-3xl border border-border/60 shadow-sm overflow-hidden">
        <div className="px-8 py-4 border-b border-border/60 bg-secondary/10 font-semibold text-sm">
          Data Sources:
        </div>

        <div className="flex flex-col md:flex-row h-full min-h-[400px]">
          {/* Tabs sidebar */}
          <div className="w-full md:w-48 bg-secondary/20 p-3 space-y-1 border-r border-border/60">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-card text-primary shadow-sm border border-border/40"
                    : "text-muted-foreground hover:bg-card/50 hover:text-foreground"
                }`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? "text-primary" : ""}`} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 p-4 sm:p-6 lg:p-8">
            <AnimatePresence mode="wait">
              {activeTab === "files" && (
                <FilesTab key="files" chatbotId={chatbotId} onSuccess={load} />
              )}

              {activeTab === "text" && (
                <TextTab key="text" chatbotId={chatbotId} onSuccess={load} />
              )}

              {activeTab === "website" && (
                <WebsiteTab key="website" chatbotId={chatbotId} onSuccess={load} />
              )}

              {activeTab === "chat_history" && (
                <ChatHistoryTab
                  key="chat_history"
                  chatbotId={chatbotId}
                  isFacebookConnected={isFacebookConnected}
                  onSuccess={load}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {n8nConfig?.ingestUrl && (
        <N8nSourceUploader chatbotId={chatbotId} ingestUrl={n8nConfig.ingestUrl} />
      )}

      {/* Knowledge base items table */}
      <KnowledgeBaseList items={items} onEdit={handleEdit} onDelete={del} />

      {/* Edit modal */}
      <EditSourceModal
        source={editingSource}
        editValue={editValue}
        editUrl={editUrl}
        busy={busy}
        onEditValueChange={setEditValue}
        onEditUrlChange={setEditUrl}
        onSave={saveEdit}
        onDelete={del}
        onClose={() => setEditingSource(null)}
      />
    </div>
  );
}
