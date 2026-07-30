"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  MessageCircle,
  Trash2,
  Download,
  Zap,
  ZapOff,
  UserPlus,
  Star,
  MessageSquare,
  Sparkles,
  Circle,
} from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { HumanInputBar } from "./human-input-bar";
import { LeadStatusBadge } from "./lead-status-badge";

interface ConversationPanelProps {
  selectedSession: string | null;
  messages: any[];
  loadingMessages: boolean;
  activeSessionData: any;
  onDelete: (id: string) => void;
  onDownload: () => void;
  onToggleStatus: (id: string, current: boolean) => void;
  onSendHumanMessage: (message: string) => Promise<void>;
  isSendingMessage?: boolean;
  formatShortDate: (date: string) => string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const ConversationPanel = ({
  selectedSession,
  messages,
  loadingMessages,
  activeSessionData,
  onDelete,
  onDownload,
  onToggleStatus,
  onSendHumanMessage,
  isSendingMessage = false,
  formatShortDate,
  messagesEndRef,
}: ConversationPanelProps) => {
  const { t } = useTranslation("live-inbox");
  const isAiActive = activeSessionData?.isActive ?? true;

  if (!selectedSession) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-card border border-border/60 rounded-xl shadow-xs">
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
    <div className="flex-1 min-w-0 flex flex-col h-full bg-card border border-border/60 rounded-xl shadow-xs overflow-hidden">
      
      {/* ── Top Bar Header ── */}
      <div className="shrink-0 px-4 py-3 border-b border-border/50 bg-card/90 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          
          {/* Left Customer Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-blue-500 flex items-center justify-center text-white text-sm font-bold shadow-xs">
                {activeSessionData?.title?.charAt(0)?.toUpperCase() ?? "U"}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-card" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[14.5px] font-semibold text-foreground truncate leading-tight">
                  {activeSessionData?.title ?? "Customer Session"}
                </h3>
                {activeSessionData?.leadStatus && activeSessionData.leadStatus !== "none" && (
                  <LeadStatusBadge status={activeSessionData.leadStatus} />
                )}
              </div>
              
              <div className="flex items-center gap-1.5 mt-0.5">
                <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  <UserPlus className="w-3 h-3 text-primary" />
                  <span>{t("conversation.assignAgent")}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Action Icons & Stop AI Button */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Action Icons */}
            <div className="flex items-center gap-1 text-muted-foreground mr-1">
              <button className="p-1.5 hover:text-amber-400 hover:bg-muted rounded-md transition-colors">
                <Star className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(selectedSession)}
                className="p-1.5 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                title={t("conversation.delete")}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={onDownload}
                className="p-1.5 hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                title={t("conversation.download")}
              >
                <Download className="w-4 h-4" />
              </button>
              <button className="p-1.5 hover:text-foreground hover:bg-muted rounded-md transition-colors">
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>

            {/* Stop AI / Resume AI Prominent Purple Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onToggleStatus(selectedSession, isAiActive)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[12.5px] font-semibold transition-all shadow-sm ${
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
