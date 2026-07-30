"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { LiveInboxHeader } from "../chatbots/[chatbotId]/activity/_components/live-inbox-header";
import { SessionList } from "../chatbots/[chatbotId]/activity/_components/session-list";
import { ConversationPanel } from "../chatbots/[chatbotId]/activity/_components/conversation-panel";
import { CrmPanel } from "../chatbots/[chatbotId]/activity/_components/crm-panel";
import { LeadStatus } from "../chatbots/[chatbotId]/activity/_components/lead-status-badge";

export default function GlobalLiveInboxPage() {
  const confirm = useConfirm((state) => state.confirm);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation("live-inbox");

  // ── State ──────────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<any[]>([]);
  const [integrationStatus, setIntegrationStatus] = useState<any>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [filter, setFilter] = useState("All");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatbotId, setChatbotId] = useState<string | null>(null);

  // Initial fetch of first available chatbot or all chatbots
  useEffect(() => {
    async function loadChatbots() {
      try {
        const res = await fetch("/api/chatbots");
        const bots = await res.json();
        if (Array.isArray(bots) && bots.length > 0) {
          setChatbotId(bots[0].id);
        } else {
          setLoadingSessions(false);
        }
      } catch {
        setLoadingSessions(false);
      }
    }
    loadChatbots();
  }, []);

  // ── Derived Sessions Filtering ──────────────────────────────────────────────
  const filteredSessions = useMemo(() => {
    let result = sessions;
    if (filter !== "All") {
      result = result.filter((s) => s.platform === filter.toLowerCase());
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.title.toLowerCase().includes(q));
    }
    return result;
  }, [sessions, filter, searchQuery]);

  const activeSessionData = useMemo(
    () => sessions.find((s) => s.sessionId === selectedSession) ?? null,
    [sessions, selectedSession]
  );

  // ── Effects & Auto Polling ──────────────────────────────────────────────────
  useEffect(() => {
    if (chatbotId) fetchSessions();
  }, [chatbotId]);

  useEffect(() => {
    if (selectedSession && chatbotId) fetchMessages(selectedSession);
  }, [selectedSession, chatbotId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto Polling (10s sessions, 5s messages)
  useEffect(() => {
    if (!chatbotId) return;
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, [chatbotId]);

  useEffect(() => {
    if (!selectedSession || !chatbotId) return;
    const interval = setInterval(() => fetchMessages(selectedSession), 5000);
    return () => clearInterval(interval);
  }, [selectedSession, chatbotId]);

  useEffect(() => {
    if (filteredSessions.length > 0) {
      const stillVisible = filteredSessions.some((s) => s.sessionId === selectedSession);
      if (!stillVisible) setSelectedSession(filteredSessions[0].sessionId);
    } else {
      setSelectedSession(null);
      setMessages([]);
    }
  }, [filter, searchQuery, sessions]);

  // ── API Handlers ───────────────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    if (!chatbotId) return;
    try {
      setLoadingSessions(true);
      const res = await fetch(`/api/chatbots/${chatbotId}/sessions`);
      const data = await res.json();
      const list = data.sessions ?? [];
      setSessions(list);
      setIntegrationStatus(data.integration);
      setPlatforms(data.platforms ?? ["web"]);
      if (list.length > 0 && !selectedSession) {
        setSelectedSession(list[0].sessionId);
      }
    } catch (err) {
      console.error("[fetchSessions]", err);
    } finally {
      setLoadingSessions(false);
    }
  }, [chatbotId, selectedSession]);

  const fetchMessages = useCallback(async (sessionId: string) => {
    if (!chatbotId) return;
    try {
      setLoadingMessages(true);
      const res = await fetch(
        `/api/chatbots/${chatbotId}/messages?sessionId=${sessionId}`
      );
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[fetchMessages]", err);
    } finally {
      setLoadingMessages(false);
    }
  }, [chatbotId]);

  const deleteSession = (sessionId: string) => {
    if (!chatbotId) return;
    confirm(
      "Delete Chat Session",
      "Are you sure? This action cannot be undone.",
      async () => {
        try {
          const res = await fetch(
            `/api/chatbots/${chatbotId}/sessions/${sessionId}`,
            { method: "DELETE" }
          );
          if (res.ok) {
            toast.success("Session deleted");
            fetchSessions();
            if (selectedSession === sessionId) {
              setSelectedSession(null);
              setMessages([]);
            }
          } else toast.error("Failed to delete");
        } catch {
          toast.error("An error occurred");
        }
      }
    );
  };

  const deleteSelectedSessions = async () => {
    if (selectedSessionIds.length === 0 || !chatbotId) return;
    confirm(
      "Delete Selected Sessions",
      `Delete ${selectedSessionIds.length} session(s)? This cannot be undone.`,
      async () => {
        try {
          const results = await Promise.all(
            selectedSessionIds.map((id) =>
              fetch(`/api/chatbots/${chatbotId}/sessions/${id}`, { method: "DELETE" })
            )
          );
          const allOk = results.every((r) => r.ok);
          toast[allOk ? "success" : "error"](
            allOk ? "Sessions deleted" : "Some sessions failed to delete"
          );
          setSelectedSessionIds([]);
          fetchSessions();
          if (selectedSession && selectedSessionIds.includes(selectedSession)) {
            setSelectedSession(null);
            setMessages([]);
          }
        } catch {
          toast.error("An error occurred during deletion");
        }
      }
    );
  };

  const toggleSessionStatus = async (sessionId: string, currentStatus: boolean) => {
    if (!chatbotId) return;
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) {
        setSessions((prev) =>
          prev.map((s) =>
            s.sessionId === sessionId ? { ...s, isActive: !currentStatus } : s
          )
        );
        toast.success(`AI is now ${!currentStatus ? "Active" : "Paused (Manual Mode)"}`);
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const updateLeadStatus = async (sessionId: string, status: LeadStatus) => {
    if (!chatbotId) return;
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadStatus: status }),
      });
      if (res.ok) {
        setSessions((prev) =>
          prev.map((s) =>
            s.sessionId === sessionId ? { ...s, leadStatus: status } : s
          )
        );
        toast.success(`Lead status updated to ${status}`);
      }
    } catch {
      toast.error("Failed to update lead status");
    }
  };

  const sendHumanMessage = async (content: string) => {
    if (!selectedSession || !content.trim() || !chatbotId) return;
    setIsSendingMessage(true);
    try {
      const optimisticMsg = {
        id: `temp-${Date.now()}`,
        role: "assistant",
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticMsg]);

      const res = await fetch(`/api/chatbots/${chatbotId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSession,
          content,
          role: "assistant",
          source: "human_agent",
        }),
      });
      if (!res.ok) {
        toast.error("Failed to send message");
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const formatShortDate = (date: string) =>
    `${new Date(date).toLocaleDateString("en-GB")} AT ${new Date(date).toLocaleTimeString(
      "en-US",
      { hour: "numeric", minute: "numeric", hour12: true }
    )}`;

  const downloadSession = () => {
    if (!selectedSession || messages.length === 0) return;
    const session = sessions.find((s) => s.sessionId === selectedSession);
    let content = `Chat Session: ${session?.title ?? "Chat Session"}\nSession ID: ${selectedSession}\n\n`;
    messages.forEach(
      (msg) =>
        (content += `[${new Date(msg.timestamp).toLocaleString()}] ${
          msg.role === "user" ? "User" : "AI"
        }:\n${msg.content}\n\n`)
    );
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-session-${selectedSession.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col h-[calc(100vh-4.5rem)] max-h-[950px] -m-4 md:-m-6"
    >
      {/* Top Filter Header Bar */}
      <LiveInboxHeader
        activeChannel={filter}
        onChannelChange={setFilter}
        totalContactsCount={sessions.length}
      />

      {/* ── 3-Column Live Inbox Main Layout ── */}
      <div className="flex-1 flex gap-3 p-3 overflow-hidden min-h-0 bg-background/50">
        
        {/* Column 1: Left Session List (330px) */}
        <SessionList
          sessions={sessions}
          filteredSessions={filteredSessions}
          loadingSessions={loadingSessions}
          selectedSession={selectedSession}
          onSelectSession={setSelectedSession}
          onRefresh={fetchSessions}
          filter={filter}
          onFilterChange={setFilter}
          integrationStatus={integrationStatus}
          platforms={platforms}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedSessionIds={selectedSessionIds}
          onToggleSelectSession={(id) =>
            setSelectedSessionIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            )
          }
          onSelectAllSessions={(checked) =>
            setSelectedSessionIds(checked ? filteredSessions.map((s) => s.sessionId) : [])
          }
          onDeleteSelectedSessions={deleteSelectedSessions}
          onToggleSessionStatus={toggleSessionStatus}
        />

        {/* Column 2: Middle Conversation Thread (flex-1) */}
        <ConversationPanel
          selectedSession={selectedSession}
          messages={messages}
          loadingMessages={loadingMessages}
          activeSessionData={activeSessionData}
          onDelete={deleteSession}
          onDownload={downloadSession}
          onToggleStatus={toggleSessionStatus}
          onSendHumanMessage={sendHumanMessage}
          isSendingMessage={isSendingMessage}
          formatShortDate={formatShortDate}
          messagesEndRef={messagesEndRef}
        />

        {/* Column 3: Right CRM Details Panel (300px) */}
        <CrmPanel
          session={activeSessionData}
          messages={messages}
          onUpdateLeadStatus={updateLeadStatus}
        />
      </div>
    </motion.div>
  );
}
