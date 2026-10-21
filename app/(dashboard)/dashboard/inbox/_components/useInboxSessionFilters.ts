"use client";

import { useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StatusCounts {
  allContacts: number;
  orderRequests: number;
  unreplied: number;
  tickets: number;
  snoozed: number;
  resolved: number;
  archived: number;
}

// ── Filter predicate helpers ───────────────────────────────────────────────────

/** Check if session is currently snoozed (snoozeUntil is in the future) */
const isSnoozed = (s: any) => {
  if (!s.snoozeUntil) return false;
  return new Date(s.snoozeUntil).getTime() > Date.now();
};

/** All active, non-archived, non-snoozed contacts */
const isAllContacts = (s: any) => !s.isArchived && !isSnoozed(s);

/** Sessions with pending order intent */
const isOrderRequest = (s: any) =>
  !s.isArchived &&
  ((s.hasOrderIntent === true && !s.orderConfirmed) ||
    s.leadStatus === "high_prospect" ||
    s.topic?.toLowerCase().includes("order"));

/** Sessions needing a reply */
const isUnreplied = (s: any) =>
  !s.isArchived &&
  ((s.lastMessageSender === "customer" && s.unread === true) ||
    s.isActive === false ||
    s.leadStatus === "risky");

/** Sessions flagged as tickets / needing human */
const isTicket = (s: any) =>
  !s.isArchived &&
  ((s.isHumanNeeded === true ||
    s.aiStatus === "stopped" ||
    s.isActive === false ||
    s.isTicket === true ||
    s.topic?.toLowerCase().includes("code") ||
    s.topic?.toLowerCase().includes("issue")));

/** Resolved / successful sessions */
const isResolved = (s: any) =>
  !s.isArchived && (s.status === "resolved" || s.leadStatus === "successful");

/** Archived sessions */
const isArchived = (s: any) => s.isArchived === true;

// ── Tab → filter predicate map ─────────────────────────────────────────────────

const TAB_FILTERS: Record<string, (s: any) => boolean> = {
  allContacts: isAllContacts,
  orderRequests: isOrderRequest,
  unreplied: isUnreplied,
  tickets: isTicket,
  snoozed: isSnoozed,
  resolved: isResolved,
  archived: isArchived,
};

// ── Hook ───────────────────────────────────────────────────────────────────────

interface UseInboxSessionFiltersParams {
  sessions: any[];
  filter: string;
  activeStatusTab: string;
  searchQuery: string;
  selectedSession: string | null;
}

interface UseInboxSessionFiltersReturn {
  statusCounts: StatusCounts;
  filteredSessions: any[];
  activeSessionData: any;
}

/**
 * Computes derived session data: status tab counts, filtered session list,
 * and the currently active session object. All computations are memoized.
 */
export function useInboxSessionFilters({
  sessions,
  filter,
  activeStatusTab,
  searchQuery,
  selectedSession,
}: UseInboxSessionFiltersParams): UseInboxSessionFiltersReturn {
  // ── Dynamic Status Counts ──────────────────────────────────────────────────
  const statusCounts = useMemo<StatusCounts>(
    () => ({
      allContacts: sessions.filter(isAllContacts).length,
      orderRequests: sessions.filter(isOrderRequest).length,
      unreplied: sessions.filter(isUnreplied).length,
      tickets: sessions.filter(isTicket).length,
      snoozed: sessions.filter(isSnoozed).length,
      resolved: sessions.filter(isResolved).length,
      archived: sessions.filter(isArchived).length,
    }),
    [sessions]
  );

  // ── Derived Sessions Filtering ──────────────────────────────────────────────
  const filteredSessions = useMemo(() => {
    let result = sessions;

    // Platform Filter
    if (filter !== "All") {
      result = result.filter((s) => s.platform.toLowerCase() === filter.toLowerCase());
    }

    // Status Tab Filter
    const tabPredicate = TAB_FILTERS[activeStatusTab];
    if (tabPredicate) {
      result = result.filter(tabPredicate);
    }

    // Search Query Filter (Title, Last Message, Matched Snippet, Phone, Order ID)
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => {
        const titleMatch = s.title?.toLowerCase().includes(q);
        const lastMsgMatch = s.lastMessage?.toLowerCase().includes(q);
        const snippetMatch = s.matchedSnippet?.toLowerCase().includes(q);
        const phoneMatch = s.phone?.toLowerCase().includes(q) || s.aiExtractionData?.phone?.toLowerCase().includes(q);
        const orderMatch = s.orderId?.toLowerCase().includes(q) || s.aiExtractionData?.orderId?.toLowerCase().includes(q);
        const sessionIdMatch = s.sessionId?.toLowerCase().includes(q);
        return titleMatch || lastMsgMatch || snippetMatch || phoneMatch || orderMatch || sessionIdMatch;
      });
    }

    return result;
  }, [sessions, filter, activeStatusTab, searchQuery]);

  // ── Active Session Data ─────────────────────────────────────────────────────
  const activeSessionData = useMemo(
    () => sessions.find((s) => s.sessionId === selectedSession) ?? null,
    [sessions, selectedSession]
  );

  return { statusCounts, filteredSessions, activeSessionData };
}
