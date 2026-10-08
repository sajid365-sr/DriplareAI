"use client";

import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  RefreshCcw,
  AlertCircle,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
  Sparkles,
  Users,
  ShoppingBag,
  MessageSquareOff,
  Ticket,
  CheckCircle2,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { LeadStatusBadge } from "./lead-status-badge";
import {
  FacebookIcon,
  WhatsAppIcon,
  InstagramIcon,
  TelegramIcon,
  MessengerIcon,
} from "@/components/icons/PlatformIcons";

interface Session {
  sessionId: string;
  title: string;
  platform: string;
  isActive: boolean;
  isArchived?: boolean;
  profilePhoto?: string | null;
  leadStatus?: string;
  tags?: string[];
  lastMessage?: string | null;
  timestamp: string;
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
  onSeedDemoChats?: () => void;
}

function PlatformIcon({ platform }: { platform: string }) {
  switch (platform?.toLowerCase()) {
    case "facebook":   return <FacebookIcon  className="w-3.5 h-3.5 text-[#1877F2]" />;
    case "whatsapp":   return <WhatsAppIcon  className="w-3.5 h-3.5 text-[#25D366]" />;
    case "instagram":  return <InstagramIcon className="w-3.5 h-3.5 text-[#E1306C]" />;
    case "telegram":   return <TelegramIcon  className="w-3.5 h-3.5 text-[#24A1DE]" />;
    case "messenger":  return <MessengerIcon className="w-3.5 h-3.5 text-[#0084FF]" />;
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
  loadingSessions,
  selectedSession,
  onSelectSession,
  onRefresh,
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
  onSeedDemoChats,
}: SessionListProps) {
  const { t } = useTranslation("live-inbox");

  const getEmptyStateConfig = () => {
    switch (activeStatusTab) {
      case "orderRequests":
        return {
          icon: ShoppingBag,
          title: "No Order Requests",
          desc: "No customer order requests found in this filter view.",
        };
      case "unreplied":
        return {
          icon: MessageSquareOff,
          title: "No Unreplied Messages",
          desc: "Awesome! All customer messages have been answered.",
        };
      case "tickets":
        return {
          icon: AlertCircle,
          title: "No Human Intervention Needed",
          desc: "AI engine is handling all active conversations smoothly.",
        };
      case "resolved":
        return {
          icon: CheckCircle2,
          title: "No Resolved Conversations",
          desc: "No conversations marked as resolved yet.",
        };
      case "archived":
        return {
          icon: Archive,
          title: "No Archived Conversations",
          desc: "There are no archived chat sessions.",
        };
      default:
        return {
          icon: Users,
          title: t("sessionList.noSessions"),
          desc: "There are currently no active or past chat sessions available.",
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
              placeholder={t("sessionList.search")}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-muted/50 border border-border/60 rounded-lg text-[12.5px] placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
            />
          </div>

          {/* Seed Demo Chats Button */}
          {onSeedDemoChats && (
            <button
              onClick={onSeedDemoChats}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-[11.5px] font-semibold transition-colors shrink-0"
              title="Seed Demo Chats to Neon DB"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Seed</span>
            </button>
          )}
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
            {onSeedDemoChats && (
              <button
                onClick={onSeedDemoChats}
                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-[12px] font-medium rounded-lg transition-colors shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Seed Demo Chats</span>
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredSessions.map((session) => {
              const isSelected = selectedSession === session.sessionId;
              const isChecked  = selectedSessionIds.includes(session.sessionId);
              const tags = getMockTagsForSession(session);

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
                  {/* Card Row 1: Checkbox + Avatar + Title + Time + Star */}
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
                        {session.isActive && <span className="text-violet-400 font-medium">AI⁺: </span>}
                        {session.lastMessage || "Click to view conversation..."}
                      </p>
                    </div>

                    {/* Action Buttons: Archive + Star */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleArchiveSession?.(session.sessionId, !!session.isArchived);
                        }}
                        title={session.isArchived ? "Unarchive chat" : "Archive chat"}
                        className="text-muted-foreground/50 hover:text-purple-600 dark:hover:text-purple-400 p-0.5 rounded transition-colors"
                      >
                        {session.isArchived ? (
                          <ArchiveRestore className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        ) : (
                          <Archive className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground/40 hover:text-amber-400 transition-colors p-0.5 rounded"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card Row 2: Multiple Lead Tags & AI Status */}
                  <div className="mt-2.5 pl-6 flex items-center justify-between gap-1 flex-wrap">
                    <div className="flex items-center gap-1 flex-wrap">
                      {tags.map((tag) => (
                        <LeadStatusBadge key={tag} status={tag} />
                      ))}
                    </div>

                    {/* AI Toggle Indicator */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSessionStatus(session.sessionId, session.isActive);
                      }}
                      className="shrink-0"
                    >
                      {session.isActive ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {t("sessionList.aiActive")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          {t("sessionList.manualMode")}
                        </span>
                      )}
                    </button>
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
