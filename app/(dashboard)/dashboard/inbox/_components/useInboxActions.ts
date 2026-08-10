"use client";

import { useCallback } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "sonner";
import type { LeadStatus } from "../../chatbots/[chatbotId]/activity/_components/lead-status-badge";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UseInboxActionsParams {
  chatbotId: string | null;
  selectedSession: string | null;
  selectedSessionIds: string[];
  messages: any[];
  // Setters needed for optimistic updates
  setSessions: React.Dispatch<React.SetStateAction<any[]>>;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  setSelectedSession: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedSessionIds: React.Dispatch<React.SetStateAction<string[]>>;
  setIntegrationStatus: React.Dispatch<React.SetStateAction<any>>;
  setPlatforms: React.Dispatch<React.SetStateAction<string[]>>;
  setLoadingSessions: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSendingMessage: React.Dispatch<React.SetStateAction<boolean>>;
  // Fetch functions
  fetchSessions: (silent?: boolean) => Promise<void>;
}

interface UseInboxActionsReturn {
  seedDemoChats: () => Promise<void>;
  deleteSession: (sessionId: string) => void;
  deleteSelectedSessions: () => void;
  toggleSessionStatus: (sessionId: string, currentStatus: boolean) => Promise<void>;
  toggleArchiveSession: (sessionId: string, currentIsArchived: boolean) => Promise<void>;
  archiveSelectedSessions: (archive: boolean) => Promise<void>;
  updateLeadStatus: (sessionId: string, status: LeadStatus) => Promise<void>;
  sendHumanMessage: (content: string, mediaUrl?: string, mediaType?: 'image' | 'audio') => Promise<void>;
  formatShortDate: (date: string) => string;
  downloadSession: () => void;
}

/**
 * Encapsulates all session mutation handlers: CRUD operations,
 * bulk actions, messaging, and utility functions.
 */
export function useInboxActions({
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
}: UseInboxActionsParams): UseInboxActionsReturn {
  const confirm = useConfirm((state) => state.confirm);

  // ── Seed Demo Data ─────────────────────────────────────────────────────────
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
  }, [chatbotId, setSessions, setIntegrationStatus, setPlatforms, setSelectedSession, setLoadingSessions]);

  // ── Delete Single Session ──────────────────────────────────────────────────
  const deleteSession = useCallback(
    (sessionId: string) => {
      if (!chatbotId) return;
      confirm(
        "Delete Chat Session",
        "Are you sure? This action cannot be undone.",
        async () => {
          try {
            const res = await fetch(`/api/chatbots/${chatbotId}/sessions/${sessionId}`, {
              method: "DELETE",
            });
            if (res.ok) {
              toast.success("Session deleted");
              fetchSessions();
              if (selectedSession === sessionId) {
                setSelectedSession(null);
                setMessages([]);
              }
            } else {
              toast.error("Failed to delete");
            }
          } catch {
            toast.error("An error occurred");
          }
        }
      );
    },
    [chatbotId, selectedSession, confirm, fetchSessions, setSelectedSession, setMessages]
  );

  // ── Delete Selected Sessions (bulk) ────────────────────────────────────────
  const deleteSelectedSessions = useCallback(async () => {
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
  }, [
    chatbotId,
    selectedSessionIds,
    selectedSession,
    confirm,
    fetchSessions,
    setSelectedSessionIds,
    setSelectedSession,
    setMessages,
  ]);

  // ── Toggle AI Active / Paused ──────────────────────────────────────────────
  const toggleSessionStatus = useCallback(
    async (sessionId: string, currentStatus: boolean) => {
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
    },
    [chatbotId, setSessions]
  );

  // ── Toggle Archive ─────────────────────────────────────────────────────────
  const toggleArchiveSession = useCallback(
    async (sessionId: string, currentIsArchived: boolean) => {
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
    },
    [chatbotId, setSessions]
  );

  // ── Archive / Unarchive Selected (bulk) ────────────────────────────────────
  const archiveSelectedSessions = useCallback(
    async (archive: boolean) => {
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
          toast.success(
            archive
              ? `${selectedSessionIds.length} session(s) archived`
              : `${selectedSessionIds.length} session(s) unarchived`
          );
          setSelectedSessionIds([]);
          fetchSessions();
        } else {
          toast.error("Some sessions failed to update");
        }
      } catch {
        toast.error("Error archiving sessions");
      }
    },
    [chatbotId, selectedSessionIds, fetchSessions, setSelectedSessionIds]
  );

  // ── Update Lead Status ─────────────────────────────────────────────────────
  const updateLeadStatus = useCallback(
    async (sessionId: string, status: LeadStatus) => {
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
    },
    [chatbotId, setSessions]
  );

  // ── Send Human Message ─────────────────────────────────────────────────────
  const sendHumanMessage = useCallback(
    async (content: string, mediaUrl?: string, mediaType?: 'image' | 'audio') => {
      // Require either text content or a media attachment
      if (!selectedSession || (!content.trim() && !mediaUrl) || !chatbotId) return;
      setIsSendingMessage(true);
      try {
        // Optimistic update — shows the message instantly in the UI
        const optimisticMsg = {
          id: `temp-${Date.now()}`,
          role: "assistant",
          content,
          sentByHuman: true,
          mediaUrl: mediaUrl ?? null,
          mediaType: mediaType ?? null,
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
            sentByHuman: true,
            ...(mediaUrl && { mediaUrl }),
            ...(mediaType && { mediaType }),
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
    },
    [chatbotId, selectedSession, setMessages, setIsSendingMessage]
  );

  // ── Utility: Format Short Date ─────────────────────────────────────────────
  const formatShortDate = useCallback(
    (date: string) =>
      `${new Date(date).toLocaleDateString("en-GB")} AT ${new Date(date).toLocaleTimeString(
        "en-US",
        { hour: "numeric", minute: "numeric", hour12: true }
      )}`,
    []
  );

  // ── Utility: Download Session as TXT ───────────────────────────────────────
  const downloadSession = useCallback(() => {
    if (!selectedSession || messages.length === 0) return;
    let content = "";
    // We need sessions from outside, but we only need the title.
    // Pass it via closure from the parent hook.
    // For now, we just use the selectedSession id.
    content = `Chat Session: ${selectedSession}\nSession ID: ${selectedSession}\n\n`;
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
  }, [selectedSession, messages]);

  return {
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
  };
}
