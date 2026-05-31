"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "sonner";

import { SessionList } from "./_components/session-list";
import { ConversationPanel } from "./_components/conversation-panel";
import { 
  FacebookIcon, 
  WhatsAppIcon, 
  InstagramIcon, 
  TelegramIcon, 
  SlackIcon, 
  MessengerIcon, 
  TikTokIcon 
} from "@/components/icons/PlatformIcons";

export default function Activity() {
  const params = useParams();
  const chatbotId = params?.chatbotId as string;
  const confirm = useConfirm((state) => state.confirm);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- State ---
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

  // --- Derived State ---
  const filteredSessions = useMemo(() => {
    let result = sessions;
    if (filter !== "All") {
      result = result.filter(s => s.platform === filter.toLowerCase());
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => s.title.toLowerCase().includes(q));
    }
    return result;
  }, [sessions, filter, searchQuery]);

  const activeSessionData = useMemo(() => {
    return sessions.find(s => s.sessionId === selectedSession);
  }, [sessions, selectedSession]);

  // --- Effects ---
  useEffect(() => { 
    if (chatbotId) fetchSessions();
  }, [chatbotId]);

  useEffect(() => {
    if (selectedSession) fetchMessages(selectedSession);
  }, [selectedSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Sync selected session when filter/search changes
  useEffect(() => {
    if (filteredSessions.length > 0) {
      const isSelectedInFiltered = filteredSessions.some(s => s.sessionId === selectedSession);
      if (!isSelectedInFiltered) setSelectedSession(filteredSessions[0].sessionId);
    } else {
      setSelectedSession(null);
      setMessages([]);
    }
  }, [filter, searchQuery, sessions]);

  // Clear bulk selection when filter or search changes
  useEffect(() => {
    setSelectedSessionIds([]);
  }, [filter, searchQuery]);

  // --- API Handlers ---
  const fetchSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await fetch(`/api/chatbots/${chatbotId}/sessions`);
      const data = await res.json();
      const sessionsArray = data.sessions || [];
      setSessions(sessionsArray);
      setIntegrationStatus(data.integration);
      setPlatforms(data.platforms || ["web"]);
      if (sessionsArray.length > 0 && !selectedSession) setSelectedSession(sessionsArray[0].sessionId);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    try {
      setLoadingMessages(true);
      const res = await fetch(`/api/chatbots/${chatbotId}/messages?sessionId=${sessionId}`);
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const deleteSession = (sessionId: string) => {
    confirm("Delete Chat Session", "Are you sure? This action cannot be undone.", async () => {
      try {
        const res = await fetch(`/api/chatbots/${chatbotId}/sessions/${sessionId}`, { method: 'DELETE' });
        if (res.ok) {
          toast.success("Session deleted");
          fetchSessions();
          if (selectedSession === sessionId) {
            setSelectedSession(null);
            setMessages([]);
          }
        } else toast.error("Failed to delete");
      } catch (err) {
        toast.error("An error occurred");
      }
    });
  };

  const deleteSelectedSessions = async () => {
    if (selectedSessionIds.length === 0) return;
    confirm("Delete Selected Sessions", `Are you sure you want to delete ${selectedSessionIds.length} selected session(s)? This action cannot be undone.`, async () => {
      try {
        const promises = selectedSessionIds.map(sessionId => 
          fetch(`/api/chatbots/${chatbotId}/sessions/${sessionId}`, { method: 'DELETE' })
        );
        const results = await Promise.all(promises);
        const allOk = results.every(res => res.ok);
        if (allOk) {
          toast.success("Selected sessions deleted");
        } else {
          toast.error("Some sessions failed to delete");
        }
        setSelectedSessionIds([]);
        fetchSessions();
        if (selectedSession && selectedSessionIds.includes(selectedSession)) {
          setSelectedSession(null);
          setMessages([]);
        }
      } catch (err) {
        toast.error("An error occurred during deletion");
      }
    });
  };

  const toggleSessionStatus = async (sessionId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      if (res.ok) {
        setSessions(prev => prev.map(s => s.sessionId === sessionId ? { ...s, isActive: !currentStatus } : s));
        toast.success(`AI is now ${!currentStatus ? 'Active' : 'Inactive'}`);
      }
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  // --- Utils ---
  const formatDate = (date: string) => new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true });
  const formatShortDate = (date: string) => `${new Date(date).toLocaleDateString('en-GB')} AT ${new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })}`;
  const getPlatformIcon = (platform: string) => {
    const normPlatform = platform?.toLowerCase();
    switch (normPlatform) {
      case "facebook":
        return <FacebookIcon className="w-5 h-5 text-[#1877F2]" />;
      case "whatsapp":
        return <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />;
      case "instagram":
        return <InstagramIcon className="w-5 h-5 text-[#E1306C]" />;
      case "telegram":
        return <TelegramIcon className="w-5 h-5 text-[#24A1DE]" />;
      case "slack":
        return <SlackIcon className="w-5 h-5 text-[#4A154B]" />;
      case "messenger":
        return <MessengerIcon className="w-5 h-5 text-[#0084FF]" />;
      case "tiktok":
        return <TikTokIcon className="w-5 h-5 text-black dark:text-white" />;
      default:
        return <MessageCircle className="w-5 h-5 text-emerald-500" />;
    }
  };

  const downloadSession = () => {
    if (!selectedSession || messages.length === 0) return;
    const session = sessions.find(s => s.sessionId === selectedSession);
    let content = `Chat Session: ${session?.title || "Chat Session"}\nSession ID: ${selectedSession}\n\n`;
    messages.forEach(msg => content += `[${formatDate(msg.timestamp)}] ${msg.role === "user" ? "User" : "AI"}:\n${msg.content}\n\n`);
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
    <div className="space-y-4 h-[calc(100vh-6rem)] max-h-[850px] flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
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
          formatDate={formatDate}
          getPlatformIcon={getPlatformIcon}
          platforms={platforms}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedSessionIds={selectedSessionIds}
          onToggleSelectSession={(sessionId) => setSelectedSessionIds(prev => prev.includes(sessionId) ? prev.filter(id => id !== sessionId) : [...prev, sessionId])}
          onSelectAllSessions={(checked) => setSelectedSessionIds(checked ? filteredSessions.map(s => s.sessionId) : [])}
          onDeleteSelectedSessions={deleteSelectedSessions}
          onToggleSessionStatus={toggleSessionStatus}
        />

        <ConversationPanel 
          selectedSession={selectedSession}
          messages={messages}
          loadingMessages={loadingMessages}
          activeSessionData={activeSessionData}
          onDelete={deleteSession}
          onDownload={downloadSession}
          onToggleStatus={toggleSessionStatus}
          formatShortDate={formatShortDate}
          messagesEndRef={messagesEndRef}
        />
      </div>
    </div>
  );
}
