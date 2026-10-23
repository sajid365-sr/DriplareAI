"use client";

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "sonner";
import type { LeadStatus } from "./lead-status-badge";

// ── Types ──────────────────────────────────────────────────────────────────────

interface InboxActionSession {
  sessionId: string;
  isActive?: boolean;
  isArchived?: boolean;
  isAiBlocked?: boolean;
  snoozeUntil?: string | null;
  assignedToUserId?: string | null;
  assignedAt?: string | null;
  leadStatus?: LeadStatus;
}

interface InboxActionMessage {
  id: string;
  timestamp: string | Date;
  role: string;
  content: string;
  sentByHuman?: boolean;
  mediaUrl?: string | null;
  mediaType?: "image" | "audio" | null;
  replyToMessageId?: string | null;
  replyToSnippet?: string | null;
}

interface UseInboxActionsParams {
  chatbotId: string | null;
  selectedSession: string | null;
  selectedSessionIds: string[];
  messages: InboxActionMessage[];
  // Setters needed for optimistic updates
  setSessions: React.Dispatch<React.SetStateAction<InboxActionSession[]>>;
  setMessages: React.Dispatch<React.SetStateAction<InboxActionMessage[]>>;
  setSelectedSession: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedSessionIds: React.Dispatch<React.SetStateAction<string[]>>;
  setLoadingSessions: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSendingMessage: React.Dispatch<React.SetStateAction<boolean>>;
  // Fetch functions
  fetchSessions: (silent?: boolean) => Promise<void>;
}

interface UseInboxActionsReturn {
  deleteSession: (sessionId: string) => void;
  deleteSelectedSessions: () => void;
  toggleSessionStatus: (sessionId: string, currentStatus: boolean) => Promise<void>;
  toggleArchiveSession: (sessionId: string, currentIsArchived: boolean) => Promise<void>;
  toggleBlockAiSession: (sessionId: string, currentBlocked: boolean) => Promise<void>;
  snoozeSession: (sessionId: string, until: string) => Promise<void>;
  unsnoozeSession: (sessionId: string) => Promise<void>;
  assignSession: (sessionId: string, userId: string | null, userName?: string) => Promise<void>;
  archiveSelectedSessions: (archive: boolean) => Promise<void>;
  updateLeadStatus: (sessionId: string, status: LeadStatus) => Promise<void>;
  sendHumanMessage: (content: string, mediaUrl?: string, mediaType?: 'image' | 'audio', replyToMessageId?: string, replyToSnippet?: string) => Promise<void>;
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
  setLoadingSessions,
  setIsSendingMessage,
  fetchSessions,
}: UseInboxActionsParams): UseInboxActionsReturn {
  const confirm = useConfirm((state) => state.confirm);
  const { t } = useTranslation("live-inbox");

  // ── Delete Single Session ──────────────────────────────────────────────────
  const deleteSession = useCallback(
    (sessionId: string) => {
      if (!chatbotId) return;
      confirm(
        t("deleteConfirm.title"),
        t("deleteConfirm.message"),
        async () => {
          try {
            const res = await fetch(`/api/chatbots/${chatbotId}/sessions/${sessionId}`, {
              method: "DELETE",
            });
            if (res.ok) {
              toast.success(t("deleteConfirm.deleted"));
              fetchSessions();
              if (selectedSession === sessionId) {
                setSelectedSession(null);
                setMessages([]);
              }
            } else {
              toast.error(t("deleteConfirm.deleteFailed"));
            }
          } catch {
            toast.error(t("deleteConfirm.error"));
          }
        }
      );
    },
    [chatbotId, selectedSession, confirm, fetchSessions, setSelectedSession, setMessages, t]
  );

  // ── Delete Selected Sessions (bulk) ────────────────────────────────────────
  const deleteSelectedSessions = useCallback(async () => {
    if (selectedSessionIds.length === 0 || !chatbotId) return;
    confirm(
      t("deleteConfirm.bulkTitle"),
      t("deleteConfirm.bulkMessage", { count: selectedSessionIds.length }),
      async () => {
        try {
          const results = await Promise.all(
            selectedSessionIds.map((id) =>
              fetch(`/api/chatbots/${chatbotId}/sessions/${id}`, { method: "DELETE" })
            )
          );
          const allOk = results.every((r) => r.ok);
          toast[allOk ? "success" : "error"](
            allOk ? t("deleteConfirm.bulkDeleted") : t("deleteConfirm.bulkFailed")
          );
          setSelectedSessionIds([]);
          fetchSessions();
          if (selectedSession && selectedSessionIds.includes(selectedSession)) {
            setSelectedSession(null);
            setMessages([]);
          }
        } catch {
          toast.error(t("deleteConfirm.error"));
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
    t,
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
  const toggleBlockAiSession = useCallback(
    async (sessionId: string, currentBlocked: boolean) => {
      if (!chatbotId) return;
      try {
        const res = await fetch(`/api/chatbots/${chatbotId}/sessions/${sessionId}/block`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isAiBlocked: !currentBlocked }),
        });
        if (res.ok) {
          const data = await res.json();
          setSessions((prev) =>
            prev.map((s) =>
              s.sessionId === sessionId ? { ...s, isAiBlocked: data.isAiBlocked } : s
            )
          );
          toast.success(
            data.isAiBlocked
              ? t("aiBlock.blockedToast", "AI permanently blocked for this user")
              : t("aiBlock.unblockedToast", "AI unblocked for this user")
          );
        } else {
          toast.error(t("aiBlock.errorToast", "Failed to update AI block status"));
        }
      } catch {
        toast.error(t("aiBlock.errorToast", "Failed to update AI block status"));
      }
    },
    [chatbotId, setSessions, t]
  );

  const snoozeSession = useCallback(
    async (sessionId: string, until: string) => {
      if (!chatbotId) return;
      try {
        const res = await fetch(`/api/chatbots/${chatbotId}/sessions/${sessionId}/snooze`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snoozeUntil: until }),
        });
        if (res.ok) {
          setSessions((prev) =>
            prev.map((s) =>
              s.sessionId === sessionId ? { ...s, snoozeUntil: until } : s
            )
          );
          toast.success("Conversation snoozed");
        } else {
          toast.error("Failed to snooze conversation");
        }
      } catch {
        toast.error("Failed to snooze conversation");
      }
    },
    [chatbotId, setSessions]
  );

  const assignSession = useCallback(
    async (sessionId: string, userId: string | null, userName?: string) => {
      if (!chatbotId) return;
      try {
        const res = await fetch(`/api/chatbots/${chatbotId}/sessions/${sessionId}/assign`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignedToUserId: userId }),
        });
        if (res.ok) {
          setSessions((prev) =>
            prev.map((s) =>
              s.sessionId === sessionId
                ? { ...s, assignedToUserId: userId, assignedAt: userId ? new Date().toISOString() : null }
                : s
            )
          );
          if (userId) {
            toast.success(userName ? `Assigned to ${userName}` : "Conversation assigned");
          } else {
            toast.success("Assignment removed");
          }
        } else {
          toast.error("Failed to update assignment");
        }
      } catch {
        toast.error("Failed to update assignment");
      }
    },
    [chatbotId, setSessions]
  );

  const unsnoozeSession = useCallback(
    async (sessionId: string) => {
      if (!chatbotId) return;
      try {
        const res = await fetch(`/api/chatbots/${chatbotId}/sessions/${sessionId}/snooze`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snoozeUntil: null }),
        });
        if (res.ok) {
          setSessions((prev) =>
            prev.map((s) =>
              s.sessionId === sessionId ? { ...s, snoozeUntil: null } : s
            )
          );
          toast.success("Conversation unsnoozed");
        } else {
          toast.error("Failed to unsnooze conversation");
        }
      } catch {
        toast.error("Failed to unsnooze conversation");
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
    async (content: string, mediaUrl?: string, mediaType?: 'image' | 'audio', replyToMessageId?: string, replyToSnippet?: string) => {
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
          replyToMessageId: replyToMessageId ?? null,
          replyToSnippet: replyToSnippet ?? null,
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
            ...(replyToMessageId && { replyToMessageId }),
            ...(replyToSnippet && { replyToSnippet }),
          }),
        });
        if (!res.ok) {
          toast.error(t("humanInput.sendFailed"));
          setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
          return;
        }

        // The row is saved even when the channel refuses the send, so a reply
        // that never reached the customer is reported rather than shown as
        // delivered. The web widget is the one place where "saved" is "sent".
        const payload = await res.json().catch(() => null);
        const delivery = payload?.delivery as
          | { delivered?: boolean; skipReason?: string; error?: string }
          | null
          | undefined;

        if (delivery && delivery.delivered === false) {
          const reasonKey = delivery.skipReason ?? "";
          const knownReason = [
            "outside_messaging_window",
            "missing_credentials",
            "missing_recipient",
            "comment_session",
          ].includes(reasonKey);

          toast.error(
            knownReason
              ? t(`humanInput.delivery.${reasonKey}`)
              : t("humanInput.delivery.failed"),
            delivery.error ? { description: delivery.error } : undefined
          );
        }
      } catch {
        toast.error(t("humanInput.sendError"));
      } finally {
        setIsSendingMessage(false);
      }
    },
    [chatbotId, selectedSession, setMessages, setIsSendingMessage, t]
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
    deleteSession,
    deleteSelectedSessions,
    toggleSessionStatus,
    toggleArchiveSession,
    toggleBlockAiSession,
    snoozeSession,
    unsnoozeSession,
    assignSession,
    archiveSelectedSessions,
    updateLeadStatus,
    sendHumanMessage,
    formatShortDate,
    downloadSession,
  };
}
