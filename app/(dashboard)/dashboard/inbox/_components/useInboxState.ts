"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

// Sub-hooks
import { useInboxUrlSync } from "./useInboxUrlSync";
import { useInboxData } from "./useInboxData";
import { useInboxSessionFilters } from "./useInboxSessionFilters";
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

  // Derived
  statusCounts: {
    allContacts: number;
    orderRequests: number;
    unreplied: number;
    tickets: number;
    resolved: number;
    archived: number;
  };
  filteredSessions: any[];
  activeSessionData: any;
  activeStatusTab: string;

  // Setters
  setFilter: (f: string) => void;
  setSearchQuery: (q: string) => void;
  setMobileView: (v: "list" | "chat" | "crm") => void;

  // Handlers
  handleStatusTabChange: (tab: string) => void;
  handleSelectSession: (id: string) => void;
  fetchSessions: (silent?: boolean) => Promise<void>;
  seedDemoChats: () => Promise<void>;
  deleteSession: (sessionId: string) => void;
  deleteSelectedSessions: () => void;
  toggleSessionStatus: (sessionId: string, currentStatus: boolean) => Promise<void>;
  toggleArchiveSession: (sessionId: string, currentIsArchived: boolean) => Promise<void>;
  archiveSelectedSessions: (archive: boolean) => Promise<void>;
  updateLeadStatus: (sessionId: string, status: any) => Promise<void>;
  sendHumanMessage: (content: string) => Promise<void>;
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
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatbotId, setChatbotId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat" | "crm">("list");

  // ── Load initial chatbot ────────────────────────────────────────────────────
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

  // ── Sub-hook: Derived Filters ───────────────────────────────────────────────
  const { statusCounts, filteredSessions, activeSessionData } = useInboxSessionFilters({
    sessions,
    filter,
    activeStatusTab,
    searchQuery,
    selectedSession,
  });

  // ── Sub-hook: Mutation Actions ──────────────────────────────────────────────
  const {
    seedDemoChats,
    deleteSession,
    deleteSelectedSessions,
    toggleSessionStatus,
    toggleArchiveSession,
    archiveSelectedSessions,
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
    setIntegrationStatus,
    setPlatforms,
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
  }, [filter, searchQuery, activeStatusTab]);

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

    // Derived
    statusCounts,
    filteredSessions,
    activeSessionData,
    activeStatusTab,

    // Setters
    setFilter,
    setSearchQuery,
    setMobileView,

    // Handlers
    handleStatusTabChange,
    handleSelectSession,
    fetchSessions,
    seedDemoChats,
    deleteSession,
    deleteSelectedSessions,
    toggleSessionStatus,
    toggleArchiveSession,
    archiveSelectedSessions,
    updateLeadStatus,
    sendHumanMessage,
    formatShortDate,
    downloadSession,
    messagesEndRef,
    setSelectedSessionIds,
  };
}
