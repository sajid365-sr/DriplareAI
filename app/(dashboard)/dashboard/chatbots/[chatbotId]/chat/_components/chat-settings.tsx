"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Save, Loader2, Info, Sparkles, Check, ChevronsUpDown, Search, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CHAT_MODELS } from "@/lib/ai/chat-models";
import { DEMO_PROMPTS } from "@/lib/ai/demo-prompts";
import { toast } from "sonner";
import { cn } from "@/lib/core/utils";
import { resolveLocalStr } from "@/lib/domain/plan-config";
import { useTranslation } from "react-i18next";
import { useConfirm } from "@/hooks/use-confirm";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ChatSettingsProps {
  bot: any;
  userPlan?: string;
  saving: boolean;
  onBotChange: (key: string, val: any) => void;
  onModelSelect: (key: string) => void;
  onSave: () => void;
}

export const ChatSettings = ({ bot, userPlan = "starter", saving, onBotChange, onModelSelect, onSave }: ChatSettingsProps) => {
  const [open, setOpen] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const { i18n } = useTranslation();
  const confirm = useConfirm((state) => state.confirm);
  const { chatbotId } = useParams();

  const handleEnhance = async () => {
    if (!bot.systemPrompt || bot.systemPrompt.trim().length < 10) {
      toast.error("Please write a draft prompt first (at least 10 characters).");
      return;
    }
    
    confirm(
      "Enhance with AI",
      "Are you sure? This will deduct 5 message points from your account to optimize your prompt.",
      async () => {
        setEnhancing(true);
        try {
          const res = await fetch(`/api/chatbots/${chatbotId}/enhance-prompt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ draftPrompt: bot.systemPrompt })
          });
          
          const data = await res.json();
          if (!res.ok) {
            toast.error(data.error || "Failed to enhance prompt");
            return;
          }
          
          onBotChange("systemPrompt", data.enhancedPrompt);
          toast.success("Prompt enhanced successfully! 5 points deducted.");
        } catch (error) {
          toast.error("An error occurred while enhancing.");
        } finally {
          setEnhancing(false);
        }
      }
    );
  };

  const currentModelKey = `${bot.provider}|${bot.model}`;
  const selectedModel = CHAT_MODELS.find(m => `${m.provider}|${m.model}` === currentModelKey);

  // Grouping logic
  const groupedModels = CHAT_MODELS.reduce((acc, m) => {
    let group = "Other Models";
    const modelPath = m.model.toLowerCase();
    if (modelPath.includes("gemini") || modelPath.includes("google")) group = "Google Gemini";
    else if (modelPath.includes("gpt") || modelPath.includes("openai")) group = "OpenAI (GPT)";
    else if (modelPath.includes("claude") || modelPath.includes("anthropic")) group = "Anthropic (Claude)";
    else if (modelPath.includes("llama") || modelPath.includes("meta")) group = "Meta (Llama)";
    else if (modelPath.includes("deepseek")) group = "DeepSeek";
    else if (modelPath.includes("qwen")) group = "Alibaba (Qwen)";
    else if (modelPath.includes("mistral")) group = "Mistral AI";
    
    if (!acc[group]) acc[group] = [];
    acc[group].push(m);
    return acc;
  }, {} as Record<string, typeof CHAT_MODELS>);

  return (
    <div className="lg:col-span-2 space-y-6">
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Bot Configuration</h2>
            <p className="text-xs text-muted-foreground">Define how your AI assistant behaves and which model it uses.</p>
          </div>
          <Button onClick={onSave} disabled={saving} size="sm" className="gap-1.5 px-4 shadow-md transition-all hover:scale-105">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Changes
          </Button>
        </div>

        <div className="space-y-8">
          {/* Model Selection (Searchable Combobox) */}
          <div className="space-y-3">
            <label className="text-sm font-semibold flex items-center gap-2">
              AI Brain (Model)
              <span className="text-[10px] font-normal bg-primary/10 text-primary px-1.5 py-0.5 rounded">Recommended: Gemini 1.5 Flash</span>
            </label>
            
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full h-12 justify-between rounded-xl border-border bg-background px-4 py-3 font-normal hover:bg-background hover:border-primary/50 transition-all shadow-sm"
                >
                  {selectedModel ? (
                    <div className="flex flex-col items-start gap-0">
                      <span className="font-semibold text-sm truncate">{selectedModel.label}</span>
                      {selectedModel.note && <span className="text-[10px] text-muted-foreground line-clamp-1">{selectedModel.note}</span>}
                    </div>
                  ) : (
                    "Select a model..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl shadow-2xl border-border/50 backdrop-blur-md overflow-hidden" 
                align="start"
                side="bottom"
                sideOffset={8}
                avoidCollisions={false}
              >
                <Command className="bg-transparent">
                  <CommandInput placeholder="Search AI model..." className="h-12" />
                  <CommandList className="max-h-[280px] overflow-y-auto p-1">
                    <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No model found.</CommandEmpty>
                    {Object.entries(groupedModels).map(([group, models]) => (
                      <CommandGroup key={group} heading={group} className="px-2">
                        {models.map((m) => {
                          const modelKey = `${m.provider}|${m.model}`;
                          const isSelected = currentModelKey === modelKey;
                          return (
                            <CommandItem
                              key={modelKey}
                              value={modelKey + " " + m.label + " " + (m.note || "")}
                              onSelect={() => {
                                onModelSelect(modelKey);
                                setOpen(false);
                              }}
                              className={cn(
                                "flex items-center justify-between px-3 py-2.5 rounded-lg my-1 cursor-pointer transition-all",
                                isSelected 
                                  ? "!bg-primary !text-white shadow-md" 
                                  : "hover:bg-primary/10"
                              )}
                            >
                              <div className="flex flex-col gap-0.5">
                                <span className={cn("text-sm font-semibold", isSelected ? "!text-white" : "text-foreground")}>
                                  {m.label}
                                </span>
                                {m.note && (
                                  <span className={cn("text-[10px] line-clamp-1", isSelected ? "!text-white/80" : "text-muted-foreground")}>
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

          <div className="space-y-6 pt-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold flex items-center gap-2">
                  System Prompt (বটের পরিচয় ও কাজ)
                </label>
                
                <TooltipProvider delay={100}>
                  <Tooltip>
                    <TooltipTrigger render={<div className="inline-block" />}>
                      <Button 
                        onClick={handleEnhance} 
                        disabled={enhancing || userPlan.toLowerCase() === "starter"} 
                        variant="outline" 
                        size="sm" 
                        className="h-8 gap-1.5 text-xs font-semibold bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary transition-all disabled:opacity-50"
                      >
                        {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                        Enhance with AI
                      </Button>
                    </TooltipTrigger>
                    {userPlan.toLowerCase() === "starter" && (
                      <TooltipContent side="top">
                        <p className="text-xs">This feature is only for Premium users.</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* High-contrast, clean Info Box for maximum readability with violet gradient */}
              <div className="flex items-start gap-4 p-5 rounded-2xl bg-gradient-to-br from-primary via-violet-500 to-indigo-500 border-l-4 border-l-white/30 shadow-xl transition-all">
                <div className="bg-white/20 p-2 rounded-full shrink-0">
                  <Info className="w-5 h-5 text-white" />
                </div>
                <div className="space-y-1">
                  <p className="text-[14px] font-bold text-white leading-none">
                    বটের পরিচয় ও কাজের বিবরণ (Identity)
                  </p>
                  <p className="text-[13px] text-white/90 leading-relaxed font-medium">
                    এখানে বিস্তারিত লিখে দিন আপনার এআই অ্যাসিস্ট্যান্ট কে এবং তাকে কাস্টমারদের সাথে কীভাবে কথা বলতে হবে। এটি যত বিস্তারিত হবে, আপনার বট তত বুদ্ধিমান হবে।
                  </p>
                </div>
              </div>
            </div>

            <textarea
              value={bot.systemPrompt}
              onChange={(e) => onBotChange("systemPrompt", e.target.value)}
              disabled={enhancing}
              className="w-full h-72 bg-muted/20 border border-border rounded-2xl p-5 text-[15px] focus:ring-2 focus:ring-primary/50 outline-none resize-none transition-all leading-relaxed shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Example: You are a friendly customer support agent for REMOVED AI..."
            />

            {/* Demo Prompts / Identity Templates */}
            <div className="space-y-4 pt-4 border-t border-border">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                Quick Setup Templates
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {DEMO_PROMPTS.map((p) => (
                  <button
                    key={p.title}
                    onClick={() => {
                      onBotChange("systemPrompt", p.content);
                      toast.info(`${p.title} template applied!`);
                    }}
                    className="flex flex-col gap-1 px-4 py-3 text-left border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all group relative overflow-hidden"
                  >
                    <span className="font-bold text-[12px] truncate group-hover:text-primary transition-colors">{p.title}</span>
                    <span className="text-[10px] text-muted-foreground line-clamp-1">Click to apply template</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
