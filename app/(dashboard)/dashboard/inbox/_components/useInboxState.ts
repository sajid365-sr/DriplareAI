"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";

import { useActiveChatbotId } from "@/hooks/use-live-widget";
import { pickInboxChatbot } from "@/lib/domain/inbox-chatbot";

// Sub-hooks
import { useInboxUrlSync } from "./useInboxUrlSync";
import { useInboxData } from "./useInboxData";
import { useInboxSessionFilters, type InboxFilterSession, type StatusCounts } from "./useInboxSessionFilters";
import { useInboxActions } from "./useInboxActions";

// ── Return type ───────────────────────────────────────────────────────────────
export interface UseInboxStateReturn {
  // State
  sessions: any[];
  integrationStatus: any;
  selectedSession: string | null;
  messages: any[];
  loadingSessions: boolean;
  loadingMessages: boolean;
  filter: string;
  platforms: string[];
  searchQuery: string;
  selectedSessionIds: string[];
  isSendingMessage: boolean;
  chatbotId: string | null;
  mobileView: "list" | "chat" | "crm";
  currentUserId: string | null;
  assigneeFilter: string;
  dateFrom: string;
  dateTo: string;
  inboxMembers: Array<{ userId: string; name: string; email: string; role: string }>;

  // Derived
  statusCounts: StatusCounts;
  filteredSessions: any[];
  activeSessionData: any;
  activeStatusTab: string;

  // Setters
  setFilter: (f: string) => void;
  setSearchQuery: (q: string) => void;
  setMobileView: (v: "list" | "chat" | "crm") => void;
  setAssigneeFilter: (filter: string) => void;
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;

  // Handlers
  handleStatusTabChange: (tab: string) => void;
  handleSelectSession: (id: string) => void;
  fetchSessions: (silent?: boolean) => Promise<void>;
  deleteSession: (sessionId: string) => void;
  deleteSelectedSessions: () => void;
  toggleSessionStatus: (sessionId: string, currentStatus: boolean) => Promise<void>;
  setSessionDone: (sessionId: string, isDone: boolean) => Promise<void>;
  toggleArchiveSession: (sessionId: string, currentIsArchived: boolean) => Promise<void>;
  toggleBlockAiSession: (sessionId: string, currentBlocked: boolean) => Promise<void>;
  snoozeSession: (sessionId: string, until: string) => Promise<void>;
  unsnoozeSession: (sessionId: string) => Promise<void>;
  assignSession: (sessionId: string, userId: string | null, userName?: string) => Promise<void>;
  archiveSelectedSessions: (archive: boolean) => Promise<void>;
  updateLeadStatus: (sessionId: string, status: any) => Promise<void>;
  sendHumanMessage: (content: string, mediaUrl?: string, mediaType?: 'image' | 'audio', replyToMessageId?: string, replyToSnippet?: string) => Promise<void>;
  formatShortDate: (date: string) => string;
  downloadSession: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  setSelectedSessionIds: React.Dispatch<React.SetStateAction<string[]>>;
}

/**
 * Slim orchestrator hook that composes focused sub-hooks:
 * - `useInboxUrlSync` — URL ↔ tab state sync
 * - `useInboxData` — session/message fetching & polling
 * - `useInboxSessionFilters` — derived filter computations
 * - `useInboxActions` — mutation handlers (CRUD, bulk, messaging)
 */
export function useInboxState(): UseInboxStateReturn {
  const { userId } = useAuth();
  const currentUserId = userId ?? null;
  // ── Core State ──────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<any[]>([]);
  const [integrationStatus, setIntegrationStatus] = useState<any>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [filter, setFilter] = useState("All");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResponse, setSearchResponse] = useState<{
    query: string;
    results: InboxFilterSession[];
  } | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState("everyone");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [inboxMembers, setInboxMembers] = useState<Array<{
    userId: string;
    name: string;
    email: string;
    role: string;
  }>>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatbotId, setChatbotId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat" | "crm">("list");

  // ── Load initial chatbot ────────────────────────────────────────────────────
  // ⚠️ Which agent this inbox shows must match the agent named in the dashboard
  // header (`useActiveChatbotId`), not simply the newest one. `/api/chatbots`
  // orders by `createdAt: desc`, so `bots[0]` is the newest chatbot — a test bot
  // created five minutes ago would silently take over the inbox while the header
  // still said "Trendirect", and the merchant would conclude their live chat had
  // disappeared.
  const activeChatbotId = useActiveChatbotId();

  useEffect(() => {
    async function loadChatbots() {
      try {
        const res = await fetch("/api/chatbots");
        const bots = await res.json();
        if (Array.isArray(bots) && bots.length > 0) {
          // The inbox names no agent in its URL, so the choice is a rule, not a
          // lookup — see `pickInboxChatbot` for why "most sessions" beats "newest".
          const preferred = pickInboxChatbot(bots, activeChatbotId);
          if (preferred) {
            setChatbotId(preferred.id);
          } else {
            setLoadingSessions(false);
          }
        } else {
          setLoadingSessions(false);
        }
      } catch {
        setLoadingSessions(false);
      }
    }
    loadChatbots();
  }, [activeChatbotId]);

  // ── Sub-hook: URL Tab Sync ──────────────────────────────────────────────────
  const { activeStatusTab, handleStatusTabChange } = useInboxUrlSync();

  // ── Sub-hook: Data Fetching & Polling ───────────────────────────────────────
  const { fetchSessions, messagesEndRef } = useInboxData({
    chatbotId,
    selectedSession,
    messages,
    setSessions,
    setMessages,
    setIntegrationStatus,
    setPlatforms,
    setSelectedSession,
    setLoadingSessions,
    setLoadingMessages,
  });

  // ── Full-text search backend integration ─────────────────────────────────
  useEffect(() => {
    const query = searchQuery.trim();
    if (!chatbotId || query.length < 2) return;

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/chatbots/${chatbotId}/sessions/search?q=${encodeURIComponent(query)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) setSearchResponse({ query, results: data.results ?? [] });
      } catch (err) {
        console.error("[FullTextSearch]", err);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [chatbotId, searchQuery]);

  useEffect(() => {
    if (!chatbotId) return;
    let isMounted = true;
    fetch(`/api/chatbots/${chatbotId}/members`)
      .then((response) => response.ok ? response.json() : { members: [] })
      .then((data) => {
        if (isMounted) setInboxMembers(data.members ?? []);
      })
      .catch((error) => console.error("[INBOX_MEMBERS]", error));
    return () => { isMounted = false; };
  }, [chatbotId]);

  // ── Sub-hook: Derived Filters ───────────────────────────────────────────────
  const { statusCounts, filteredSessions, activeSessionData } = useInboxSessionFilters({
    sessions,
    searchResults: searchResponse?.query === searchQuery.trim() ? searchResponse.results : null,
    filter,
    activeStatusTab,
    searchQuery,
    selectedSession,
    currentUserId,
    assigneeFilter,
    dateFrom,
    dateTo,
  });

  // ── Sub-hook: Mutation Actions ──────────────────────────────────────────────
  const {
    deleteSession,
    deleteSelectedSessions,
    toggleSessionStatus,
    setSessionDone,
    toggleArchiveSession,
    toggleBlockAiSession,
    archiveSelectedSessions,
    snoozeSession,
    unsnoozeSession,
    assignSession,
    updateLeadStatus,
    sendHumanMessage,
    formatShortDate,
    downloadSession,
  } = useInboxActions({
    chatbotId,
    selectedSession,
    selectedSessionIds,
    messages,
    setSessions,
    setMessages,
    setSelectedSession,
    setSelectedSessionIds,
    setLoadingSessions,
    setIsSendingMessage,
    fetchSessions,
  });

  // ── Auto-select first visible session when filters change ───────────────────
  useEffect(() => {
    if (filteredSessions.length > 0) {
      const stillVisible = filteredSessions.some((s) => s.sessionId === selectedSession);
      if (!stillVisible) setSelectedSession(filteredSessions[0].sessionId);
    } else {
      setSelectedSession(null);
      setMessages([]);
    }
  }, [filter, searchQuery, activeStatusTab, filteredSessions, selectedSession, setSelectedSession, setMessages]);

  // ── Mobile session selection handler ────────────────────────────────────────
  const handleSelectSession = useCallback((id: string) => {
    setSelectedSession(id);
    setMobileView("chat");
  }, []);

  return {
    // State
    sessions,
    integrationStatus,
    selectedSession,
    messages,
    loadingSessions,
    loadingMessages,
    filter,
    platforms,
    searchQuery,
    selectedSessionIds,
    isSendingMessage,
    chatbotId,
    mobileView,
    currentUserId,
    assigneeFilter,
    dateFrom,
    dateTo,
    inboxMembers,

    // Derived
    statusCounts,
    filteredSessions,
    activeSessionData,
    activeStatusTab,

    // Setters
    setFilter,
    setSearchQuery,
    setMobileView,
    setAssigneeFilter,
    setDateFrom,
    setDateTo,

    // Handlers
    handleStatusTabChange,
    handleSelectSession,
    fetchSessions,
    deleteSession,
    deleteSelectedSessions,
    toggleSessionStatus,
    setSessionDone,
    toggleArchiveSession,
    toggleBlockAiSession,
    archiveSelectedSessions,
    snoozeSession,
    unsnoozeSession,
    assignSession,
    updateLeadStatus,
    sendHumanMessage,
    formatShortDate,
    downloadSession,
    messagesEndRef,
    setSelectedSessionIds,
  };
}
