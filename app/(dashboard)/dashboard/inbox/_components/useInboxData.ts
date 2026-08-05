"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UseInboxDataParams {
  chatbotId: string | null;
  selectedSession: string | null;
  messages: any[];
  // Setters
  setSessions: React.Dispatch<React.SetStateAction<any[]>>;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  setIntegrationStatus: React.Dispatch<React.SetStateAction<any>>;
  setPlatforms: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedSession: React.Dispatch<React.SetStateAction<string | null>>;
  setLoadingSessions: React.Dispatch<React.SetStateAction<boolean>>;
  setLoadingMessages: React.Dispatch<React.SetStateAction<boolean>>;
}

interface UseInboxDataReturn {
  fetchSessions: (silent?: boolean) => Promise<void>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Handles all data fetching and auto-polling for sessions and messages.
 * Provides a `messagesEndRef` for auto-scrolling.
 */
export function useInboxData({
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
}: UseInboxDataParams): UseInboxDataReturn {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Track selectedSession in a ref so the polling callback always sees the latest value
  const selectedSessionRef = useRef(selectedSession);
  selectedSessionRef.current = selectedSession;

  // ── Fetch Sessions ─────────────────────────────────────────────────────────
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
        if (list.length > 0 && !selectedSessionRef.current) {
          setSelectedSession(list[0].sessionId);
        }
      } catch (err) {
        console.error("[fetchSessions]", err);
      } finally {
        if (!silent) setLoadingSessions(false);
      }
    },
    [chatbotId, setSessions, setIntegrationStatus, setPlatforms, setSelectedSession, setLoadingSessions]
  );

  // ── Fetch Messages ─────────────────────────────────────────────────────────
  const fetchMessages = useCallback(
    async (sessionId: string, silent = false) => {
      if (!chatbotId) return;
      try {
        if (!silent) setLoadingMessages(true);
        const res = await fetch(`/api/chatbots/${chatbotId}/messages?sessionId=${sessionId}`);
        const data = await res.json();
        const newList = Array.isArray(data) ? data : [];
        setMessages((prev) => (JSON.stringify(prev) === JSON.stringify(newList) ? prev : newList));
      } catch (err) {
        console.error("[fetchMessages]", err);
      } finally {
        if (!silent) setLoadingMessages(false);
      }
    },
    [chatbotId, setMessages, setLoadingMessages]
  );

  // ── Initial Fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (chatbotId) fetchSessions(false);
  }, [chatbotId, fetchSessions]);

  useEffect(() => {
    if (selectedSession && chatbotId) fetchMessages(selectedSession, false);
  }, [selectedSession, chatbotId, fetchMessages]);

  // ── Auto-scroll on new messages ────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Background Polling (10s sessions, 5s messages) ─────────────────────────
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

  return { fetchSessions, messagesEndRef };
}
