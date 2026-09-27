"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, UserRound, X, ZoomIn } from "lucide-react";

interface MessageBubbleProps {
  message: {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    sentByHuman?: boolean;
    mediaType?: string | null;
    mediaUrl?: string | null;
  };
  formatShortDate: (date: string) => string;
}

const isMediaUrl = (text: string) => {
  if (!text) return false;
  const trimmed = text.trim();
  return (
    /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(trimmed) ||
    trimmed.includes("res.cloudinary.com") ||
    trimmed.includes("fbcdn.net") ||
    trimmed.includes("lookaside.fbsbx.com")
  );
};

/**
 * Renders a single chat message bubble.
 * Supports text, image attachments, and audio attachments.
 * Clicking an image opens a full-size lightbox modal.
 */
export const MessageBubble = ({ message, formatShortDate }: MessageBubbleProps) => {
  const isUser = message.role === "user";
  const isHumanAgentReply = !isUser && message.sentByHuman === true;
  const contentIsPureMediaUrl = isMediaUrl(message.content);
  const imagePreviewUrl =
    message.mediaType === "image"
      ? message.mediaUrl || (contentIsPureMediaUrl ? message.content.trim() : null)
      : !message.mediaType && contentIsPureMediaUrl
        ? message.content.trim()
        : null;
  const hasAudio = message.mediaType === "audio" && !!message.mediaUrl;
  const hasMedia = !!imagePreviewUrl || hasAudio;
  const shouldRenderText = !!message.content && !(!!imagePreviewUrl && contentIsPureMediaUrl);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
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
          className={`max-w-[78%] rounded-2xl overflow-hidden shadow-sm ${
            isUser
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-card text-foreground rounded-bl-sm border border-border/60"
          }`}
        >
          {/* ── Media Attachment ── */}
          {hasMedia && (
            <>
              {imagePreviewUrl ? (
                /* Image attachment */
                <button
                  onClick={() => setLightboxOpen(true)}
                  className="block w-full relative group cursor-zoom-in"
                  title="Click to view full size"
                >
                  <img
                    src={imagePreviewUrl}
                    alt="Shared image"
                    className="w-full max-w-[280px] object-cover rounded-t-2xl"
                    style={{ maxHeight: "220px" }}
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                  </div>
                </button>
              ) : hasAudio ? (
                /* Audio attachment */
                <div className="px-4 pt-3 pb-2">
                  <audio
                    controls
                    src={message.mediaUrl!}
                    className="w-full max-w-[260px] h-8"
                    style={{ colorScheme: "light dark" }}
                  />
                </div>
              ) : null}
            </>
          )}

          {/* ── Text Content ── */}
          {shouldRenderText && (
            <div className="px-4 py-3 text-[13.5px] leading-relaxed">
              {message.content}
            </div>
          )}
          {/* Padding when only media (no text) */}
          {hasMedia && !shouldRenderText && <div className="pb-1" />}
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

      {/* ── Lightbox Modal ── */}
      <AnimatePresence>
        {lightboxOpen && imagePreviewUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setLightboxOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative max-w-4xl max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={imagePreviewUrl}
                alt="Full size"
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
              />
              <button
                onClick={() => setLightboxOpen(false)}
                className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-card border border-border/60 flex items-center justify-center text-foreground hover:bg-muted transition-colors shadow-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
