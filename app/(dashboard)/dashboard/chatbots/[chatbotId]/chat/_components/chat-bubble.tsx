"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, User, FileText, Image as ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  attachments?: Array<{
    type: "image" | "file";
    url: string;
    name?: string;
  }>;
}

interface ChatBubbleProps {
  message: ChatMessage;
  botAvatar?: string;
  botName?: string;
}

export const ChatBubble = ({ message, botAvatar, botName }: ChatBubbleProps) => {
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const isUser = message.role === "user";
  const displayTime =
    message.timestamp ||
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={cn(
          "flex items-end gap-2 mb-2 group",
          isUser ? "justify-end flex-row-reverse" : "justify-start"
        )}
      >
        {/* Avatar */}
        {isUser ? (
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 ring-2 ring-background flex items-center justify-center text-white shrink-0 shadow-xs mb-5">
            <User className="w-3.5 h-3.5" />
          </div>
        ) : botAvatar ? (
          <img
            src={botAvatar}
            alt={botName || "AI Assistant"}
            className="w-7 h-7 rounded-full object-cover shrink-0 mb-5 ring-2 ring-background shadow-xs"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-brand-gradient ring-2 ring-background flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs mb-5">
            {botName ? botName.charAt(0).toUpperCase() : <Sparkles className="w-3.5 h-3.5" />}
          </div>
        )}

        {/* Bubble + Timestamp container */}
        <div className={cn("flex flex-col max-w-[80%]", isUser ? "items-end" : "items-start")}>
          {/* Attachments rendering */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {message.attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs group/img relative"
                >
                  {att.type === "image" ? (
                    <div
                      className="cursor-pointer overflow-hidden rounded-2xl relative"
                      onClick={() => setLightboxImg(att.url)}
                      title="Click to view full image"
                    >
                      <img
                        src={att.url}
                        alt={att.name || "Uploaded image"}
                        className="max-h-48 w-full max-w-[240px] object-cover transition-transform duration-200 hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/15 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/60 text-white text-[11px] font-semibold px-2 py-1 rounded-full backdrop-blur-xs">
                          🔍 View
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-foreground">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <span className="truncate max-w-[160px]">{att.name || "Attached File"}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Message Content Bubble */}
          {message.content && (
            <div
              className={cn(
                "px-4 py-2.5 text-[14px] leading-[1.5] shadow-xs whitespace-pre-wrap break-words transition-all",
                isUser
                  ? "bg-primary text-primary-foreground rounded-[20px] rounded-br-xs font-normal"
                  : "bg-muted/80 dark:bg-muted/50 border border-border/60 text-foreground rounded-[20px] rounded-bl-xs"
              )}
            >
              {message.content}
            </div>
          )}

          {/* Timestamp */}
          <span className="text-[10px] text-muted-foreground font-medium mt-1 px-1 opacity-75 group-hover:opacity-100 transition-opacity">
            {displayTime}
          </span>
        </div>
      </motion.div>

      {/* Lightbox Modal for Image Preview */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-0 duration-200"
          onClick={() => setLightboxImg(null)}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl bg-card border border-border shadow-2xl p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImg}
              alt="Preview"
              className="max-h-[80vh] w-auto object-contain rounded-xl"
            />
            <button
              onClick={() => setLightboxImg(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors shadow-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const TypingIndicator = () => (
  <div className="flex justify-start items-end gap-2 mb-4">
    <div className="w-7 h-7 rounded-full bg-brand-gradient flex items-center justify-center text-white shrink-0 mb-0.5 shadow-xs">
      <Sparkles className="w-3.5 h-3.5" />
    </div>
    <div className="px-4 py-3 rounded-[20px] rounded-bl-xs bg-muted/80 dark:bg-muted/50 border border-border/60 shadow-xs flex gap-1.5 items-center h-[38px]">
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ repeat: Infinity, duration: 0.8, delay: 0 }}
        className="w-1.5 h-1.5 rounded-full bg-primary/70"
      />
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }}
        className="w-1.5 h-1.5 rounded-full bg-primary/70"
      />
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }}
        className="w-1.5 h-1.5 rounded-full bg-primary/70"
      />
    </div>
  </div>
);
