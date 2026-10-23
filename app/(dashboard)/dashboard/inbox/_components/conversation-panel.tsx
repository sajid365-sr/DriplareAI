"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  MessageCircle,
  Trash2,
  Download,
  Zap,
  ZapOff,
  Sparkles,
  Circle,
  Archive,
  ArchiveRestore,
  ShieldAlert,
  MoreHorizontal,
  CheckCircle2,
} from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { HumanInputBar } from "./human-input-bar";
import { LeadStatusBadge } from "./lead-status-badge";
import { useState } from "react";
import { SnoozeDropdown } from "./SnoozeDropdown";
import { SnoozeBadge } from "./SnoozeBadge";
import { AssignAgentDropdown, type AssignableInboxMember } from "./AssignAgentDropdown";
import {
  InstagramIcon,
  MessengerIcon,
  TelegramIcon,
  WebsiteWidgetIcon,
  WhatsAppIcon,
} from "@/components/icons/PlatformIcons";

interface ConversationPanelProps {
  selectedSession: string | null;
  messages: any[];
  loadingMessages: boolean;
  activeSessionData: any;
  chatbotId?: string | null;
  teamMembers: AssignableInboxMember[];
  currentUserId: string | null;
  onDelete: (id: string) => void;
  onDownload: () => void;
  onToggleStatus: (id: string, current: boolean) => void;
  onSetSessionDone: (sessionId: string, isDone: boolean) => Promise<void>;
  onToggleArchive?: (id: string, current: boolean) => void;
  onToggleBlockAi?: (sessionId: string, currentBlocked: boolean) => Promise<void>;
  onSnoozeSession?: (sessionId: string, until: string) => Promise<void>;
  onUnsnoozeSession?: (sessionId: string) => Promise<void>;
  onAssignSession?: (
    sessionId: string,
    userId: string | null,
    userName?: string,
    assignmentNote?: string,
    aiPauseDurationMinutes?: number | null
  ) => Promise<void>;
  onSendHumanMessage: (message: string, mediaUrl?: string, mediaType?: 'image' | 'audio', replyToMessageId?: string, replyToSnippet?: string) => Promise<void>;
  isSendingMessage?: boolean;
  formatShortDate: (date: string) => string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  draftText?: string;
  onDraftChange?: (val: string) => void;
}

export const ConversationPanel = ({
  selectedSession,
  messages,
  loadingMessages,
  activeSessionData,
  chatbotId,
  teamMembers = [],
  currentUserId,
  onDelete,
  onDownload,
  onToggleStatus,
  onSetSessionDone,
  onToggleArchive,
  onToggleBlockAi,
  onSnoozeSession,
  onUnsnoozeSession,
  onAssignSession,
  onSendHumanMessage,
  isSendingMessage = false,
  formatShortDate,
  messagesEndRef,
  draftText,
  onDraftChange,
}: ConversationPanelProps) => {
  const { t } = useTranslation("live-inbox");
  const isAiActive = activeSessionData?.isActive ?? true;
  const isArchived = activeSessionData?.isArchived ?? false;
  const isAiBlocked = Boolean(activeSessionData?.isAiBlocked);
  const isDone = Boolean(activeSessionData?.isDone);
  const snoozeUntil = activeSessionData?.snoozeUntil as string | null | undefined;
  const [replyingTo, setReplyingTo] = useState<{ id: string; snippet: string } | null>(null);
  const assignedToUserId = activeSessionData?.assignedToUserId as string | null | undefined;
  const lastMessageSender = activeSessionData?.lastMessageSender as string | undefined;
  const lastMessage = activeSessionData?.lastMessage as string | null | undefined;
  const platform = String(activeSessionData?.platform ?? "").toLowerCase();
  const platformDetails = (() => {
    switch (platform) {
      case "facebook":
      case "messenger": return { name: "Messenger", Icon: MessengerIcon, color: "text-[#0084FF]" };
      case "whatsapp": return { name: "WhatsApp", Icon: WhatsAppIcon, color: "text-[#25D366]" };
      case "instagram": return { name: "Instagram", Icon: InstagramIcon, color: "text-[#E1306C]" };
      case "telegram": return { name: "Telegram", Icon: TelegramIcon, color: "text-[#24A1DE]" };
      case "web":
      case "website":
      case "widget": return { name: "Website", Icon: WebsiteWidgetIcon, color: "text-sky-600 dark:text-sky-400" };
      default: return platform ? { name: platform[0].toUpperCase() + platform.slice(1), Icon: MessageCircle, color: "text-muted-foreground" } : null;
    }
  })();

  if (!selectedSession) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-card border border-border/60 rounded-xl shadow-xs">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 opacity-30" />
          </div>
          <p className="text-[13px]">{t("conversation.selectPrompt")}</p>
        </div>
      </div>
    );
  }

  return (
    <div data-conversation-panel className="w-full flex flex-col h-full bg-card border border-border/60 rounded-xl shadow-xs overflow-hidden">
      
      {/* ── Top Bar Header ── */}
      <div className="relative z-20 shrink-0 px-4 py-3 border-b border-border/50 bg-card/90 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          
          {/* Left Customer Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              {activeSessionData?.profilePhoto ? (
                <img
                  src={activeSessionData.profilePhoto}
                  alt={activeSessionData?.title ?? "User"}
                  className="w-9 h-9 rounded-full object-cover border border-border/40 shadow-xs"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-brand-gradient flex items-center justify-center text-white text-sm font-bold shadow-xs">
                  {activeSessionData?.title?.charAt(0)?.toUpperCase() ?? "U"}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-card" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[14.5px] font-semibold text-foreground truncate leading-tight">
                  {activeSessionData?.title ?? "Customer Session"}
                </h3>
                {platformDetails && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    <platformDetails.Icon className={`h-3.5 w-3.5 ${platformDetails.color}`} />
                    {platformDetails.name}
                  </span>
                )}
                {activeSessionData?.leadStatus && activeSessionData.leadStatus !== "none" && (
                  <LeadStatusBadge status={activeSessionData.leadStatus} />
                )}
                {snoozeUntil && <SnoozeBadge snoozeUntil={snoozeUntil} />}
                                {isAiBlocked && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    <ShieldAlert className="w-3 h-3 text-rose-500" />
                    {t("aiBlock.blockedBadge", "AI Blocked")}
                  </span>
                )}
                {isArchived && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    Archived
                  </span>
                )}
              </div>
              {lastMessage && (
                <p className="mt-1 max-w-[min(42vw,520px)] truncate text-[11px] leading-snug text-muted-foreground">
                  <span className="font-semibold text-violet-500">
                    {lastMessageSender === "customer"
                      ? ""
                      : lastMessageSender === "ai"
                        ? `${t("sessionList.aiAnsweringPrefix", "AI")}: `
                        : `${t("sessionList.agentPrefix", "Agent")}: `}
                  </span>
                  {lastMessage}
                </p>
              )}
            </div>
          </div>

          {/* Conversation actions */}
          <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void onSetSessionDone(selectedSession, !isDone)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:text-[12px] ${
                isDone
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
              title={isDone ? t("filterControls.reopen", "Reopen") : t("statusTabs.done", "Done")}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{isDone ? t("filterControls.reopen", "Reopen") : t("statusTabs.done", "Done")}</span>
            </button>

            <SnoozeDropdown
              currentSnoozeUntil={snoozeUntil}
              onSnooze={async (until) => {
                if (onSnoozeSession) await onSnoozeSession(selectedSession, until);
              }}
              onUnsnooze={async () => {
                if (onUnsnoozeSession) await onUnsnoozeSession(selectedSession);
              }}
            />

            <AssignAgentDropdown
              key={selectedSession ?? "no-session"}
              members={teamMembers}
              assignedUserId={assignedToUserId}
              assignmentNote={activeSessionData?.assignmentNote ?? null}
              currentUserId={currentUserId}
              onAssign={async (userId, name, assignmentNote, aiPauseDurationMinutes) => {
                if (onAssignSession) {
                  await onAssignSession(selectedSession, userId, name, assignmentNote, aiPauseDurationMinutes);
                }
              }}
            />

            <button
              type="button"
              onClick={() => selectedSession && onToggleBlockAi?.(selectedSession, isAiBlocked)}
              className={`rounded-lg border p-1.5 transition-colors ${
                isAiBlocked
                  ? "border-rose-500/30 bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25"
                  : "border-border text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
              }`}
              title={isAiBlocked ? t("aiBlock.unblockAi", "Unblock AI") : t("aiBlock.blockAi", "Permanently Block AI")}
              aria-label={isAiBlocked ? t("aiBlock.unblockAi", "Unblock AI") : t("aiBlock.blockAi", "Permanently Block AI")}
            >
              <ShieldAlert className="h-4 w-4" />
            </button>

            {/* Stop AI / Resume AI Prominent Purple Button */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onToggleStatus(selectedSession, isAiActive)}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition-all shadow-sm sm:px-3.5 sm:text-[12.5px] ${
                isAiActive
                  ? "bg-violet-600 hover:bg-violet-700 text-white shadow-violet-600/20"
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
              }`}
            >
              {isAiActive ? (
                <>
                  <ZapOff className="w-3.5 h-3.5" />
                  <span>{t("conversation.stopAI")}</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>{t("conversation.resumeAI")}</span>
                </>
              )}
            </motion.button>

            <details className="relative">
              <summary
                className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden"
                aria-label={t("conversation.moreActions", "More actions")}
                title={t("conversation.moreActions", "More actions")}
              >
                <MoreHorizontal className="h-4 w-4" />
              </summary>
              <div className="absolute right-0 top-full z-30 mt-2 min-w-48 rounded-xl border border-border bg-card p-1.5 shadow-lg">
                <button
                  type="button"
                  onClick={(event) => {
                    event.currentTarget.closest("details")?.removeAttribute("open");
                    if (selectedSession) onToggleArchive?.(selectedSession, isArchived);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-foreground hover:bg-muted"
                >
                  {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  {isArchived ? t("conversation.unarchiveAction", "Unarchive") : t("conversation.archiveAction", "Archive")}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.currentTarget.closest("details")?.removeAttribute("open");
                    onDownload();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-foreground hover:bg-muted"
                >
                  <Download className="h-4 w-4" />
                  {t("conversation.downloadAction", "Download")}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.currentTarget.closest("details")?.removeAttribute("open");
                    onDelete(selectedSession);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                  {t("conversation.deleteAction", "Delete")}
                </button>
              </div>
            </details>
          </div>
        </div>

        {/* AI Status Badge Bar */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Circle
              className={`w-2 h-2 fill-current ${
                isAiActive ? "text-emerald-500 animate-pulse" : "text-amber-500"
              }`}
            />
            <span
              className={`text-[11px] font-medium ${
                isAiActive ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {isAiActive
                ? t("conversation.aiStatus.active")
                : t("conversation.aiStatus.manual")}
            </span>
          </div>

          <span className="text-[10px] text-muted-foreground">
            {t("conversation.sessionId")}: {selectedSession.slice(0, 12)}...
          </span>
        </div>
      </div>

      {/* ── AI Blocked Notice Banner ── */}
      {isAiBlocked && (
        <div className="shrink-0 bg-rose-500/10 border-b border-rose-500/20 px-4 py-2 text-[12px] text-rose-600 dark:text-rose-400 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="truncate">{t("aiBlock.blockedBanner", "AI is permanently blocked for this user (Spam Protection). Zero AI credits are consumed.")}</span>
          </div>
          <button
            onClick={() => selectedSession && onToggleBlockAi?.(selectedSession, isAiBlocked)}
            className="text-[11px] underline font-semibold hover:opacity-80 shrink-0"
          >
            {t("aiBlock.unblockAi", "Unblock AI")}
          </button>
        </div>
      )}
      {/* ── Chat Messages Content ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-muted/20 scrollbar-thin scrollbar-thumb-border/40">
        {loadingMessages ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-[12.5px]">{t("conversation.loading")}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <MessageCircle className="w-8 h-8 opacity-20" />
            <p className="text-[12.5px]">{t("conversation.noMessages")}</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id || i}
                message={msg}
                chatbotId={chatbotId}
                onReply={(msg) => setReplyingTo({
                  id: msg.id,
                  snippet: msg.content || (msg.mediaType === "image" ? t("quoted.quotedPhoto", "Photo") : msg.mediaType === "audio" ? t("quoted.quotedAudio", "Voice message") : t("quoted.messageUnavailable", "Original message unavailable"))
                })}
                formatShortDate={formatShortDate}
              />
            ))}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Human Input Bar (When AI is Paused) ── */}
      <AnimatePresence>
        {!isAiActive && (
          <HumanInputBar
            onSend={onSendHumanMessage}
            isSending={isSendingMessage}
            chatbotId={chatbotId ?? null}
            draftText={draftText}
            onDraftChange={onDraftChange}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
          />
        )}
      </AnimatePresence>

      {/* ── AI handling notice footer ── */}
      {isAiActive && (
        <div className="shrink-0 px-4 py-2 border-t border-border/40 bg-card/80 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <span className="text-[11px] text-muted-foreground">
            Driplare AI is handling this conversation. Click{" "}
            <strong className="text-foreground font-semibold">Stop AI</strong> to take over manually.
          </span>
        </div>
      )}
    </div>
  );
};
