"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Images, Music, X, ZoomIn } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
}

interface SharedMediaAccordionProps {
  /** Full list of messages for the active session */
  messages: Message[];
}

// ── Lightbox ───────────────────────────────────────────────────────────────────
function Lightbox({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
        onClick={onClose}
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
            src={src}
            alt="Full size preview"
            className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
          />
          <button
            onClick={onClose}
            className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-card border border-border/60 flex items-center justify-center text-foreground hover:bg-muted transition-colors shadow-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
/**
 * SharedMediaAccordion
 *
 * Collapsible section displayed in the CRM right sidebar.
 * Filters all messages with media attachments (images + audio)
 * and renders:
 *   - Images: 3-column thumbnail grid with click-to-lightbox
 *   - Audio: row list with native audio player
 *
 * @param messages - Full message array from the active session.
 */
export function SharedMediaAccordion({ messages }: SharedMediaAccordionProps) {
  const [open, setOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Filter messages that have valid media attachments
  const mediaMessages = useMemo(
    () =>
      messages.filter(
        (m) => m.mediaUrl && m.mediaType && (m.mediaType === "image" || m.mediaType === "audio")
      ),
    [messages]
  );

  const imageMessages = useMemo(
    () => mediaMessages.filter((m) => m.mediaType === "image"),
    [mediaMessages]
  );
  const audioMessages = useMemo(
    () => mediaMessages.filter((m) => m.mediaType === "audio"),
    [mediaMessages]
  );

  const totalCount = mediaMessages.length;

  return (
    <>
      {/* ── Accordion Container ── */}
      <div className="border border-border/50 rounded-xl overflow-hidden bg-card">
        {/* Header / Toggle */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-muted/40 transition-colors select-none cursor-pointer text-left"
        >
          <div className="flex items-center gap-2">
            <Images className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-[12.5px] font-semibold text-foreground">
              Shared Media
            </span>
            {totalCount > 0 && (
              <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-semibold border border-primary/20">
                {totalCount}
              </span>
            )}
          </div>
          {open ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
        </button>

        {/* Collapsible Content */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3.5 py-3 border-t border-border/40 bg-card/40 space-y-3">
                {totalCount === 0 ? (
                  /* Empty state */
                  <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground/60">
                    <Images className="w-7 h-7 opacity-25" />
                    <p className="text-[11.5px] text-center italic">
                      No shared media yet.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* ── Image Grid ── */}
                    {imageMessages.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                          Images ({imageMessages.length})
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {imageMessages.map((msg) => (
                            <button
                              key={msg.id}
                              onClick={() => setLightboxSrc(msg.mediaUrl!)}
                              className="relative aspect-square rounded-lg overflow-hidden group cursor-zoom-in border border-border/40 hover:border-primary/50 transition-colors shadow-xs"
                              title="Click to view full size"
                            >
                              <img
                                src={msg.mediaUrl!}
                                alt="Shared"
                                className="w-full h-full object-cover"
                              />
                              {/* Hover overlay */}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                                <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Audio List ── */}
                    {audioMessages.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                          Audio ({audioMessages.length})
                        </p>
                        <div className="space-y-2">
                          {audioMessages.map((msg, idx) => (
                            <div
                              key={msg.id}
                              className="flex items-center gap-2 p-2 rounded-xl bg-violet-500/5 border border-violet-500/15"
                            >
                              <Music className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-muted-foreground mb-1">
                                  Audio {idx + 1} ·{" "}
                                  <span className="font-mono">
                                    {new Date(msg.timestamp).toLocaleDateString("en-GB")}
                                  </span>
                                </p>
                                <audio
                                  controls
                                  src={msg.mediaUrl!}
                                  className="w-full h-7"
                                  style={{ colorScheme: "light dark" }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Lightbox ── */}
      {lightboxSrc && (
        <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </>
  );
}
