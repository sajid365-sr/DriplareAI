"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, UserRound, X, ZoomIn } from "lucide-react";
import { ProductCardStrip, parseProductCards } from "./product-card-strip";

/**
 * Renders inline `**bold**` inside one line of an AI reply.
 *
 * The model writes lightweight Markdown. Splitting on the bold markers instead
 * of injecting HTML keeps customer-facing text safe: a product name containing
 * `<script>` stays text, never markup.
 */
const renderInline = (text: string): ReactNode[] =>
  text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <span key={index}>{part}</span>
      )
    );

/**
 * Turns an AI reply into readable blocks.
 *
 * AI messages arrive with newlines and Markdown-ish bullets (`* name`). The
 * bubble used to render `{content}` directly, so CSS collapsed every newline
 * into a single space — a product list arrived as one wall of text. Each line
 * is its own paragraph here, a leading `* ` becomes a real bullet, and blank
 * lines become breathing room instead of disappearing.
 */
const MessageText = ({ text }: { text: string }) => {
  const lines = text.split(/\r?\n/);

  return (
    <div className="space-y-1.5">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-1" aria-hidden />;

        const isBullet = /^\*\s+/.test(trimmed);
        const content = isBullet ? trimmed.replace(/^\*\s+/, "") : trimmed;

        return (
          <p
            key={index}
            className={isBullet ? "flex items-start gap-2" : undefined}
          >
            {isBullet && (
              <span
                aria-hidden
                className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-current opacity-60"
              />
            )}
            <span className="min-w-0 break-words">{renderInline(content)}</span>
          </p>
        );
      })}
    </div>
  );
};

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
 * Supports text, image attachments, audio attachments and product carousels.
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
  const carouselCards =
    message.mediaType === "carousel" ? parseProductCards(message.mediaUrl) : [];
  // A card tap reaches the brain as `[ORDER_CARD:<productId>] <button title>`.
  // The marker is what the AI needs; the merchant only needs the title.
  const displayContent = isUser
    ? message.content.replace(/\[ORDER_CARD:[^\]]*\]\s*/g, "").trim()
    : message.content;
  const shouldRenderText =
    !!displayContent && !(!!imagePreviewUrl && contentIsPureMediaUrl);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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
                  onClick={() => setLightboxUrl(imagePreviewUrl)}
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
              <MessageText text={displayContent} />
            </div>
          )}
          {/* ── Product Carousel ── */}
          {carouselCards.length > 0 && (
            <ProductCardStrip cards={carouselCards} onOpenImage={setLightboxUrl} />
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
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setLightboxUrl(null)}
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
                src={lightboxUrl}
                alt="Full size"
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
              />
              <button
                onClick={() => setLightboxUrl(null)}
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
