"use client";

import { Send, RefreshCcw, Sparkles, Camera, Image as ImageIcon, Mic, PlusCircle, Phone, Info, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatBubble, TypingIndicator } from "./chat-bubble";

interface ChatPreviewProps {
  messages: any[];
  input: string;
  sending: boolean;
  onInputChange: (val: string) => void;
  onSend: () => void;
  onReset: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

const PRESET_PROMPTS = [
  { title: "Price Query", prompt: "How much is the pro plan?" },
  { title: "Service List", prompt: "What services do you offer?" },
  { title: "Return Policy", prompt: "What is your refund policy?" },
  { title: "Working Hours", prompt: "When are you open?" },
  { title: "Order Tracking", prompt: "How can I track my order?" },
  { title: "Discount Code", prompt: "Do you have any discount codes?" },
];

export const ChatPreview = ({
  messages,
  input,
  sending,
  onInputChange,
  onSend,
  onReset,
  messagesEndRef,
}: ChatPreviewProps) => {
  return (
    <div className="flex flex-col h-[600px] sticky top-24 bg-background">
      <div className="border border-border rounded-3xl flex flex-col flex-1 shadow-2xl overflow-hidden bg-card/30 backdrop-blur-sm">
        {/* Messenger Style Header */}
        <div className="px-3 py-3 border-b border-border flex items-center justify-between bg-card/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-secondary rounded-full text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-violet-400 flex items-center justify-center text-white shadow-inner">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-card rounded-full" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-bold leading-tight">AI Assistant</span>
              <span className="text-[11px] text-muted-foreground font-medium">Active now</span>
            </div>
          </div>
          <div className="flex items-center gap-1 pr-1">
            <button className="p-2 hover:bg-secondary rounded-full text-primary transition-colors">
              <Phone className="w-5 h-5 fill-primary/10" />
            </button>
            <button className="p-2 hover:bg-secondary rounded-full text-primary transition-colors">
              <Info className="w-5 h-5 fill-primary/10" />
            </button>
            <button 
              onClick={onReset}
              className="p-2 hover:bg-secondary rounded-full text-muted-foreground transition-colors ml-1"
              title="Reset Chat"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2 scrollbar-thin">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center animate-bounce">
                <Send className="w-8 h-8 text-primary opacity-60" />
              </div>
              <div className="space-y-2 max-w-[200px]">
                <p className="text-base font-bold">Start a conversation</p>
                <p className="text-xs text-muted-foreground leading-relaxed">Test how your bot responds to different customer queries.</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center pt-2">
                {PRESET_PROMPTS.map((p) => (
                  <Button 
                    key={p.title} variant="secondary" size="sm" 
                    className="text-[11px] h-8 px-3 rounded-full hover:bg-primary hover:text-white transition-all shadow-sm border-none"
                    onClick={() => onInputChange(p.prompt)}
                  >
                    {p.title}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {messages.map((m, i) => (
                <ChatBubble key={i} message={m} />
              ))}
              {sending && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Messenger Style Input Area */}
        <div className="p-3 bg-card/80 backdrop-blur-md border-t border-border">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative group">
              <input
                type="text"
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSend()}
                placeholder="Message"
                className="w-full bg-secondary/70 border-none rounded-[20px] px-5 py-2.5 text-[15px] focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60 shadow-inner"
              />
            </div>

            <button
              onClick={onSend}
              disabled={sending || !input.trim()}
              className="p-2.5 text-primary rounded-full disabled:opacity-30 transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
            >
              <Send className="w-6 h-6 fill-current" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
