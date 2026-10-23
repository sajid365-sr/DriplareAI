"use client";

import { useEffect, useMemo, useState } from "react";

export interface StatusCounts {
  waiting: number;
  unread: number;
  open: number;
  done: number;
  later: number;
  archived: number;
}

export interface InboxFilterSession {
  sessionId: string;
  platform?: string;
  isArchived?: boolean;
  isDone?: boolean;
  snoozeUntil?: string | null;
  assignedToUserId?: string | null;
  assignmentNote?: string | null;
  assignmentAiPaused?: boolean;
  assignmentAiResumeAt?: string | null;
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
  timestamp?: string | Date | null;
  aiExtractionData?: { phone?: string; orderId?: string } | null;
}

interface UseInboxSessionFiltersParams {
  sessions: InboxFilterSession[];
  searchResults: InboxFilterSession[] | null;
  filter: string;
  activeStatusTab: string;
  searchQuery: string;
  selectedSession: string | null;
  currentUserId: string | null;
  assigneeFilter: string;
  dateFrom: string;
  dateTo: string;
}

interface UseInboxSessionFiltersReturn {
  statusCounts: StatusCounts;
  filteredSessions: InboxFilterSession[];
  activeSessionData: InboxFilterSession | null;
}

const isSnoozed = (session: InboxFilterSession, now: number) => {
  if (!session.snoozeUntil) return false;
  const snoozeTime = new Date(session.snoozeUntil).getTime();
  return Number.isFinite(snoozeTime) && snoozeTime > now;
};

const isDueSnooze = (session: InboxFilterSession, now: number) => {
  if (!session.snoozeUntil) return false;
  const snoozeTime = new Date(session.snoozeUntil).getTime();
  return Number.isFinite(snoozeTime) && snoozeTime <= now;
};

const isWaiting = (session: InboxFilterSession, now: number) =>
  !session.isArchived && !session.isDone && !isSnoozed(session, now) &&
  session.lastMessageSender === "customer";

const isUnread = (session: InboxFilterSession, now: number) =>
  isWaiting(session, now) && session.unread === true;

const isOpen = (session: InboxFilterSession, now: number) =>
  !session.isArchived && !session.isDone && !isSnoozed(session, now);

const isDone = (session: InboxFilterSession) => !session.isArchived && session.isDone === true;
const isArchived = (session: InboxFilterSession) => session.isArchived === true;

const isLater = (session: InboxFilterSession, now: number) => isSnoozed(session, now);

const TAB_FILTERS: Record<string, (session: InboxFilterSession, now: number) => boolean> = {
  waiting: isWaiting,
  unread: isUnread,
  open: isOpen,
  done: (session) => isDone(session),
  later: isLater,
  archived: (session) => isArchived(session),
};

function matchesSearch(session: InboxFilterSession, query: string): boolean {
  const fields = [
    session.title,
    session.lastMessage,
    session.matchedSnippet,
    session.phone,
    session.aiExtractionData?.phone,
    session.orderId,
    session.aiExtractionData?.orderId,
    session.sessionId,
  ];
  return fields.some((field) => field?.toLocaleLowerCase().includes(query));
}

function matchesDateRange(session: InboxFilterSession, dateFrom: string, dateTo: string): boolean {
  if (!dateFrom && !dateTo) return true;
  if (!session.timestamp) return false;
  const timestamp = new Date(session.timestamp).getTime();
  if (!Number.isFinite(timestamp)) return false;
  if (dateFrom && timestamp < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
  if (dateTo && timestamp > new Date(`${dateTo}T23:59:59.999`).getTime()) return false;
  return true;
}

export function useInboxSessionFilters({
  sessions,
  searchResults,
  filter,
  activeStatusTab,
  searchQuery,
  selectedSession,
  currentUserId,
  assigneeFilter,
  dateFrom,
  dateTo,
}: UseInboxSessionFiltersParams): UseInboxSessionFiltersReturn {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const nextDueAt = sessions.reduce<number | null>((earliest, session) => {
      if (!session.snoozeUntil) return earliest;
      const snoozeTime = new Date(session.snoozeUntil).getTime();
      if (!Number.isFinite(snoozeTime) || snoozeTime <= Date.now()) return earliest;
      return earliest === null ? snoozeTime : Math.min(earliest, snoozeTime);
    }, null);

    if (nextDueAt === null) return;
    const timeout = window.setTimeout(() => setNow(Date.now()), Math.max(0, nextDueAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [sessions]);

  const statusCounts = useMemo<StatusCounts>(() => ({
    waiting: sessions.filter((session) => isWaiting(session, now)).length,
    unread: sessions.filter((session) => isUnread(session, now)).length,
    open: sessions.filter((session) => isOpen(session, now)).length,
    done: sessions.filter(isDone).length,
    later: sessions.filter((session) => isLater(session, now)).length,
    archived: sessions.filter(isArchived).length,
  }), [sessions, now]);

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    let result = query && searchResults !== null
      ? searchResults
      : sessions;

    if (filter !== "All") {
      result = result.filter((session) => session.platform?.toLowerCase() === filter.toLowerCase());
    }

    const tabPredicate = TAB_FILTERS[activeStatusTab];
    if (tabPredicate) result = result.filter((session) => tabPredicate(session, now));

    if (assigneeFilter === "mine") {
      result = result.filter((session) => session.assignedToUserId === currentUserId);
    } else if (assigneeFilter !== "everyone") {
      result = result.filter((session) => session.assignedToUserId === assigneeFilter);
    }

    result = result.filter((session) => matchesDateRange(session, dateFrom, dateTo));

    if (query && searchResults === null) {
      result = result.filter((session) => matchesSearch(session, query));
    }

    if (activeStatusTab === "open") {
      result = [...result].sort((a, b) => Number(isDueSnooze(b, now)) - Number(isDueSnooze(a, now)));
    }
    return result;
  }, [
    sessions,
    searchResults,
    filter,
    activeStatusTab,
    searchQuery,
    currentUserId,
    assigneeFilter,
    dateFrom,
    dateTo,
    now,
  ]);

  const activeSessionData = useMemo(
    () => sessions.find((session) => session.sessionId === selectedSession) ??
      searchResults?.find((session) => session.sessionId === selectedSession) ?? null,
    [sessions, searchResults, selectedSession]
  );

  return { statusCounts, filteredSessions, activeSessionData };
}
