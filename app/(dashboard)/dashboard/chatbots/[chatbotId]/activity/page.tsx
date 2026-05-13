"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "sonner";

import { SessionList } from "./_components/session-list";
import { ConversationPanel } from "./_components/conversation-panel";

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg 
    className={className} 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" height="24" viewBox="0 0 24 24" fill="none" 
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
  </svg>
);

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

  // --- Derived State ---
  const filteredSessions = useMemo(() => {
    return filter === "All" ? sessions : sessions.filter(s => s.platform === filter.toLowerCase());
  }, [sessions, filter]);

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

  // Sync selected session when filter changes
  useEffect(() => {
    if (filteredSessions.length > 0) {
      const isSelectedInFiltered = filteredSessions.some(s => s.sessionId === selectedSession);
      if (!isSelectedInFiltered) setSelectedSession(filteredSessions[0].sessionId);
    } else {
      setSelectedSession(null);
      setMessages([]);
    }
  }, [filter, sessions]);

  // --- API Handlers ---
  const fetchSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await fetch(`/api/chatbots/${chatbotId}/sessions`);
      const data = await res.json();
      const sessionsArray = data.sessions || [];
      setSessions(sessionsArray);
      setIntegrationStatus(data.integration);
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
  const getPlatformIcon = (platform: string) => platform === "facebook" ? <FacebookIcon className="w-5 h-5 text-blue-600" /> : <MessageCircle className="w-5 h-5 text-emerald-500" />;

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
