"use client";

import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Mail,
  Inbox,
  RefreshCcw,
  AlertCircle,
  Search,
  Trash2,
  MessageSquareOff,
  CheckCircle2,
  Archive,
  ArchiveRestore,
  CalendarDays,
  ChevronDown,
  Clock3,
  UserRound,
  Filter,
  MoreHorizontal,
  Zap,
  ZapOff,
} from "lucide-react";
import { LeadStatusBadge } from "./lead-status-badge";
import { SnoozeBadge } from "./SnoozeBadge";
import { UserCheck } from "lucide-react";
import { MessageSearchResult } from "./MessageSearchResult";
import { SnoozeDropdown } from "./SnoozeDropdown";
import {
  WhatsAppIcon,
  InstagramIcon,
  TelegramIcon,
  MessengerIcon,
  WebsiteWidgetIcon,
} from "@/components/icons/PlatformIcons";

interface Session {
  sessionId: string;
  title: string;
  platform: string;
  isActive: boolean;
  isArchived?: boolean;
  snoozeUntil?: string | null;
  assignedToUserId?: string | null;
  assignmentAiPaused?: boolean;
  assignmentAiResumeAt?: string | null;
  matchedSnippet?: string | null;
  matchRole?: string | null;
  matchCount?: number;
  profilePhoto?: string | null;
  leadStatus?: string;
  tags?: string[];
  lastMessage?: string | null;
  timestamp: string;
  isDone?: boolean;
  unread?: boolean;
  lastMessageSender?: "customer" | "agent" | "ai" | string;
}

interface SessionListProps {
  sessions: Session[];
  filteredSessions: Session[];
  loadingSessions: boolean;
  selectedSession: string | null;
  onSelectSession: (id: string) => void;
  onRefresh: () => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  activeStatusTab?: string;
  statusCounts: { waiting: number; unread: number; open: number; done: number; later: number; archived: number };
  onStatusTabChange: (tab: string) => void;
  currentUserId: string | null;
  assigneeFilter: string;
  onAssigneeFilterChange: (filter: string) => void;
  inboxMembers: Array<{ userId: string; name: string; email: string; role: string }>;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  integrationStatus: { status: string; lastError?: string; connected: boolean } | null;
  platforms?: string[];
  searchQuery: string;
  onSearchChange: (search: string) => void;
  selectedSessionIds: string[];
  onToggleSelectSession: (id: string) => void;
  onSelectAllSessions: (checked: boolean) => void;
  onDeleteSelectedSessions: () => void;
  onArchiveSelectedSessions?: (archive: boolean) => void;
  onToggleSessionStatus: (id: string, current: boolean) => void;
  onToggleArchiveSession?: (sessionId: string, currentIsArchived: boolean) => void;
  onSetSessionDone: (sessionId: string, isDone: boolean) => Promise<void>;
  onSnoozeSession: (sessionId: string, until: string) => Promise<void>;
  onUnsnoozeSession: (sessionId: string) => Promise<void>;
}

function PlatformIcon({ platform }: { platform: string }) {
  switch (platform?.toLowerCase()) {
    case "facebook":   return <MessengerIcon className="w-3.5 h-3.5 text-[#0084FF]" />;
    case "whatsapp":   return <WhatsAppIcon  className="w-3.5 h-3.5 text-[#25D366]" />;
    case "instagram":  return <InstagramIcon className="w-3.5 h-3.5 text-[#E1306C]" />;
    case "telegram":   return <TelegramIcon  className="w-3.5 h-3.5 text-[#24A1DE]" />;
    case "messenger":  return <MessengerIcon className="w-3.5 h-3.5 text-[#0084FF]" />;
    case "web":
    case "website":   return <WebsiteWidgetIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />;
    default:           return <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />;
  }
}

function getAvatarBg(platform: string) {
  switch (platform?.toLowerCase()) {
    case "facebook":   return "bg-[#1877F2]";
    case "whatsapp":   return "bg-[#25D366]";
    case "instagram":  return "bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]";
    case "telegram":   return "bg-[#24A1DE]";
    case "messenger":  return "bg-gradient-to-tr from-[#0084FF] to-[#A033FF]";
    default:           return "bg-brand-gradient";
  }
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "Now";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)    return "Just now";
  if (m < 60)   return `${m}min ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}min ago`;
  const d = Math.floor(h / 24);
  if (d < 7)    return `${d}day ago`;
  return new Date(dateStr).toLocaleDateString("en-GB");
}

// Generate sample badges matching LazyChat Inbox design
function getMockTagsForSession(session: Session) {
  if (session.leadStatus && session.leadStatus !== "none") {
    return [session.leadStatus];
  }
  // Deterministic mock tags based on session ID
  const hash = session.sessionId.charCodeAt(session.sessionId.length - 1) || 0;
  if (hash % 3 === 0) return ["priority", "top_client", "high_prospect"];
  if (hash % 3 === 1) return ["risky", "low_prospect"];
  return ["priority", "successful"];
}

export function SessionList({
  filteredSessions,
  sessions,
  loadingSessions,
  selectedSession,
  onSelectSession,
  onRefresh,
  filter,
  onFilterChange,
  activeStatusTab = "allContacts",
  integrationStatus,
  searchQuery,
  onSearchChange,
  selectedSessionIds,
  onToggleSelectSession,
  onSelectAllSessions,
  onDeleteSelectedSessions,
  onArchiveSelectedSessions,
  onToggleSessionStatus,
  onToggleArchiveSession,
  statusCounts,
  onStatusTabChange,
  currentUserId,
  assigneeFilter,
  onAssigneeFilterChange,
  inboxMembers,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onSetSessionDone,
  onSnoozeSession,
  onUnsnoozeSession,
}: SessionListProps) {
  const { t } = useTranslation("live-inbox");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const dateFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDateFilter) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !dateFilterRef.current?.contains(event.target)) {
        setShowDateFilter(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowDateFilter(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [showDateFilter]);
  const statusTabs = [
    { key: "waiting", label: t("statusTabs.waiting"), count: statusCounts.waiting, icon: MessageCircle },
    { key: "unread", label: t("statusTabs.unread"), count: statusCounts.unread, icon: Mail },
    { key: "open", label: t("statusTabs.open"), count: statusCounts.open, icon: Inbox },
    { key: "done", label: t("statusTabs.done"), count: statusCounts.done, icon: CheckCircle2 },
    { key: "archived", label: t("statusTabs.archived"), count: statusCounts.archived, icon: Archive },
  ];
  const channelTabs = [
    { key: "All", label: t("channels.all"), icon: Filter, iconColor: "text-muted-foreground", count: sessions.length },
    { key: "facebook", label: t("channels.facebook"), icon: MessengerIcon, iconColor: "text-[#0084FF]", count: sessions.filter((session) => session.platform.toLowerCase() === "facebook" || session.platform.toLowerCase() === "messenger").length },
    { key: "instagram", label: t("channels.instagram"), icon: InstagramIcon, iconColor: "text-[#E1306C]", count: sessions.filter((session) => session.platform.toLowerCase() === "instagram").length },
    { key: "whatsapp", label: t("channels.whatsapp"), icon: WhatsAppIcon, iconColor: "text-[#25D366]", count: sessions.filter((session) => session.platform.toLowerCase() === "whatsapp").length },
    { key: "web", label: t("channels.web"), icon: WebsiteWidgetIcon, iconColor: "text-sky-600 dark:text-sky-400", count: sessions.filter((session) => session.platform.toLowerCase() === "web").length },
  ];

  const getEmptyStateConfig = () => {
    switch (activeStatusTab) {
      case "waiting":
        return {
          icon: MessageSquareOff,
          title: t("sessionList.noWaiting"),
          desc: "",
        };
      case "unread":
        return {
          icon: MessageSquareOff,
          title: t("sessionList.noUnread"),
          desc: "",
        };
      case "done":
        return {
          icon: CheckCircle2,
          title: t("sessionList.noDone"),
          desc: "",
        };
      case "later":
        return {
          icon: Clock3,
          title: t("sessionList.noLater"),
          desc: "",
        };
      case "archived":
        return {
          icon: Archive,
          title: "No Archived Conversations",
          desc: "There are no archived chat sessions.",
        };
      default:
        return {
          icon: Inbox,
          title: t("sessionList.noOpen"),
          desc: "",
        };
    }
  };

  const emptyConfig = getEmptyStateConfig();
  const EmptyIcon = emptyConfig.icon;

  return (
    <div className="w-full flex flex-col h-full bg-card border border-border/60 rounded-xl overflow-hidden shadow-xs">
      
      {/* ── Search & Filter Controls ── */}
      <div className="p-3 border-b border-border/50 shrink-0 space-y-2.5 bg-card">
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder={t("sessionList.searchPlaceholder", t("sessionList.search"))}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-muted/50 border border-border/60 rounded-lg text-[12.5px] placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5" role="tablist" aria-label={t("statusTabs.label", "Conversation status")}>
          {statusTabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeStatusTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onStatusTabChange(tab.key)}
                className={`inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[10.5px] transition-colors ${selected ? "bg-primary/10 font-semibold text-primary ring-1 ring-primary/25" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                <span className={`rounded-full px-1 text-[9px] ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{tab.count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5" aria-label={t("channels.all")}>
          {channelTabs.map((channel) => {
            const Icon = channel.icon;
            const selected = filter.toLowerCase() === channel.key.toLowerCase();
            return (
              <button
                key={channel.key}
                type="button"
                aria-label={`${channel.label} (${channel.count})`}
                aria-pressed={selected}
                title={`${channel.label} (${channel.count})`}
                onClick={() => onFilterChange(channel.key)}
                className={`inline-flex h-8 min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-2 text-[10px] transition-colors ${selected ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted"}`}
              >
                <Icon className={`h-3.5 w-3.5 ${channel.iconColor}`} />
                <span className="tabular-nums">{channel.count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAssigneeFilterChange(assigneeFilter === "mine" ? "everyone" : "mine")}
            disabled={!currentUserId}
            className={`inline-flex items-center gap-1.5 shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
              assigneeFilter === "mine"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted"
            }`}
          >
            <UserRound className="h-3.5 w-3.5" />
            {t("filterControls.mine")}
          </button>

          <button
            type="button"
            onClick={() => onStatusTabChange("later")}
            className={`inline-flex items-center gap-1.5 shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              activeStatusTab === "later"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted"
            }`}
          >
            <Clock3 className="h-3.5 w-3.5" />
            {t("filterControls.later")}
            {statusCounts.later > 0 && <span>{statusCounts.later}</span>}
          </button>

          <label className="relative inline-flex min-w-0 items-center">
            <UserCheck className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={assigneeFilter === "mine" ? "everyone" : assigneeFilter}
              onChange={(event) => onAssigneeFilterChange(event.target.value)}
              className="max-w-[130px] appearance-none rounded-lg border border-border/60 bg-muted/30 py-1.5 pl-7 pr-7 text-[11px] text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              aria-label={t("filterControls.everyone")}
            >
              <option value="everyone">{t("filterControls.everyone")}</option>
              {inboxMembers.map((member) => (
                <option key={member.userId} value={member.userId}>{member.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-muted-foreground" />
          </label>

          <div ref={dateFilterRef} className="relative ml-auto shrink-0">
            <button
              type="button"
              onClick={() => setShowDateFilter((visible) => !visible)}
              aria-expanded={showDateFilter}
              aria-haspopup="dialog"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                dateFrom || dateTo
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted"
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              {t("filterControls.any")}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showDateFilter && (
              <div className="absolute right-0 top-full z-40 mt-2 w-[min(16rem,calc(100vw-5rem))] rounded-xl border border-border bg-card p-3 shadow-xl">
                <label className="mb-2 block text-[11px] font-medium text-muted-foreground">
                  {t("filterControls.from")}
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => onDateFromChange(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-foreground"
                  />
                </label>
                <label className="block text-[11px] font-medium text-muted-foreground">
                  {t("filterControls.to")}
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(event) => onDateToChange(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-foreground"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => { onDateFromChange(""); onDateToChange(""); }}
                  className="mt-3 text-[11px] font-semibold text-primary hover:underline"
                >
                  {t("filterControls.clearDates")}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Connection error banner */}
        {integrationStatus?.status === "error" && (
          <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold text-destructive uppercase tracking-wider leading-none mb-0.5">
                {t("sessionList.connectionError")}
              </p>
              <p className="text-[11px] text-destructive/80 leading-tight">
                {integrationStatus.lastError ?? "Token expired. Please reconnect."}
              </p>
            </div>
          </div>
        )}

        {/* Select All / Delete Bulk Actions Row */}
        {filteredSessions.length > 0 && (
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-[11px] font-medium cursor-pointer text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={
                  filteredSessions.length > 0 &&
                  filteredSessions.every((s) => selectedSessionIds.includes(s.sessionId))
                }
                onChange={(e) => onSelectAllSessions(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/50 cursor-pointer accent-primary"
              />
              {t("sessionList.selectAll")} ({filteredSessions.length})
            </label>

            {selectedSessionIds.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onArchiveSelectedSessions?.(activeStatusTab !== "archived")}
                  className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 rounded-md transition-colors"
                >
                  {activeStatusTab === "archived" ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                  {activeStatusTab === "archived" ? "Unarchive" : "Archive"} ({selectedSessionIds.length})
                </button>
                <button
                  onClick={onDeleteSelectedSessions}
                  className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  {t("sessionList.deleteSelected")} ({selectedSessionIds.length})
                </button>
              </div>
            )}

            <button
              onClick={onRefresh}
              disabled={loadingSessions}
              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
              title={t("sessionList.refresh")}
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loadingSessions ? "animate-spin" : ""}`} />
            </button>
          </div>
        )}
      </div>

      {/* ── Sessions Cards List ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border/40">
        {loadingSessions ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 items-start animate-pulse">
                <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-2.5 bg-muted rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center h-full gap-3 text-muted-foreground my-auto">
            <div className="w-12 h-12 rounded-full bg-purple-500/10 dark:bg-purple-900/20 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <EmptyIcon className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-[220px]">
              <p className="text-[13px] font-bold text-foreground">{emptyConfig.title}</p>
              <p className="text-[11.5px] text-muted-foreground leading-snug">{emptyConfig.desc}</p>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredSessions.map((session) => {
              const isSelected = selectedSession === session.sessionId;
              const isChecked  = selectedSessionIds.includes(session.sessionId);
              const tags = getMockTagsForSession(session);
              const assignedMember = inboxMembers.find((member) => member.userId === session.assignedToUserId);
              const isPersonHandled = !session.isActive;
              const handledBy = session.assignedToUserId
                ? session.assignedToUserId === currentUserId
                  ? t("sessionList.you", "You")
                  : assignedMember?.name || assignedMember?.email
                : undefined;

              return (
                <motion.div
                  key={session.sessionId}
                  layout
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => onSelectSession(session.sessionId)}
                  className={`relative p-3 cursor-pointer border-b border-border/40 transition-all ${
                    isSelected
                      ? "bg-primary/10 border-l-4 border-l-primary"
                      : "hover:bg-muted/40 border-l-4 border-l-transparent"
                  }`}
                >
                  {/* Card Row 1: Checkbox, avatar, title, time, and overflow actions */}
                  <div className="flex items-start gap-2.5">
                    <div
                      className="mt-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleSelectSession(session.sessionId)}
                        className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/50 cursor-pointer accent-primary"
                      />
                    </div>

                    {/* Avatar with platform badge */}
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-full overflow-hidden shadow-xs">
                        {session.profilePhoto ? (
                          <img
                            src={session.profilePhoto}
                            alt={session.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className={`w-full h-full flex items-center justify-center text-white font-bold text-xs ${getAvatarBg(
                              session.platform
                            )}`}
                          >
                            {session.title.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-card rounded-full flex items-center justify-center shadow-xs border border-border/40">
                        <PlatformIcon platform={session.platform} />
                      </div>
                    </div>

                    {/* Title & Preview */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-[13px] font-semibold text-foreground truncate leading-tight">
                          {session.title}
                        </h4>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                          {timeAgo(session.timestamp)}
                        </span>
                      </div>

                      {/* Last Message Preview */}
                      <p className="text-[11.5px] text-muted-foreground mt-0.5 truncate leading-snug">
                        {session.lastMessageSender && (
                          <span className="font-medium text-violet-400">
                            {session.lastMessageSender === "customer"
                              ? ""
                              : session.lastMessageSender === "ai"
                                ? `${t("sessionList.aiAnsweringPrefix", "AI")}: `
                                : `${t("sessionList.agentPrefix", "Agent")}: `}
                          </span>
                        )}
                        {session.lastMessage || "Click to view conversation..."}
                      </p>
                      {searchQuery && session.matchedSnippet && (
                        <MessageSearchResult
                          matchedSnippet={session.matchedSnippet}
                          searchQuery={searchQuery}
                          matchCount={session.matchCount}
                          matchRole={session.matchRole ?? undefined}
                        />
                      )}
                    </div>

                    {/* Keep conversation actions in the overflow menu to reduce card clutter. */}
                    <div className="flex items-center gap-1 shrink-0">
                      <details className="relative" onClick={(event) => event.stopPropagation()}>
                        <summary
                          className="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden"
                          aria-label={t("sessionList.moreActions", "More actions")}
                          title={t("sessionList.moreActions", "More actions")}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </summary>
                        <div className="absolute right-0 top-full z-30 mt-1.5 min-w-40 rounded-xl border border-border bg-card p-1.5 shadow-xl">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.currentTarget.closest("details")?.removeAttribute("open");
                              void onSetSessionDone(session.sessionId, !session.isDone);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11.5px] text-foreground hover:bg-muted"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {session.isDone ? t("filterControls.reopen", "Reopen") : t("statusTabs.done", "Done")}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.currentTarget.closest("details")?.removeAttribute("open");
                              onToggleArchiveSession?.(session.sessionId, !!session.isArchived);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11.5px] text-foreground hover:bg-muted"
                          >
                            {session.isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                            {session.isArchived ? t("conversation.unarchiveAction", "Unarchive") : t("conversation.archiveAction", "Archive")}
                          </button>
                          <SnoozeDropdown
                            currentSnoozeUntil={session.snoozeUntil}
                            triggerLabel={t("statusTabs.later", "Later")}
                            triggerClassName="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11.5px] text-foreground hover:bg-muted"
                            onSnooze={(until) => onSnoozeSession(session.sessionId, until)}
                            onUnsnooze={() => onUnsnoozeSession(session.sessionId)}
                          />
                          <button
                            type="button"
                            onClick={(event) => {
                              event.currentTarget.closest("details")?.removeAttribute("open");
                              onToggleSessionStatus(session.sessionId, session.isActive);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11.5px] text-foreground hover:bg-muted"
                          >
                            {session.isActive ? <ZapOff className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                            {session.isActive ? t("conversation.stopAI", "Stop AI") : t("conversation.resumeAI", "Resume AI")}
                          </button>
                        </div>
                      </details>
                    </div>
                  </div>

                  {/* Card Row 2: Multiple Lead Tags & AI Status */}
                  <div className="mt-2.5 pl-6 flex items-center justify-between gap-1 flex-wrap">
                    <div className="flex items-center gap-1 flex-wrap">
                      {tags.map((tag) => (
                        <LeadStatusBadge key={tag} status={tag} />
                      ))}
                      {session.snoozeUntil && (
                        <SnoozeBadge snoozeUntil={session.snoozeUntil} showReturnLabel />
                      )}
                    </div>

                    {isPersonHandled ? (
                      <div className="ml-auto flex max-w-[55%] shrink-0 items-center gap-1.5">
                        {handledBy && (
                          <span className="max-w-24 truncate text-[10px] font-semibold text-foreground" title={handledBy}>
                            {handledBy}
                          </span>
                        )}
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-primary"
                          title={t("sessionList.person", "Person")}
                        >
                          <UserRound className="h-3 w-3 shrink-0" />
                          <span>{t("sessionList.person", "Person")}</span>
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-sky-700 dark:text-sky-300">
                        <Zap className="h-3 w-3 shrink-0" />
                        {t("sessionList.aiBadge", "AI")}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
