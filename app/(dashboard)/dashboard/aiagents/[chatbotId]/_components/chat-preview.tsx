"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Send,
  ThumbsUp,
  RefreshCcw,
  Sparkles,
  Paperclip,
  Mic,
  X,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChatBubble, TypingIndicator, type ChatAttachment, type ChatMessage } from "./chat-bubble";
import type { BotRecord } from "../_providers/bot-provider";
import { cn } from "@/lib/utils";

interface ChatPreviewProps {
  bot?: BotRecord | null;
  messages: ChatMessage[];
  input: string;
  sending: boolean;
  onInputChange: (val: string) => void;
  onSend: (customMessage?: string, attachments?: ChatAttachment[]) => void;
  onReset: () => void;
  onClose?: () => void;
}

/** Sample openers shown before the first message.
 *
 *  `labelKey` is translated, but `text` — what is actually sent to the bot — stays
 *  in English on purpose. It is test data, not UI copy: translating it would mean a
 *  Bengali merchant tests with different questions than an English one. */
const QUICK_TEST_CHIPS = [
  { labelKey: "chat_test.preview.chips.hello", fallback: "👋 Hello! What can you do?", text: "Hello! What can you do?" },
  { labelKey: "chat_test.preview.chips.products", fallback: "🛍️ Show products & prices", text: "Show me your products and prices." },
  { labelKey: "chat_test.preview.chips.delivery", fallback: "🚚 Delivery charge & rules", text: "What is your delivery charge and rules?" },
  { labelKey: "chat_test.preview.chips.support", fallback: "📞 Human support contact", text: "How can I talk to human support?" },
];

/**
 * Everything inside the widget — header, thread and composer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ No outer frame here (border / radius / shadow) — only a flat surface. The
 *    same widget is hosted twice: large on the Playground page and small in the
 *    floating corner panel. The frame belongs to those hosts (so do the sizes);
 *    drawing it here would stack two borders on top of each other.
 *
 * ⚠️ The look is deliberately a **Messenger inbox**: blue outgoing bubbles on the
 *    right, light grey incoming ones on the left, a header with the page name and
 *    "Active now", and one round composer at the bottom. The merchant already knows
 *    that shape from their own Facebook page, so the preview should show exactly
 *    what their customers will see.
 */
export const ChatPreview = ({
  bot,
  messages,
  input,
  sending,
  onInputChange,
  onSend,
  onReset,
  onClose,
}: ChatPreviewProps) => {
  const { t } = useTranslation("chatbots");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The message list's scroll container. Scrolling lives inside the tester because
  // it is the tester's own behaviour — callers should not have to hand it a ref.
  const scrollRef = useRef<HTMLDivElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<
    Array<{ type: "image" | "file"; url: string; name: string }>
  >([]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
    }
  }, [input]);

  /**
   * Keeps the newest message (or the typing indicator) in view.
   *
   * ⚠️ This used to be `scrollIntoView`, which was the reason scrolling felt
   *    broken: `scrollIntoView` walks up and moves **every** scrollable ancestor,
   *    so a new message also nudged the outer `main` and threw away whatever
   *    position the user had scrolled to. `scrollTo` moves only this box.
   */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // Handle File Upload Select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const isImage = file.type.startsWith("image/");
    const fileObj = {
      type: isImage ? ("image" as const) : ("file" as const),
      url: URL.createObjectURL(file),
      name: file.name,
    };

    setAttachedFiles((prev) => [...prev, fileObj]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendWrapper = () => {
    if ((!input.trim() && attachedFiles.length === 0) || sending) return;
    onSend(input, attachedFiles.length > 0 ? attachedFiles : undefined);
    setAttachedFiles([]);
  };

  // Dynamic Bot Branding & Training Context
  const botName = bot?.name || t("chat_test.preview.ai_assistant", "AI Assistant");
  const botAvatar =
    bot?.avatarBase64 ||
    bot?.avatarUrl ||
    bot?.logoUrl ||
    bot?.logo ||
    bot?.avatar ||
    bot?.image;

  const sourcesCount =
    bot?._count?.sources ??
    bot?._count?.knowledgeBases ??
    bot?.sources?.length ??
    bot?.knowledgeBases?.length ??
    bot?.sourceCount ??
    0;

  const canSend = !sending && (input.trim().length > 0 || attachedFiles.length > 0);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-messenger-canvas">
      {/* ─── Header ──────────────────────────────────────────────── */}
      {/* Messenger's header: avatar, name, and a small status line under it —
          no big badge or coloured chip. */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border/70 px-4 py-2.5">
        <div className="relative shrink-0">
          {botAvatar ? (
            <img
              src={botAvatar}
              alt={botName}
              className="h-9 w-9 rounded-full border border-border/60 object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">
              {botName ? botName.charAt(0).toUpperCase() : <Sparkles className="h-4 w-4" />}
            </div>
          )}
          <span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-messenger-canvas bg-success" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-tight font-semibold text-foreground">
            {botName}
          </p>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">
            {t("chat_test.preview.active_now", "Active now")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Reset Chat History Button */}
          <TooltipProvider delay={100}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    onClick={onReset}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 cursor-pointer rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <RefreshCcw className="w-4 h-4" />
                  </Button>
                }
              />
              <TooltipContent side="bottom" className="text-xs">
                {t("chat_test.preview.reset_tooltip", "Clear chat history & reset memory")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Close Button (When rendered in floating widget modal) */}
          {onClose && (
            <Button
              type="button"
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 cursor-pointer rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={t("chat_test.preview.close", "Close chat preview")}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </header>

      {/* ─── Messages History Body ───────────────────────────────── */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        {messages.length === 0 ? (
          /**
           * Welcome screen — the same shape a Facebook page shows before the first
           * message: round page picture, page name, one small grey line under it,
           * and the openers as Messenger quick replies.
           *
           * ⚠️ This replaced a big card (icon tile + blue "trained" pill + heading +
           *    paragraph + full-width bordered buttons). That card was the dashboard's
           *    own visual language, not Messenger's — a merchant looking at it could
           *    not tell what their customers would actually see. Nothing here is a
           *    message bubble on purpose: we must not fake a reply the bot never sent.
           */
          <div className="flex min-h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex flex-col items-center gap-2">
              {botAvatar ? (
                <img
                  src={botAvatar}
                  alt={botName}
                  className="h-16 w-16 rounded-full border border-border/60 object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-gradient text-xl font-bold text-white shadow-sm">
                  {botName ? botName.charAt(0).toUpperCase() : <Sparkles className="h-7 w-7" />}
                </div>
              )}

              <p className="text-[17px] leading-tight font-semibold text-foreground">
                {botName}
              </p>

              {/* The status line sits where Messenger puts "Typically replies
                  within an hour" — plain grey, no pill, no dot. */}
              <p className="text-[11px] leading-tight text-muted-foreground">
                {t("chat_test.preview.trained", {
                  count: sourcesCount,
                  defaultValue: "📚 Trained on {{count}} Sources • Active Prompt",
                })}
              </p>
            </div>

            {/* Quick replies — Messenger draws these as outlined pills with the label
                in the accent colour, and puts no heading above them, so neither do we. */}
            <div className="flex w-full flex-wrap justify-center gap-1.5 pt-1">
              {QUICK_TEST_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSend(chip.text)}
                  className="cursor-pointer rounded-full border border-messenger-bubble/40 px-3 py-1.5 text-[12px] font-medium text-messenger-bubble transition-colors hover:bg-messenger-bubble/10"
                >
                  {t(chip.labelKey, chip.fallback)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {messages.map((m, i) => (
              <ChatBubble
                key={i}
                message={m}
                botAvatar={botAvatar}
                botName={botName}
                // Not the last of its group when the next message is from the same side.
                isLastInGroup={messages[i + 1]?.role !== m.role}
              />
            ))}
            {sending && <TypingIndicator botAvatar={botAvatar} botName={botName} />}
          </div>
        )}
      </div>

      {/* ─── Composer ────────────────────────────────────────────── */}
      <div className="shrink-0 space-y-2 border-t border-border/70 bg-messenger-canvas px-3 py-2.5">
        {/* Image Thumbnail & File Previews (Before Sending) */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1 pt-1">
            {attachedFiles.map((file, idx) => (
              <div
                key={idx}
                className="group relative shrink-0 rounded-xl border border-border bg-muted/50 p-1 shadow-2xs"
              >
                {file.type === "image" ? (
                  <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-border/80">
                    <img src={file.url} alt={file.name} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-messenger-bubble/10 p-1 text-messenger-bubble">
                    <FileText className="w-5 h-5" />
                    <span className="max-w-full truncate text-[9px] font-bold">DOC</span>
                  </div>
                )}

                {/* Remove Button */}
                <button
                  onClick={() => removeAttachment(idx)}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-destructive text-white shadow-md transition-transform hover:scale-110"
                  title="Remove attachment"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Messenger's composer: one soft grey pill holding the text, and the
            actions as separate round buttons to its right — not tucked inside the
            pill, which is what made it read as a generic chat box before. */}
        <div className="flex items-end gap-1.5">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,.pdf,.doc,.docx,.txt"
            className="hidden"
          />

          <div className="flex flex-1 items-end rounded-[20px] bg-muted/60 px-3.5 py-1.5 transition-colors focus-within:bg-muted dark:bg-muted/40">
            {/* Auto-expanding Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendWrapper();
                }
              }}
              placeholder={isRecording
                ? t("chat_test.preview.listening", "Listening...")
                : t("chat_test.preview.input_placeholder", "Message")}
              rows={1}
              className="max-h-[100px] min-h-[32px] flex-1 resize-none overflow-y-auto break-words whitespace-pre-wrap border-none bg-transparent py-1.5 text-[14px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-0 focus:outline-none"
            />
          </div>

          {/* Attachment Button */}
          <TooltipProvider delay={100}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-9 w-9 shrink-0 cursor-pointer rounded-full text-messenger-bubble transition-colors hover:bg-messenger-bubble/10"
                  >
                    <Paperclip className="w-5 h-5" />
                  </Button>
                }
              />
              <TooltipContent side="top" className="text-xs">
                {t("chat_test.preview.attach", "Attach image or document")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Voice Input Button */}
          <TooltipProvider delay={100}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsRecording((prev) => !prev)}
                    className={cn(
                      "h-9 w-9 shrink-0 cursor-pointer rounded-full transition-colors",
                      isRecording
                        ? "animate-pulse bg-destructive/10 text-destructive"
                        : "text-messenger-bubble hover:bg-messenger-bubble/10"
                    )}
                  >
                    <Mic className="w-5 h-5" />
                  </Button>
                }
              />
              <TooltipContent side="top" className="text-xs">
                {isRecording
                  ? t("chat_test.preview.voice_stop", "Stop voice input")
                  : t("chat_test.preview.voice_start", "Voice input simulator")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Send Button — Messenger swaps the paper plane for a thumbs up while
              the box is empty, which is the single most recognisable detail of it. */}
          <button
            type="button"
            onClick={handleSendWrapper}
            disabled={!canSend}
            aria-label={t("chat_test.preview.send", "Send message")}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all",
              canSend
                ? "cursor-pointer bg-messenger-bubble text-white shadow-sm hover:brightness-110 active:scale-95"
                : "cursor-not-allowed bg-messenger-bubble/25 text-messenger-bubble"
            )}
          >
            {canSend ? <Send className="w-4 h-4" /> : <ThumbsUp className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
