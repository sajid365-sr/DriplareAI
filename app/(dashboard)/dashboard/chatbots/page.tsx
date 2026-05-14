"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChatbotsHeader } from "./_components/ChatbotsHeader";
import { PlanLimitsBanner } from "./_components/PlanLimitsBanner";
import { ChatbotRow } from "./_components/ChatbotRow";
import { EmptyState } from "./_components/EmptyState";

export default function ChatbotList() {
  const { t } = useTranslation("chatbots");
  const [bots, setBots] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [botsRes, usageRes] = await Promise.all([
        fetch("/api/chatbots"),
        fetch("/api/usage"),
      ]);
      const botsData = await botsRes.json();
      const usageData = await usageRes.json();
      
      setBots(Array.isArray(botsData) ? botsData : []);
      if (usageRes.ok) setUsage(usageData);
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    load();
  }, []);

  const del = async (id: string) => {
    try {
      const res = await fetch(`/api/chatbots/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete chatbot");
      toast.success(t("messages.deleteSuccess", "Chatbot and all its data deleted successfully"));
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const newStatus = currentStatus === "paused" ? "active" : "paused";
    
    try {
      const res = await fetch(`/api/chatbots/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("messages.failedStatusChange", "Failed to change status"));
      }

      toast.success(t("messages.statusChangeSuccess", { status: newStatus === "active" ? t("status.active") : t("status.paused") }));
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const isLimitReached = usage && bots.length >= usage.includedChatbots;

  return (
    <div className="space-y-6">
      <ChatbotsHeader isLimitReached={isLimitReached} limit={usage?.includedChatbots || 0} />
      
      <PlanLimitsBanner usage={usage} botsCount={bots.length} />

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-12 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
          <div className="col-span-4">{t("table.botName", "Bot Name")}</div>
          <div className="col-span-3">{t("table.lastModified", "Last Modified")}</div>
          <div className="col-span-2">{t("table.connected", "Connected")}</div>
          <div className="col-span-1">{t("table.status", "Status")}</div>
          <div className="col-span-2 text-right">{t("table.action", "Action")}</div>
        </div>
        
        {loading && (
          <div className="p-10 text-center text-muted-foreground">
            {t("messages.loading", "Loading…")}
          </div>
        )}
        
        {!loading && bots.length === 0 && <EmptyState />}
        
        {!loading && bots.map((b, i) => (
          <ChatbotRow 
            key={b.chatbotId} 
            bot={b} 
            index={i} 
            toggleStatus={toggleStatus} 
            onDelete={del} 
          />
        ))}
      </div>
    </div>
  );
}
