"use client";

import { useRef, useState } from "react";
import { Loader2, Copy, Check, Sparkles, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getModelKey, type UiChatModelConfig, type UiProviderName } from "@/components/chatbots/use-openrouter-models";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/core/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CompareChatMessage } from "./compare-types";

interface ComparePanelProps {
  /** "a" or "b" */
  panelKey: "a" | "b";
  /** current model value: "provider|model" */
  value: string;
  onValueChange: (v: string) => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversation: CompareChatMessage[];
  busy: boolean;
  loadingMessages: boolean;
  copiedIndex: number | null;
  onCopy: (text: string, index: number) => void;
  models: UiChatModelConfig[];
  groupedModels: Record<UiProviderName, UiChatModelConfig[]>;
  loadingModels: boolean;
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export const ComparePanel = ({
  panelKey,
  value,
  onValueChange,
  open,
  onOpenChange,
  conversation,
  busy,
  loadingMessages,
  copiedIndex,
  onCopy,
  models,
  groupedModels,
  loadingModels,
}: ComparePanelProps) => {
  const { t } = useTranslation("chatbots");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const selectedModel = models.find((m) => getModelKey(m) === value);

  const filteredGrouped = Object.entries(groupedModels).reduce((acc, [group, groupModels]) => {
    const filtered = groupModels.filter((m) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        m.label.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q) ||
        m.providerName.toLowerCase().includes(q) ||
        (m.note && m.note.toLowerCase().includes(q))
      );
    });
    if (filtered.length > 0) {
      acc[group] = filtered;
    }
    return acc;
  }, {} as Record<string, typeof models>);

  return (
    <div
      className="flex flex-col rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm p-5 shadow-sm relative overflow-visible transition-all hover:border-primary/20"
      data-testid={`compare-panel-${panelKey}`}
    >
      {/* Model Selector */}
      <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-3 z-20 gap-2 shrink-0">
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full max-w-[85%] h-12 justify-between rounded-xl border-border bg-background px-4 py-3 font-normal hover:bg-background hover:border-primary/50 transition-all shadow-sm overflow-hidden"
              data-testid={`compare-select-${panelKey}`}
            >
              {selectedModel ? (
                <div className="flex flex-col items-start gap-0 truncate text-left w-full">
                  <span className="font-semibold text-sm truncate w-full">{selectedModel.label}</span>
                  {selectedModel.note && (
                    <span className="text-[10px] text-muted-foreground line-clamp-1 truncate w-full">
                      {selectedModel.note}
                    </span>
                  )}
                </div>
              ) : (
                loadingModels ? "Loading live models..." : "Select a model..."
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl shadow-2xl border-border/50 backdrop-blur-md overflow-hidden z-30"
            align="start"
            side="bottom"
            sideOffset={8}
            avoidCollisions={true}
          >
            <Command shouldFilter={false} className="bg-transparent">
              <CommandInput value={searchQuery} onValueChange={setSearchQuery} placeholder="Search AI model..." className="h-12" />
              <CommandList className="max-h-[280px] overflow-y-auto p-1">
                <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                  No model found.
                </CommandEmpty>
                {Object.entries(filteredGrouped).map(([group, models]) => (
                  <CommandGroup key={group} heading={group} className="px-2">
                    {models.map((m) => {
                      const modelKey = getModelKey(m);
                      const isSelected = value === modelKey;
                      return (
                        <CommandItem
                          key={modelKey}
                          value={modelKey + " " + m.label + " " + (m.note || "")}
                          onSelect={() => {
                            onValueChange(modelKey);
                            onOpenChange(false);
                          }}
                          className={cn(
                            "flex items-center justify-between px-3 py-2.5 rounded-lg my-1 cursor-pointer transition-all border border-transparent",
                            isSelected
                              ? "!bg-primary !text-white shadow-md"
                              : "bg-secondary/40 hover:bg-secondary !text-foreground border-border/40"
                          )}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className={cn("text-sm font-semibold", isSelected ? "!text-white" : "!text-foreground")}>
                              {m.label}
                            </span>
                            {m.note && (
                              <span className={cn("text-[10px] line-clamp-1", isSelected ? "!text-white/80" : "!text-muted-foreground")}>
                                {m.note}
                              </span>
                            )}
                          </div>
                          {isSelected && <Check className="h-4 w-4 !text-white" />}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Chat Scroll Area */}
      <div className="flex-1 h-[400px] overflow-y-auto p-2 space-y-4 scrollbar-thin rounded-xl bg-secondary/15 border border-border/40 min-h-[400px]">
        {loadingMessages ? (
          <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground gap-2 py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span>Loading conversation history...</span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {conversation.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground/60 text-sm italic py-20">
                <Sparkles className="w-5 h-5 mb-2 text-primary/40" />
                {t("compare.response_placeholder", "Response will appear here…")}
              </div>
            ) : (
              conversation.map((msg, idx) => {
                const isUser = msg.role === "user";
                const content = panelKey === "a" ? msg.contentA : msg.contentB;
                const modelLabel = panelKey === "a" ? msg.modelA : msg.modelB;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={cn("flex flex-col", isUser ? "items-end" : "items-start")}
                  >
                    <div className="text-[10px] text-muted-foreground mb-1 px-1 font-medium">
                      {formatTime(msg.timestamp)}
                    </div>
                    <div className="relative group max-w-[85%]">
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-3 text-[14.5px] leading-relaxed shadow-sm break-words whitespace-pre-wrap",
                          isUser
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-card text-foreground rounded-bl-sm border border-border"
                        )}
                      >
                        {!isUser && (
                          <div className="text-[10px] font-bold text-primary mb-1 border-b border-border/30 pb-0.5 uppercase tracking-wider">
                            {modelLabel}
                          </div>
                        )}
                        {content}
                      </div>
                      {!isUser && content && (
                        <button
                          onClick={() => onCopy(content, idx)}
                          className="absolute -top-2.5 -right-2.5 p-1.5 bg-background hover:bg-secondary border border-border text-muted-foreground hover:text-foreground rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-sm z-10"
                          title="Copy Response"
                        >
                          {copiedIndex === idx ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        )}

        {/* Generating indicator */}
        {busy && (
          <div className="flex flex-col items-start">
            <span className="text-[10px] text-muted-foreground mb-1 px-1 font-medium">
              {formatTime(new Date())}
            </span>
            <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 flex items-center gap-2 shadow-sm text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="animate-pulse">Generating response...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>
    </div>
  );
};
