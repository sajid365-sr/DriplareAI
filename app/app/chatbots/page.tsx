"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Plus, Trash2, Pencil, Globe, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/use-confirm";

export default function ChatbotList() {
  const { t } = useTranslation();
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const confirm = useConfirm((state) => state.confirm);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/chatbots");
      const data = await r.json();
      setBots(Array.isArray(data) ? data : []);
    } finally { 
      setLoading(false); 
    }
  };
  
  useEffect(() => { load(); }, []);

  const del = async (id: string, e: React.MouseEvent) => {
    e.preventDefault(); 
    e.stopPropagation();
    
    const bot = bots.find(b => b.chatbotId === id);
    confirm(
      "Delete Chatbot",
      `Are you sure you want to delete "${bot?.name || 'this chatbot'}"? All data associated with this bot will be permanently removed.`,
      async () => {
        await fetch(`/api/chatbots/${id}`, { method: "DELETE" });
        toast.success("Chatbot and all its data deleted successfully");
        load();
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="ai-agents-title">{t("common.aiAgents", "AI Agents")}</h1>
        <Button onClick={() => router.push("/app/chatbots/new")} className="bg-foreground text-background hover:bg-foreground/90 rounded-full" data-testid="new-chatbot-btn">
          <Plus className="w-4 h-4 mr-1.5" /> {t("common.newChatbot", "New Chatbot")}
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-12 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
          <div className="col-span-4">{t("common.botName", "Bot Name")}</div>
          <div className="col-span-3">{t("common.lastModified", "Last Modified")}</div>
          <div className="col-span-2">{t("common.connectedCol", "Connected")}</div>
          <div className="col-span-1">{t("common.status", "Status")}</div>
          <div className="col-span-2 text-right">{t("common.action", "Action")}</div>
        </div>
        {loading && <div className="p-10 text-center text-muted-foreground">Loading…</div>}
        {!loading && bots.length === 0 && (
          <div className="p-12 text-center" data-testid="empty-state">
            <Bot className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">No chatbots yet — create your first one</p>
            <Button onClick={() => router.push("/app/chatbots/new")} className="rounded-full" data-testid="empty-create-btn">
              <Plus className="w-4 h-4 mr-1" /> {t("common.newChatbot", "New Chatbot")}
            </Button>
          </div>
        )}
        {bots.map((b, i) => (
          <motion.div key={b.chatbotId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Link href={`/app/chatbots/${b.chatbotId}/chat`} className="grid grid-cols-12 px-6 py-4 items-center hover:bg-muted/50 border-b border-border last:border-b-0 group" data-testid={`bot-row-${b.chatbotId}`}>
              <div className="col-span-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-fuchsia-500 text-white flex items-center justify-center font-semibold">
                  {b.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">{b.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" /> {b._count?.sources || 0} sources</div>
                </div>
              </div>
              <div className="col-span-3 text-sm text-muted-foreground">
                {new Date(b.updatedAt || b.createdAt).toLocaleString()}
              </div>
              <div className="col-span-2 text-sm">
                {/* Dummy connected connections count */}
                {b.connections_count > 0 ? <span className="text-primary font-medium">{b.connections_count} channel{b.connections_count > 1 ? "s" : ""}</span> : <span className="text-muted-foreground">—</span>}
              </div>
              <div className="col-span-1">
                <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 border-0">{t("common.active", "Active")}</Badge>
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <Button size="sm" variant="outline" className="h-8" onClick={(e) => { e.preventDefault(); router.push(`/app/chatbots/${b.chatbotId}/settings`); }} data-testid={`edit-${b.chatbotId}`}>
                  <Pencil className="w-3 h-3 mr-1" /> {t("common.edit", "Edit")}
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-destructive hover:text-destructive" onClick={(e) => del(b.chatbotId, e)} data-testid={`del-${b.chatbotId}`}>
                  <Trash2 className="w-3 h-3 mr-1" /> {t("common.delete", "Delete")}
                </Button>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
