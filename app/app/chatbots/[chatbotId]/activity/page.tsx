"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { 
  MessageCircle, 
  Trash2, 
  Download,
  RefreshCcw,
  AlertCircle,
} from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "sonner";

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
  
  const [sessions, setSessions] = useState<any[]>([]);
  const [integrationStatus, setIntegrationStatus] = useState<{ status: string; lastError: string | null } | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [filter, setFilter] = useState("All");
  const confirm = useConfirm((state) => state.confirm);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { 
    if (!chatbotId) return;
    fetchSessions();
  }, [chatbotId]);

  useEffect(() => {
    if (!selectedSession) return;
    fetchMessages(selectedSession);
  }, [selectedSession]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await fetch(`/api/chatbots/${chatbotId}/sessions`);
      const data = await res.json();
      const sessionsArray = data.sessions || [];
      setSessions(sessionsArray);
      setIntegrationStatus(data.integration);
      
      if (sessionsArray.length > 0 && !selectedSession) {
        setSelectedSession(sessionsArray[0].sessionId);
      }
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "facebook": return <FacebookIcon className="w-5 h-5 text-blue-600" />;
      default: return <MessageCircle className="w-5 h-5 text-emerald-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric', 
      hour: 'numeric', minute: 'numeric', hour12: true 
    });
  };

  const formatShortDate = (dateString: string) => {
    const d = new Date(dateString);
    const datePart = d.toLocaleDateString('en-GB'); // dd/mm/yyyy
    const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
    return `${datePart} AT ${timePart}`;
  };

  const deleteSession = async (sessionId: string) => {
    confirm(
      "Delete Chat Session",
      "Are you sure you want to delete this chat session? All messages will be permanently removed. This action cannot be undone.",
      async () => {
        try {
          const res = await fetch(`/api/chatbots/${chatbotId}/sessions/${sessionId}`, {
            method: 'DELETE'
          });
          
          if (res.ok) {
            toast.success("Session deleted successfully");
            fetchSessions(); // Fully refetch to sync with server
            if (selectedSession === sessionId) {
              setSelectedSession(null);
              setMessages([]);
            }
          } else {
            toast.error("Failed to delete session");
          }
        } catch (err) {
          console.error("Delete session error", err);
          toast.error("An error occurred while deleting");
        }
      }
    );
  };

  const downloadSession = () => {
    if (!selectedSession || messages.length === 0) return;
    
    const session = sessions.find(s => s.sessionId === selectedSession);
    const title = session?.title || "Chat Session";
    
    let content = `Chat Session: ${title}\n`;
    content += `Session ID: ${selectedSession}\n`;
    content += `Date: ${new Date().toLocaleString()}\n`;
    content += `-------------------------------------------\n\n`;
    
    messages.forEach(msg => {
      const role = msg.role === "user" ? "User" : "AI";
      const time = formatDate(msg.timestamp);
      content += `[${time}] ${role}:\n${msg.content}\n\n`;
    });
    
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-session-${selectedSession.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Conversation downloaded as .txt");
  };

  const toggleSessionStatus = async (sessionId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      if (res.ok) {
        // Update local state
        setSessions(prev => prev.map(s => s.sessionId === sessionId ? { ...s, isActive: !currentStatus } : s));
        toast.success(`AI is now ${!currentStatus ? 'Active' : 'Inactive'} for this session`);
      } else {
        toast.error("Failed to update session status");
      }
    } catch (err) {
      console.error("Failed to toggle session status", err);
      toast.error("An error occurred while updating status");
    }
  };

  const filteredSessions = filter === "All" ? sessions : sessions.filter(s => s.platform === filter.toLowerCase());

  const activeSessionData = sessions.find(s => s.sessionId === selectedSession);

  return (
    <div className="space-y-4 h-[calc(100vh-6rem)] max-h-[850px] flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
        {/* LEFT PANE - SESSIONS */}
        <div className="w-1/3 bg-card border border-border rounded-xl flex flex-col overflow-hidden shrink-0 shadow-sm">
          <div className="p-4 border-b border-border flex flex-col gap-3 bg-card">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Chat Logs</h2>
              <button 
                onClick={fetchSessions}
                disabled={loadingSessions}
                className="p-1.5 hover:bg-muted rounded-md transition-colors disabled:opacity-50"
                title="Refresh sessions"
              >
                <RefreshCcw className={`w-4 h-4 ${loadingSessions ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            {/* Integration Error Alert */}
            {integrationStatus?.status === "error" && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-bold text-destructive leading-none uppercase tracking-wider">Connection Error</p>
                  <p className="text-[12px] text-destructive/90 leading-tight">
                    {integrationStatus.lastError || "Token expired. Please reconnect."}
                  </p>
                </div>
              </div>
            )}

            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="All">All</option>
              <option value="Facebook">Facebook</option>
              <option value="Web">Web</option>
            </select>
          </div>
          
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {loadingSessions ? (
              <div className="p-4 text-center text-muted-foreground text-sm">Loading sessions...</div>
            ) : filteredSessions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-3">
                <MessageCircle className="w-10 h-10 opacity-20" />
                <p className="text-sm">No chat logs found.</p>
                {!integrationStatus?.connected && (
                  <p className="text-[11px] leading-relaxed">
                    Facebook logs are hidden because the page is disconnected. 
                    Reconnect to view them.
                  </p>
                )}
              </div>
            ) : (
              filteredSessions.map((session) => (
                <div 
                  key={session.sessionId}
                  onClick={() => setSelectedSession(session.sessionId)}
                  className={`p-4 border-b border-border cursor-pointer transition-colors hover:bg-muted/50 ${selectedSession === session.sessionId ? 'bg-muted border-l-4 border-l-primary pl-3' : 'border-l-4 border-l-transparent'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shadow-sm ${session.platform === 'facebook' ? 'bg-blue-600' : 'bg-primary'}`}>
                        {session.title.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-[15px] font-medium leading-none mb-1.5">{session.title}</h3>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <MessageCircle className="w-3.5 h-3.5" />
                          {session.timestamp ? formatDate(session.timestamp) : 'Unknown'}
                        </div>
                      </div>
                    </div>
                    <div>
                      {getPlatformIcon(session.platform)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2.5 pl-[52px]">
                    <div className={`w-2 h-2 rounded-full shadow-[0_0_5px_rgba(16,185,129,0.5)] ${session.isActive ? 'bg-emerald-500' : 'bg-rose-500 shadow-rose-500/50'}`}></div>
                    <span className={`text-xs font-medium ${session.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {session.isActive ? 'Active (AI)' : 'Inactive (Manual)'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANE - CONVERSATION */}
        <div className="flex-1 bg-card border border-border rounded-xl flex flex-col overflow-hidden relative shadow-sm">
          {selectedSession ? (
            <>
              <div className="p-4 border-b border-border flex justify-between items-center bg-card z-10 shrink-0">
                <div>
                  <h2 className="text-base font-semibold">Conversation</h2>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Session Id: {selectedSession}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {/* Status Toggle */}
                  {activeSessionData && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only" 
                          checked={activeSessionData.isActive}
                          onChange={() => toggleSessionStatus(selectedSession, activeSessionData.isActive)}
                        />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${activeSessionData.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${activeSessionData.isActive ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        {activeSessionData.isActive ? 'AI Active' : 'Human Handoff'}
                      </span>
                    </label>
                  )}
                  <div className="h-4 w-px bg-border"></div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => deleteSession(selectedSession)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                      title="Delete Session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={downloadSession}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                      title="Download Conversation"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin space-y-6 bg-secondary/30">
                {loadingMessages ? (
                  <div className="text-center text-muted-foreground text-sm pt-10">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm pt-10">No messages in this session.</div>
                ) : (
                  messages.map((msg, i) => {
                    const isUser = msg.role === "user";
                    return (
                      <motion.div 
                        key={msg.id || i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                      >
                        <div className="text-[11px] text-muted-foreground mb-1.5 px-1 font-medium">
                          {formatShortDate(msg.timestamp)}
                        </div>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm ${
                          isUser 
                            ? 'bg-primary text-primary-foreground rounded-br-sm' 
                            : 'bg-card text-foreground rounded-bl-sm border border-border'
                        }`}>
                          {msg.content}
                        </div>
                      </motion.div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-3">
              <MessageCircle className="w-12 h-12 opacity-20" />
              <p>Select a session to view conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
