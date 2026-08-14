"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  RefreshCcw,
  Sparkles,
  Paperclip,
  Mic,
  X,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChatBubble, TypingIndicator, type ChatMessage } from "./chat-bubble";
import { cn } from "@/lib/utils";

interface ChatPreviewProps {
  bot?: any;
  messages: ChatMessage[];
  input: string;
  sending: boolean;
  onInputChange: (val: string) => void;
  onSend: (customMessage?: string, attachments?: any[]) => void;
  onReset: () => void;
  onClose?: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

/** Pre-set sample chips shown when chat is empty */
const QUICK_TEST_CHIPS = [
  { label: "👋 Hello! What can you do?", text: "Hello! What can you do?" },
  { label: "🛍️ Show products & prices", text: "Show me your products and prices." },
  { label: "🚚 Delivery charge & rules", text: "What is your delivery charge and rules?" },
  { label: "📞 Human support contact", text: "How can I talk to human support?" },
];

export const ChatPreview = ({
  bot,
  messages,
  input,
  sending,
  onInputChange,
  onSend,
  onReset,
  onClose,
  messagesEndRef,
}: ChatPreviewProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const botName = bot?.name || "AI Assistant";
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

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="border border-border rounded-3xl flex flex-col flex-1 min-h-0 shadow-2xl overflow-hidden bg-card/60 backdrop-blur-md">
        {/* ─── Dynamic Header Branding ─────────────────────────────── */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              {botAvatar ? (
                <img
                  src={botAvatar}
                  alt={botName}
                  className="w-8 h-8 rounded-full object-cover border border-border/80 shadow-xs"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-white font-bold text-xs shadow-xs">
                  {botName ? (
                    botName.charAt(0).toUpperCase()
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                </div>
              )}
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-card rounded-full" />
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[14px] font-bold leading-tight text-foreground truncate">
                {botName}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-500/20 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Reset Chat History Button */}
            <TooltipProvider delay={100}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      onClick={onReset}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 cursor-pointer"
                    >
                      <RefreshCcw className="w-4 h-4" />
                    </Button>
                  }
                />
                <TooltipContent side="bottom" className="text-xs">
                  Clear chat history & reset memory
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
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
                title="Close chat preview"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* ─── Messages History Body ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-3 scrollbar-thin">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-3.5">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary animate-pulse">
                <Sparkles className="w-6 h-6" />
              </div>

              {/* Dynamic Training & Knowledge Context Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-semibold shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  📚 Trained on {sourcesCount} Source{sourcesCount !== 1 ? "s" : ""} • Active Prompt
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">Start a conversation</h3>
                <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">
                  This AI Agent is currently using your uploaded knowledge sources, business data, and system prompt to generate responses.
                </p>
              </div>

              {/* Quick Test Chips */}
              <div className="w-full space-y-2 pt-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  ⚡ Quick Test Prompts
                </p>
                <div className="flex flex-col gap-1.5">
                  {QUICK_TEST_CHIPS.map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSend(chip.text)}
                      className="text-left text-xs font-medium px-3.5 py-2 rounded-xl bg-card border border-border/70 text-foreground hover:bg-primary/10 hover:border-primary/40 transition-all cursor-pointer shadow-2xs hover:scale-[1.01]"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {messages.map((m, i) => (
                <ChatBubble key={i} message={m} botAvatar={botAvatar} botName={botName} />
              ))}
              {sending && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ─── Bottom Input Bar ──────────────────────────────────── */}
        <div className="shrink-0 p-3 bg-card border-t border-border space-y-2">
          {/* Image Thumbnail & File Previews (Before Sending) */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 px-1 pt-1">
              {attachedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="relative group border border-border rounded-xl bg-muted/50 p-1 shadow-2xs shrink-0"
                >
                  {file.type === "image" ? (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-border/80">
                      <img
                        src={file.url}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center text-primary p-1">
                      <FileText className="w-5 h-5" />
                      <span className="text-[9px] truncate max-w-full font-bold">DOC</span>
                    </div>
                  )}

                  {/* Remove Button */}
                  <button
                    onClick={() => removeAttachment(idx)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center shadow-md hover:scale-110 transition-transform cursor-pointer"
                    title="Remove attachment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Box Wrapper */}
          <div className="flex items-end gap-2 bg-muted/50 dark:bg-muted/30 border border-border rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-violet-500/30 transition-all">
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,.pdf,.doc,.docx,.txt"
              className="hidden"
            />

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
                      className="h-9 w-9 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                  }
                />
                <TooltipContent side="top" className="text-xs">
                  Attach image or document
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
                        "h-9 w-9 rounded-xl transition-colors shrink-0",
                        isRecording
                          ? "bg-destructive/10 text-destructive animate-pulse"
                          : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                      )}
                    >
                      <Mic className="w-4 h-4" />
                    </Button>
                  }
                />
                <TooltipContent side="top" className="text-xs">
                  {isRecording ? "Stop voice input" : "Voice input simulator"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

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
              placeholder={isRecording ? "Listening..." : "Type a message..."}
              rows={1}
              className="flex-1 bg-transparent border-none text-[14px] text-foreground focus:outline-none focus:ring-0 outline-none resize-none min-h-[38px] max-h-[100px] overflow-y-auto py-2 px-2.5 placeholder:text-muted-foreground/60 leading-relaxed break-words whitespace-pre-wrap"
            />

            {/* Send Button */}
            <Button
              type="button"
              onClick={handleSendWrapper}
              disabled={sending || (!input.trim() && attachedFiles.length === 0)}
              className="h-9 w-9 p-0 rounded-xl bg-brand-gradient text-white shadow-sm hover:opacity-90 transition-all shrink-0 disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
