"use client";

import { motion } from "framer-motion";
import { Sparkles, UserRound } from "lucide-react";

interface MessageBubbleProps {
  message: {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    sentByHuman?: boolean;
  };
  formatShortDate: (date: string) => string;
}

export const MessageBubble = ({ message, formatShortDate }: MessageBubbleProps) => {
  const isUser = message.role === "user";
  const isHumanAgentReply = !isUser && message.sentByHuman === true;

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

      {/* Badge — only for assistant (non-user) messages */}
      {!isUser && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.2 }}
          className="flex items-center gap-1 mt-1 px-1"
        >
          {isHumanAgentReply ? (
            <>
              <UserRound className="w-2.5 h-2.5 text-amber-400" />
              <span className="text-[9.5px] text-amber-400 font-medium tracking-wide">
                Replied by Human Agent
              </span>
            </>
          ) : (
            <>
              <Sparkles className="w-2.5 h-2.5 text-violet-400" />
              <span className="text-[9.5px] text-violet-400 font-medium tracking-wide">
                Replied by Driplare AI
              </span>
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};
