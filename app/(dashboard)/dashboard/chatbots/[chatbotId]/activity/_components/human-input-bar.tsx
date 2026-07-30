"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";

interface HumanInputBarProps {
  onSend: (message: string) => Promise<void>;
  isSending?: boolean;
}

/**
 * Manual reply input bar — shown only when AI is paused (isActive = false).
 * Allows a human agent to send a direct reply into the conversation.
 */
export function HumanInputBar({ onSend, isSending = false }: HumanInputBarProps) {
  const { t } = useTranslation("live-inbox");
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [text]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setText("");
    await onSend(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="shrink-0 border-t border-border/60 bg-card"
    >
      {/* Agent mode notice */}
      <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-border/40 bg-amber-500/5">
        <UserRound className="w-3 h-3 text-amber-500 shrink-0" />
        <span className="text-[10.5px] text-amber-500 font-medium">
          {t("humanInput.aiPaused")}
        </span>
      </div>

      {/* Input row */}
      <div className="flex items-end gap-2 p-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("humanInput.placeholder")}
          disabled={isSending}
          rows={1}
          className="flex-1 resize-none bg-muted/50 border border-border/50 rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all disabled:opacity-60 leading-relaxed"
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSend}
          disabled={!text.trim() || isSending}
          className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 flex items-center justify-center text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {isSending ? (
            <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </motion.button>
      </div>

      <p className="px-4 pb-2 text-[10px] text-muted-foreground/60">
        Ctrl + Enter to send
      </p>
    </motion.div>
  );
}
