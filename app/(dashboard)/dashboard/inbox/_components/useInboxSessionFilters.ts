"use client";

import { useEffect, useMemo, useState } from "react";

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

interface InboxFilterSession {
  sessionId: string;
  platform?: string;
  isArchived?: boolean;
  snoozeUntil?: string | null;
  hasOrderIntent?: boolean;
  orderConfirmed?: boolean;
  leadStatus?: string | null;
  topic?: string | null;
  lastMessageSender?: string | null;
  unread?: boolean;
  isActive?: boolean;
  isHumanNeeded?: boolean;
  aiStatus?: string | null;
  isTicket?: boolean;
  status?: string | null;
  title?: string | null;
  lastMessage?: string | null;
  matchedSnippet?: string | null;
  phone?: string | null;
  orderId?: string | null;
  aiExtractionData?: { phone?: string; orderId?: string } | null;
}

// ── Filter predicate helpers ───────────────────────────────────────────────────

/** Check if session is currently snoozed (snoozeUntil is in the future) */
const isSnoozed = (s: InboxFilterSession, now: number) => {
  if (!s.snoozeUntil) return false;
  return new Date(s.snoozeUntil).getTime() > now;
};

/** All active, non-archived, non-snoozed contacts */
const isAllContacts = (s: InboxFilterSession, now: number) => !s.isArchived && !isSnoozed(s, now);

const isDueSnooze = (s: InboxFilterSession, now: number) =>
  Boolean(s.snoozeUntil) && new Date(s.snoozeUntil as string).getTime() <= now;

/** Sessions with pending order intent */
const isOrderRequest = (s: InboxFilterSession) =>
  !s.isArchived && Boolean(
    (s.hasOrderIntent === true && !s.orderConfirmed) ||
      s.leadStatus === "high_prospect" ||
      s.topic?.toLowerCase().includes("order")
  );

/** Sessions needing a reply */
const isUnreplied = (s: InboxFilterSession) =>
  !s.isArchived &&
  ((s.lastMessageSender === "customer" && s.unread === true) ||
    s.isActive === false ||
    s.leadStatus === "risky");

/** Sessions flagged as tickets / needing human */
const isTicket = (s: InboxFilterSession) =>
  !s.isArchived && Boolean(
    s.isHumanNeeded === true ||
      s.aiStatus === "stopped" ||
      s.isActive === false ||
      s.isTicket === true ||
      s.topic?.toLowerCase().includes("code") ||
      s.topic?.toLowerCase().includes("issue")
  );

/** Resolved / successful sessions */
const isResolved = (s: InboxFilterSession) =>
  !s.isArchived && (s.status === "resolved" || s.leadStatus === "successful");

/** Archived sessions */
const isArchived = (s: InboxFilterSession) => s.isArchived === true;

// ── Tab → filter predicate map ─────────────────────────────────────────────────

const TAB_FILTERS: Record<string, (s: InboxFilterSession, now: number) => boolean> = {
  allContacts: (s, now) => isAllContacts(s, now),
  orderRequests: isOrderRequest,
  unreplied: isUnreplied,
  tickets: isTicket,
  snoozed: (s, now) => isSnoozed(s, now),
  resolved: isResolved,
  archived: isArchived,
};

// ── Hook ───────────────────────────────────────────────────────────────────────

interface UseInboxSessionFiltersParams {
  sessions: InboxFilterSession[];
  filter: string;
  activeStatusTab: string;
  searchQuery: string;
  selectedSession: string | null;
}

interface UseInboxSessionFiltersReturn {
  statusCounts: StatusCounts;
  filteredSessions: InboxFilterSession[];
  activeSessionData: InboxFilterSession | null;
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
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  // ── Dynamic Status Counts ──────────────────────────────────────────────────
  const statusCounts = useMemo<StatusCounts>(
    () => ({
      allContacts: sessions.filter((session) => isAllContacts(session, now)).length,
      orderRequests: sessions.filter(isOrderRequest).length,
      unreplied: sessions.filter(isUnreplied).length,
      tickets: sessions.filter(isTicket).length,
      snoozed: sessions.filter((session) => isSnoozed(session, now)).length,
      resolved: sessions.filter(isResolved).length,
      archived: sessions.filter(isArchived).length,
    }),
    [sessions, now]
  );

  // ── Derived Sessions Filtering ──────────────────────────────────────────────
  const filteredSessions = useMemo(() => {
    let result = sessions;

    // Platform Filter
    if (filter !== "All") {
      result = result.filter((s) => s.platform?.toLowerCase() === filter.toLowerCase());
    }

    // Status Tab Filter
    const tabPredicate = TAB_FILTERS[activeStatusTab];
    if (tabPredicate) {
      result = result.filter((session) => tabPredicate(session, now));
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

    if (activeStatusTab === "allContacts") {
      result = [...result].sort((a, b) => Number(isDueSnooze(b, now)) - Number(isDueSnooze(a, now)));
    }

    return result;
  }, [sessions, filter, activeStatusTab, searchQuery, now]);

  // ── Active Session Data ─────────────────────────────────────────────────────
  const activeSessionData = useMemo(
    () => sessions.find((s) => s.sessionId === selectedSession) ?? null,
    [sessions, selectedSession]
  );

  return { statusCounts, filteredSessions, activeSessionData };
}
