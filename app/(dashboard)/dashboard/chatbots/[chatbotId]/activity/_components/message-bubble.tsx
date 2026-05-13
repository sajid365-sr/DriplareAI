"use client";

import { motion } from "framer-motion";

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
      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
    >
      <div className="text-[11px] text-muted-foreground mb-1.5 px-1 font-medium">
        {formatShortDate(message.timestamp)}
      </div>
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm ${
        isUser 
          ? 'bg-primary text-primary-foreground rounded-br-sm' 
          : 'bg-card text-foreground rounded-bl-sm border border-border'
      }`}>
        {message.content}
      </div>
    </motion.div>
  );
};
