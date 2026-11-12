"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * What can travel with a message.
 *
 * Given its own name instead of being inlined into `ChatMessage` because the tester's
 * input bar collects attachments (`ChatPreview`), sends them (`TesterProvider`) and
 * draws them back (`ChatBubble`) — three places need the same shape, so it gets one home.
 */
export interface ChatAttachment {
  type: "image" | "file";
  url: string;
  name?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  attachments?: ChatAttachment[];
}

interface ChatBubbleProps {
  message: ChatMessage;
  botAvatar?: string;
  botName?: string;
  /**
   * Whether this is the last message of its group.
   *
   * In Messenger, several messages from the same side sit as a **cluster**: the avatar
   * only on the last one, tighter spacing, and a slightly less round corner on the tail
   * side. Those three details are exactly what make a long conversation read as
   * "Messenger" — without them every message dangles like its own island.
   */
  isLastInGroup?: boolean;
}

/**
 * A single chat bubble.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The colours (`--messenger-bubble`, `--messenger-incoming`) are tokens, not
 * hardcoded. They are still not our theme's violet, because the colour here is not
 * our brand — it is **Messenger's identity**, and the merchant expects the exact
 * shape they already know on their own site. `FloatingBubbles`' WhatsApp green is the
 * same exception, made earlier.
 */
export const ChatBubble = ({
  message,
  botAvatar,
  botName,
  isLastInGroup = true,
}: ChatBubbleProps) => {
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const isUser = message.role === "user";
  const displayTime =
    message.timestamp ||
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        className={cn(
          "flex items-end gap-2",
          isLastInGroup ? "mb-2.5" : "mb-0.5",
          isUser ? "justify-end flex-row-reverse" : "justify-start"
        )}
      >
        {/* ⚠️ No avatar for our own messages — Messenger does not show one next to
            them either. The bot's is missing too on everything but the last message of
            a group; a spacer of the same width takes its place so the messages inside a
            group still line up in one column. */}
        {!isUser &&
          (isLastInGroup ? (
            // `mb-5` — the avatar sits on the bubble's bottom edge, not on the timestamp
            // line below it (the gap is roughly the height of that timestamp).
            <BotAvatar avatar={botAvatar} name={botName} className="mb-5" />
          ) : (
            <span aria-hidden className="w-7 shrink-0" />
          ))}

        <div className={cn("flex max-w-[80%] flex-col", isUser ? "items-end" : "items-start")}>
          {/* Attachments rendering */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {message.attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="group/img relative overflow-hidden rounded-2xl border border-border bg-card shadow-xs"
                >
                  {att.type === "image" ? (
                    <div
                      className="relative cursor-pointer overflow-hidden rounded-2xl"
                      onClick={() => setLightboxImg(att.url)}
                      title="Click to view full image"
                    >
                      <img
                        src={att.url}
                        alt={att.name || "Uploaded image"}
                        className="max-h-48 w-full max-w-[240px] object-cover transition-transform duration-200 hover:scale-105"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/15">
                        <span className="rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white opacity-0 backdrop-blur-xs transition-opacity group-hover/img:opacity-100">
                          🔍 View
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-foreground">
                      <FileText className="h-4 w-4 shrink-0 text-messenger-bubble" />
                      <span className="max-w-[160px] truncate">{att.name || "Attached File"}</span>
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
                "rounded-[18px] px-3.5 py-2 text-[14px] leading-[1.45] break-words whitespace-pre-wrap transition-all",
                isUser
                  ? "bg-messenger-bubble text-messenger-bubble-foreground"
                  : "bg-messenger-incoming text-messenger-incoming-foreground",
                // The tail corner belongs to the last message of a group only — it is
                // what tells the eye which way the conversation is flowing.
                isLastInGroup && (isUser ? "rounded-br-[4px]" : "rounded-bl-[4px]")
              )}
            >
              {message.content}
            </div>
          )}

          {/* Timestamp — always visible, because while testing it is useful to know how
              long a reply took; Messenger only shows it here and there. */}
          <span className="mt-1 px-1 text-[10px] font-medium text-muted-foreground/80">
            {displayTime}
          </span>
        </div>
      </motion.div>

      {/* Lightbox Modal for Image Preview */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in-0 duration-200"
          onClick={() => setLightboxImg(null)}
        >
          <div
            className="relative max-h-[85vh] max-w-3xl overflow-hidden rounded-2xl border border-border bg-card p-1 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImg}
              alt="Preview"
              className="max-h-[80vh] w-auto rounded-xl object-contain"
            />
            <button
              onClick={() => setLightboxImg(null)}
              className="absolute top-3 right-3 cursor-pointer rounded-full bg-black/60 p-1.5 text-white shadow-md transition-colors hover:bg-black/80"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

/** The bot's avatar — falls back to the first letter of its name, then to a sparkle.
 *
 *  ⚠️ The gap below it (`mb-5`, not inlined here) arrives as a class from the call
 *     site: how much space is right depends on what sits beside it. In the thread the
 *     bubble has a timestamp underneath it; in the typing indicator it does not.
 *     Baked in here, the avatar would hang 20px above the dot bubble. */
function BotAvatar({
  avatar,
  name,
  className,
}: {
  avatar?: string;
  name?: string;
  className?: string;
}) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name || "AI Assistant"}
        className={cn("h-7 w-7 shrink-0 rounded-full object-cover shadow-xs", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white shadow-xs",
        className
      )}
    >
      {name ? name.charAt(0).toUpperCase() : <Sparkles className="h-3.5 w-3.5" />}
    </div>
  );
}

/**
 * The bot is typing — three bobbing dots.
 *
 * The bubble is the same colour as an incoming message and the avatar is the bot's
 * own; otherwise "someone is typing" would read as a separate component rather than
 * as the bot's next reply.
 */
export const TypingIndicator = ({ botAvatar, botName }: { botAvatar?: string; botName?: string }) => (
  <div className="mb-2.5 flex items-end gap-2">
    <BotAvatar avatar={botAvatar} name={botName} />
    <div className="flex h-[34px] items-center gap-1.5 rounded-[18px] rounded-bl-[4px] bg-messenger-incoming px-3.5">
      {[0, 0.2, 0.4].map((delay) => (
        <motion.div
          key={delay}
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 0.8, delay }}
          className="h-1.5 w-1.5 rounded-full bg-messenger-incoming-foreground/50"
        />
      ))}
    </div>
  </div>
);
