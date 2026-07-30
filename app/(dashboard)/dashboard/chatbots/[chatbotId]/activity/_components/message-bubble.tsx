"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface MessageBubbleProps {
  message: {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
  };
  formatShortDate: (date: string) => string;
}

export const MessageBubble = ({ message, formatShortDate }: MessageBubbleProps) => {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
    >
      {/* Timestamp */}
      <div className="text-[10px] text-muted-foreground mb-1 px-1 font-medium">
        {formatShortDate(message.timestamp)}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed shadow-sm ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card text-foreground rounded-bl-sm border border-border/60"
        }`}
      >
        {message.content}
      </div>

      {/* "Replied by Driplare AI ✨" badge — only for AI replies */}
      {!isUser && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.2 }}
          className="flex items-center gap-1 mt-1 px-1"
        >
          <Sparkles className="w-2.5 h-2.5 text-violet-400" />
          <span className="text-[9.5px] text-violet-400 font-medium tracking-wide">
            Replied by Driplare AI
          </span>
        </motion.div>
      )}
    </motion.div>
  );
};
