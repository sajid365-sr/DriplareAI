"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { Sparkles } from "lucide-react";

interface ChatBubbleProps {
  message: {
    role: "user" | "assistant";
    content: string;
  };
}

export const ChatBubble = ({ message }: ChatBubbleProps) => {
  const isUser = message.role === "user";
  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 5 }} 
      animate={{ opacity: 1, scale: 1, y: 0 }} 
      className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"} mb-1`}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary to-violet-400 flex items-center justify-center text-white shrink-0 mb-0.5">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      )}
      <div className={`px-3.5 py-2 text-[14.5px] max-w-[80%] leading-[1.4] shadow-sm transition-all whitespace-pre-wrap ${
        isUser 
          ? "bg-[#0084ff] text-white rounded-[18px] rounded-br-[4px] font-normal" 
          : "bg-secondary/70 text-foreground rounded-[18px] rounded-bl-[4px]"
      }`}>
        {message.content}
      </div>
    </motion.div>
  );
};

export const TypingIndicator = () => (
  <div className="flex justify-start items-end gap-2 mb-4">
    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary to-violet-400 flex items-center justify-center text-white shrink-0 mb-0.5">
      <Sparkles className="w-3.5 h-3.5" />
    </div>
    <div className="px-4 py-3 rounded-[18px] rounded-bl-[4px] bg-secondary/70 shadow-sm flex gap-2 items-center h-[36px]">
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ repeat: Infinity, duration: 0.8, delay: 0 }}
        className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
      />
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }}
        className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
      />
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }}
        className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
      />
    </div>
  </div>
);
