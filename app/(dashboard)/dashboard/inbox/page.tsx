"use client";

import { useEffect, useState, useRef, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";

import { LiveInboxHeader } from "../chatbots/[chatbotId]/activity/_components/live-inbox-header";
import { SessionList } from "../chatbots/[chatbotId]/activity/_components/session-list";
import { ConversationPanel } from "../chatbots/[chatbotId]/activity/_components/conversation-panel";
import { CrmPanel } from "../chatbots/[chatbotId]/activity/_components/crm-panel";
import { LeadStatus } from "../chatbots/[chatbotId]/activity/_components/lead-status-badge";

const TAB_PARAM_MAP: Record<string, string> = {
  all: "allContacts",
  allcontacts: "allContacts",
  order_requests: "orderRequests",
  orderrequests: "orderRequests",
  unreplied: "unreplied",
  tickets: "tickets",
  resolved: "resolved",
  archived: "archived",
};

const TAB_KEY_TO_PARAM: Record<string, string> = {
  allContacts: "all",
  orderRequests: "order_requests",
  unreplied: "unreplied",
  tickets: "tickets",
  resolved: "resolved",
  archived: "archived",
};

function GlobalLiveInboxContent() {
  const confirm = useConfirm((state) => state.confirm);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation("live-inbox");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // ── URL State Sync for Active Status Tab ─────────────────────────────────
  const currentTabParam = searchParams.get("tab");
  const activeStatusTab = TAB_PARAM_MAP[currentTabParam?.toLowerCase() || ""] || "allContacts";

  const handleStatusTabChange = useCallback(
    (newTab: string) => {
      const paramVal = TAB_KEY_TO_PARAM[newTab] || "all";
      const params = new URLSearchParams(searchParams.toString());
      if (paramVal === "all") {
        params.delete("tab");
      } else {
        params.set("tab", paramVal);
      }
      const queryStr = params.toString();
      router.push(queryStr ? `${pathname}?${queryStr}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

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

  // ── Dynamic Status Counts ──────────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    return {
      allContacts: sessions.filter((s) => !s.isArchived).length,
      orderRequests: sessions.filter(
        (s) =>
          !s.isArchived &&
          ((s.hasOrderIntent === true && !s.orderConfirmed) ||
            s.leadStatus === "high_prospect" ||
            s.topic?.toLowerCase().includes("order"))
      ).length,
      unreplied: sessions.filter(
        (s) =>
          !s.isArchived &&
          ((s.lastMessageSender === "customer" && s.unread === true) ||
            s.isActive === false ||
            s.leadStatus === "risky")
      ).length,
      tickets: sessions.filter(
        (s) =>
          !s.isArchived &&
          ((s as any).isHumanNeeded === true ||
            (s as any).aiStatus === "stopped" ||
            s.isActive === false ||
            s.isTicket === true ||
            s.topic?.toLowerCase().includes("code") ||
            s.topic?.toLowerCase().includes("issue"))
      ).length,
      resolved: sessions.filter(
        (s) =>
          !s.isArchived &&
          (s.status === "resolved" || s.leadStatus === "successful")
      ).length,
      archived: sessions.filter((s) => s.isArchived === true).length,
    };
  }, [sessions]);

  // ── Derived Sessions Filtering ──────────────────────────────────────────────
  const filteredSessions = useMemo(() => {
    let result = sessions;

    // Platform Filter
    if (filter !== "All") {
      result = result.filter((s) => s.platform.toLowerCase() === filter.toLowerCase());
    }

    // Top Status Tab Filter
    if (activeStatusTab === "allContacts") {
      result = result.filter((s) => !s.isArchived);
    } else if (activeStatusTab === "orderRequests") {
      result = result.filter(
        (s) =>
          !s.isArchived &&
          ((s.hasOrderIntent === true && !s.orderConfirmed) ||
            s.leadStatus === "high_prospect" ||
            s.topic?.toLowerCase().includes("order"))
      );
    } else if (activeStatusTab === "unreplied") {
      result = result.filter(
        (s) =>
          !s.isArchived &&
          ((s.lastMessageSender === "customer" && s.unread === true) ||
            s.isActive === false ||
            s.leadStatus === "risky")
      );
    } else if (activeStatusTab === "tickets") {
      result = result.filter(
        (s) =>
          !s.isArchived &&
          ((s as any).isHumanNeeded === true ||
            (s as any).aiStatus === "stopped" ||
            s.isActive === false ||
            s.isTicket === true ||
            s.topic?.toLowerCase().includes("code") ||
            s.topic?.toLowerCase().includes("issue"))
      );
    } else if (activeStatusTab === "resolved") {
      result = result.filter(
        (s) =>
          !s.isArchived &&
          (s.status === "resolved" || s.leadStatus === "successful")
      );
    } else if (activeStatusTab === "archived") {
      result = result.filter((s) => s.isArchived === true);
    }

    // Search Query Filter
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.title.toLowerCase().includes(q));
    }
    return result;
  }, [sessions, filter, activeStatusTab, searchQuery]);

  const activeSessionData = useMemo(
    () => sessions.find((s) => s.sessionId === selectedSession) ?? null,
    [sessions, selectedSession]
  );

  // ── API Handlers (With Silent Background Polling Support) ──────────────────
  const fetchSessions = useCallback(
    async (silent = false) => {
      if (!chatbotId) return;
      try {
        if (!silent) setLoadingSessions(true);
        const res = await fetch(`/api/chatbots/${chatbotId}/sessions`);
        const data = await res.json();
        let list = data.sessions ?? [];

        // Auto-seed demo sessions if database is empty for this chatbot
        if (list.length === 0 && !silent) {
          const seedRes = await fetch(`/api/chatbots/${chatbotId}/seed`, { method: "POST" });
          if (seedRes.ok) {
            const freshRes = await fetch(`/api/chatbots/${chatbotId}/sessions`);
            const freshData = await freshRes.json();
            list = freshData.sessions ?? [];
          }
        }

        setSessions((prev) => (JSON.stringify(prev) === JSON.stringify(list) ? prev : list));
        setIntegrationStatus(data.integration);
        setPlatforms(data.platforms ?? ["web", "facebook", "whatsapp", "instagram"]);
        if (list.length > 0 && !selectedSession) {
          setSelectedSession(list[0].sessionId);
        }
      } catch (err) {
        console.error("[fetchSessions]", err);
      } finally {
        if (!silent) setLoadingSessions(false);
      }
    },
    [chatbotId, selectedSession]
  );

  const fetchMessages = useCallback(
    async (sessionId: string, silent = false) => {
      if (!chatbotId) return;
      try {
        if (!silent) setLoadingMessages(true);
        const res = await fetch(
          `/api/chatbots/${chatbotId}/messages?sessionId=${sessionId}`
        );
        const data = await res.json();
        const newList = Array.isArray(data) ? data : [];
        setMessages((prev) => (JSON.stringify(prev) === JSON.stringify(newList) ? prev : newList));
      } catch (err) {
        console.error("[fetchMessages]", err);
      } finally {
        if (!silent) setLoadingMessages(false);
      }
    },
    [chatbotId]
  );

  // ── Effects & Auto Polling (Silent background sync) ────────────────────────
  useEffect(() => {
    if (chatbotId) fetchSessions(false);
  }, [chatbotId, fetchSessions]);

  useEffect(() => {
    if (selectedSession && chatbotId) fetchMessages(selectedSession, false);
  }, [selectedSession, chatbotId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Background Auto Polling (10s sessions, 5s messages) - Silent Mode
  useEffect(() => {
    if (!chatbotId) return;
    const interval = setInterval(() => fetchSessions(true), 10000);
    return () => clearInterval(interval);
  }, [chatbotId, fetchSessions]);

  useEffect(() => {
    if (!selectedSession || !chatbotId) return;
    const interval = setInterval(() => fetchMessages(selectedSession, true), 5000);
    return () => clearInterval(interval);
  }, [selectedSession, chatbotId, fetchMessages]);

  useEffect(() => {
    if (filteredSessions.length > 0) {
      const stillVisible = filteredSessions.some((s) => s.sessionId === selectedSession);
      if (!stillVisible) setSelectedSession(filteredSessions[0].sessionId);
    } else {
      setSelectedSession(null);
      setMessages([]);
    }
  }, [filter, searchQuery, activeStatusTab]);

  // ── API Handlers ───────────────────────────────────────────────────────────
  const seedDemoChats = useCallback(async () => {
    if (!chatbotId) return;
    try {
      setLoadingSessions(true);
      const res = await fetch(`/api/chatbots/${chatbotId}/seed`, { method: "POST" });
      if (res.ok) {
        toast.success("Demo chat sessions & messages saved to Neon DB!");
        const freshRes = await fetch(`/api/chatbots/${chatbotId}/sessions`);
        const freshData = await freshRes.json();
        const list = freshData.sessions ?? [];
        setSessions(list);
        setIntegrationStatus(freshData.integration);
        setPlatforms(freshData.platforms ?? ["web", "facebook", "whatsapp", "instagram"]);
        if (list.length > 0) setSelectedSession(list[0].sessionId);
      } else {
        toast.error("Failed to seed demo data");
      }
    } catch {
      toast.error("Error seeding demo data");
    } finally {
      setLoadingSessions(false);
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

  const toggleArchiveSession = async (sessionId: string, currentIsArchived: boolean) => {
    if (!chatbotId) return;
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !currentIsArchived }),
      });
      if (res.ok) {
        setSessions((prev) =>
          prev.map((s) =>
            s.sessionId === sessionId ? { ...s, isArchived: !currentIsArchived } : s
          )
        );
        toast.success(currentIsArchived ? "Chat unarchived" : "Chat archived");
      }
    } catch {
      toast.error("Failed to update archive status");
    }
  };

  const archiveSelectedSessions = async (archive: boolean) => {
    if (selectedSessionIds.length === 0 || !chatbotId) return;
    try {
      const results = await Promise.all(
        selectedSessionIds.map((id) =>
          fetch(`/api/chatbots/${chatbotId}/sessions/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isArchived: archive }),
          })
        )
      );
      const allOk = results.every((r) => r.ok);
      if (allOk) {
        toast.success(archive ? `${selectedSessionIds.length} session(s) archived` : `${selectedSessionIds.length} session(s) unarchived`);
        setSelectedSessionIds([]);
        fetchSessions();
      } else {
        toast.error("Some sessions failed to update");
      }
    } catch {
      toast.error("Error archiving sessions");
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
        // Flag this as a human-sent message so the badge shows correctly
        sentByHuman: true,
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
          // This tells the API to store sentByHuman=true in the DB
          sentByHuman: true,
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

  // ── Mobile view state (list → conversation → crm) ──────────────────────────
  const [mobileView, setMobileView] = useState<"list" | "chat" | "crm">("list");

  // Auto-advance to chat view on mobile when session is selected
  const handleSelectSession = (id: string) => {
    setSelectedSession(id);
    setMobileView("chat");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col flex-1 min-h-0 overflow-hidden"
    >
      {/* Top Filter Header Bar */}
      <LiveInboxHeader
        activeChannel={filter}
        onChannelChange={setFilter}
        activeStatusTab={activeStatusTab}
        onStatusTabChange={handleStatusTabChange}
        statusCounts={statusCounts}
        mobileView={mobileView}
        onMobileBack={() => setMobileView(mobileView === "crm" ? "chat" : "list")}
      />

      {/* ── Responsive Live Inbox Main Layout ── */}
      <div className="flex-1 flex overflow-hidden min-h-0 bg-background/50">

        {/* Column 1: Session List */}
        <div
          className={`
            ${mobileView === "list" ? "flex" : "hidden"}
            md:flex
            w-full md:w-[300px] lg:w-[330px] md:shrink-0
            flex-col h-full
            md:border-r md:border-border/40
          `}
        >
          <div className="flex-1 overflow-hidden p-2 md:p-0">
            <SessionList
              sessions={sessions}
              filteredSessions={filteredSessions}
              loadingSessions={loadingSessions}
              selectedSession={selectedSession}
              onSelectSession={handleSelectSession}
              onRefresh={fetchSessions}
              filter={filter}
              onFilterChange={setFilter}
              activeStatusTab={activeStatusTab}
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
              onArchiveSelectedSessions={archiveSelectedSessions}
              onToggleSessionStatus={toggleSessionStatus}
              onToggleArchiveSession={toggleArchiveSession}
              onSeedDemoChats={seedDemoChats}
            />
          </div>
        </div>

        {/* Column 2: Conversation Thread */}
        <div
          className={`
            ${mobileView === "chat" ? "flex" : "hidden"}
            md:flex
            flex-1 min-w-0 flex-col h-full
            p-2 md:p-0
          `}
        >
          {/* Mobile: Show CRM button in chat view */}
          {selectedSession && (
            <div className="flex lg:hidden justify-end px-2 pt-1 pb-0 shrink-0">
              <button
                onClick={() => setMobileView("crm")}
                className="text-[11px] font-semibold text-primary bg-primary/10 border border-primary/30 px-3 py-1 rounded-lg"
              >
                View CRM →
              </button>
            </div>
          )}
          <div className="flex-1 overflow-hidden md:p-2 lg:p-0">
            <ConversationPanel
              selectedSession={selectedSession}
              messages={messages}
              loadingMessages={loadingMessages}
              activeSessionData={activeSessionData}
              onDelete={deleteSession}
              onDownload={downloadSession}
              onToggleStatus={toggleSessionStatus}
              onToggleArchive={toggleArchiveSession}
              onSendHumanMessage={sendHumanMessage}
              isSendingMessage={isSendingMessage}
              formatShortDate={formatShortDate}
              messagesEndRef={messagesEndRef}
            />
          </div>
        </div>

        {/* Column 3: CRM Panel */}
        <div
          className={`
            ${mobileView === "crm" ? "flex" : "hidden"}
            lg:flex
            w-full lg:w-[300px] xl:w-[320px] lg:shrink-0
            flex-col h-full
            p-2 lg:p-0
          `}
        >
          <CrmPanel
            session={activeSessionData}
            messages={messages}
            chatbotId={chatbotId}
            onUpdateLeadStatus={updateLeadStatus}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default function GlobalLiveInboxPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full w-full p-8 text-muted-foreground text-sm">
          <RefreshCw className="w-5 h-5 animate-spin mr-2 text-primary" />
          Loading Live Inbox...
        </div>
      }
    >
      <GlobalLiveInboxContent />
    </Suspense>
  );
}
