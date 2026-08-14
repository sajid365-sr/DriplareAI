"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, UserRound, ImageIcon, Mic, X, Loader2, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface HumanInputBarProps {
  onSend: (message: string, mediaUrl?: string, mediaType?: "image" | "audio") => Promise<void>;
  isSending?: boolean;
  chatbotId?: string | null;
}

interface MediaPreview {
  url: string;       // Local blob URL for preview
  uploadedUrl: string; // Cloudinary URL after upload
  type: "image" | "audio";
  name: string;
}

/**
 * Manual reply input bar — shown only when AI is paused (isActive = false).
 * Allows a human agent to send text replies, images, or audio attachments.
 */
export function HumanInputBar({ onSend, isSending = false, chatbotId }: HumanInputBarProps) {
  const { t } = useTranslation("live-inbox");
  const [text, setText] = useState("");
  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [text]);

  // Cleanup object URL on unmount or preview change
  useEffect(() => {
    return () => {
      if (mediaPreview?.url) URL.revokeObjectURL(mediaPreview.url);
    };
  }, [mediaPreview?.url]);

  // ── File upload handler ─────────────────────────────────────────────────────
  const handleFileUpload = useCallback(
    async (file: File, type: "image" | "audio") => {
      if (!chatbotId) {
        toast.error("Cannot upload: chatbot context is missing.");
        return;
      }

      // Revoke previous preview URL
      if (mediaPreview?.url) URL.revokeObjectURL(mediaPreview.url);

      const localUrl = URL.createObjectURL(file);
      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`/api/chatbots/${chatbotId}/messages/upload`, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          toast.error(data.error || "Upload failed.");
          URL.revokeObjectURL(localUrl);
          return;
        }

        setMediaPreview({
          url: localUrl,
          uploadedUrl: data.url,
          type: data.mediaType,
          name: file.name,
        });
      } catch {
        toast.error("Upload failed. Please try again.");
        URL.revokeObjectURL(localUrl);
      } finally {
        setIsUploading(false);
      }
    },
    [chatbotId, mediaPreview?.url]
  );

  // ── Send handler ────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = text.trim();
    // Need either text or a media attachment
    if ((!trimmed && !mediaPreview) || isSending || isUploading) return;

    const sendText = trimmed;
    const sendMediaUrl = mediaPreview?.uploadedUrl;
    const sendMediaType = mediaPreview?.type;

    // Clear input immediately (optimistic)
    setText("");
    if (mediaPreview?.url) URL.revokeObjectURL(mediaPreview.url);
    setMediaPreview(null);

    await onSend(sendText, sendMediaUrl, sendMediaType);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const clearMedia = () => {
    if (mediaPreview?.url) URL.revokeObjectURL(mediaPreview.url);
    setMediaPreview(null);
    // Reset file inputs
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (audioInputRef.current) audioInputRef.current.value = "";
  };

  const canSend = (text.trim() || mediaPreview) && !isSending && !isUploading;

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

      {/* ── Media Preview Strip ── */}
      <AnimatePresence>
        {(isUploading || mediaPreview) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 px-3 pt-2.5 pb-1">
              {isUploading ? (
                /* Uploading state */
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  <span className="text-[11.5px] text-primary font-medium">
                    Uploading...
                  </span>
                </div>
              ) : mediaPreview ? (
                /* Preview ready */
                <div className="relative flex items-center gap-2">
                  {mediaPreview.type === "image" ? (
                    /* Image thumbnail */
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border/60 shadow-sm">
                      <img
                        src={mediaPreview.url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    /* Audio preview */
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500/5 border border-violet-500/20">
                      <Play className="w-3.5 h-3.5 text-violet-500 fill-violet-500" />
                      <span className="text-[11px] text-violet-600 dark:text-violet-400 font-medium max-w-[140px] truncate">
                        {mediaPreview.name}
                      </span>
                    </div>
                  )}
                  {/* Remove preview button */}
                  <button
                    onClick={clearMedia}
                    className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive/80 transition-colors"
                    title="Remove attachment"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input Row ── */}
      <div className="flex items-end gap-2 p-3">
        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f, "image");
          }}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f, "audio");
          }}
        />

        {/* Media pickers — only show when chatbotId is available */}
        {chatbotId && (
          <div className="flex items-center gap-1 shrink-0 pb-0.5">
            {/* Image picker */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => imageInputRef.current?.click()}
              disabled={isSending || isUploading}
              title="Attach image (JPEG, PNG, WEBP)"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-violet-500 hover:bg-violet-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ImageIcon className="w-4 h-4" />
            </motion.button>

            {/* Audio picker */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => audioInputRef.current?.click()}
              disabled={isSending || isUploading}
              title="Attach audio (MP3, WAV, M4A)"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-violet-500 hover:bg-violet-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Mic className="w-4 h-4" />
            </motion.button>
          </div>
        )}

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={mediaPreview ? "Add a caption (optional)..." : t("humanInput.placeholder")}
          disabled={isSending}
          rows={1}
          className="flex-1 resize-none bg-muted/50 border border-border/50 rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all disabled:opacity-60 leading-relaxed"
        />

        {/* Send button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSend}
          disabled={!canSend}
          className="shrink-0 w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
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
