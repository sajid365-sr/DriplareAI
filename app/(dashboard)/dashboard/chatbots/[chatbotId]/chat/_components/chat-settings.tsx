"use client";
import { useState } from "react";
import { Loader2, Info, Sparkles, Check, ChevronsUpDown, Wand2, Copy, RotateCcw } from "lucide-react";
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
import { Slider } from "@/components/ui/slider";
import { CHAT_MODELS } from "@/lib/ai/chat-models";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/core/utils";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ModeSwitcher, type PromptMode } from "@/components/chatbots/ModeSwitcher";
import { InlineWizard } from "@/components/chatbots/InlineWizard";
import { SystemPromptGuide } from "@/components/chatbots/SystemPromptGuide";
import type { WizardData } from "@/lib/ai/wizard-schema";

interface ChatSettingsProps {
  bot: any;
  userPlan?: string;
  onBotChange: (key: string, val: any) => void;
  onModelSelect: (key: string) => void;
}

type TabKey = "wizard" | "model" | "prompt";

/** Reads a scalar out of the base-ui Slider `onValueChange` (number | number[]). */
const sliderNum = (v: number | readonly number[]) =>
  Array.isArray(v) ? v[0] : (v as number);

export const ChatSettings = ({ bot, userPlan = "starter", onBotChange, onModelSelect }: ChatSettingsProps) => {
  const [activeTab, setActiveTab] = useState<TabKey>("wizard");
  const [open, setOpen] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const { i18n } = useTranslation();
  const isBn = i18n.language === "bn";
  const isEnterprise = userPlan.toLowerCase() === "enterprise";

  // ─── Prompt Mode (Simple / Pro) ────────────────────────────────────────────
  const promptMode: PromptMode = bot.promptMode === "pro" ? "pro" : "simple";
  const setPromptMode = (mode: PromptMode) => onBotChange("promptMode", mode);

  // Human-readable raw prompt (falls back to the legacy systemPrompt field).
  const rawPrompt: string = bot.rawPrompt ?? bot.systemPrompt ?? "";
  const setRawPrompt = (value: string) => {
    onBotChange("rawPrompt", value);
    onBotChange("systemPrompt", value);
  };

  // ─── Enhance with AI (non-credit endpoint) ─────────────────────────────────
  const handleEnhance = async () => {
    if (!rawPrompt || rawPrompt.trim().length < 10) {
      toast.error("Please write a draft prompt first (at least 10 characters).");
      return;
    }

    setEnhancing(true);
    try {
      const res = await fetch("/api/chatbots/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawPrompt, category: bot.chatbotMode }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to enhance prompt");
        return;
      }

      setRawPrompt(data.enhancedPrompt);
      toast.success("Prompt enhanced successfully!");
    } catch (error) {
      console.error("[ENHANCE_PROMPT_ERROR]", error);
      toast.error("An error occurred while enhancing.");
    } finally {
      setEnhancing(false);
    }
  };

  const handleCopy = async () => {
    if (!rawPrompt.trim()) {
      toast.error(isBn ? "কপি করার মতো কিছু নেই।" : "Nothing to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(rawPrompt);
      toast.success(isBn ? "প্রম্পট কপি হয়েছে!" : "Prompt copied!");
    } catch {
      toast.error(isBn ? "কপি করা যায়নি।" : "Failed to copy.");
    }
  };

  const handleReset = () => {
    setRawPrompt("");
    toast.success(isBn ? "প্রম্পট রিসেট হয়েছে।" : "Prompt reset.");
  };

  // ─── Inline Wizard → prompt generation ─────────────────────────────────────
  const handleWizardGenerated = (
    generatedRaw: string,
    compiled: string,
    wizardData: WizardData,
    category: string
  ) => {
    setRawPrompt(generatedRaw);
    onBotChange("compiledPrompt", compiled);
    onBotChange("wizardData", wizardData);
    onBotChange("chatbotMode", category);
    setActiveTab("prompt");
  };

  const currentModelKey = `${bot.provider}|${bot.model}`;
  const selectedModel = CHAT_MODELS.find(m => `${m.provider}|${m.model}` === currentModelKey);

  // ─── Quality Level definitions (Simple mode) ───────────────────────────────
  const QUALITY_LEVELS = [
    {
      key: "fast",
      label: "Fast",
      icon: "⚡",
      description: isBn ? "দ্রুত ও সাশ্রয়ী — সাধারণ প্রশ্নোত্তরের জন্য" : "Quick & affordable — for general Q&A",
      credits: 1,
      modelKey: "gemini|google/gemini-flash-1.5-8b",
      bgColor: "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60",
      activeColor: "bg-emerald-500/20 border-emerald-500 shadow-emerald-500/20",
    },
    {
      key: "smart",
      label: "Smart",
      icon: "🎯",
      description: isBn ? "বুদ্ধিমান ও নির্ভুল — বেশিরভাগ কাজের জন্য আদর্শ" : "Intelligent & precise — ideal for most tasks",
      credits: 3,
      modelKey: "gemini|google/gemini-2.0-flash-001",
      bgColor: "bg-blue-500/10 border-blue-500/30 hover:border-blue-500/60",
      activeColor: "bg-blue-500/20 border-blue-500 shadow-blue-500/20",
    },
    {
      key: "genius",
      label: "Genius",
      icon: "🧠",
      description: isBn ? "সর্বোচ্চ বুদ্ধিমত্তা — জটিল সমস্যা সমাধানে" : "Highest intelligence — for complex problem solving",
      credits: 5,
      modelKey: "openrouter|anthropic/claude-3.5-sonnet:beta",
      bgColor: "bg-violet-500/10 border-violet-500/30 hover:border-violet-500/60",
      activeColor: "bg-violet-500/20 border-violet-500 shadow-violet-500/20",
    },
  ];

  const activeQuality = QUALITY_LEVELS.find(q => q.modelKey === currentModelKey);

  // Grouping logic for advanced model combobox (Enterprise Pro mode).
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

  const TABS: Array<{ key: TabKey; icon: string; labelEn: string; labelBn: string }> = [
    { key: "wizard", icon: "🪄", labelEn: "Quick Setup", labelBn: "কুইক সেটআপ" },
    { key: "model", icon: "⚙️", labelEn: "AI Model", labelBn: "AI মডেল" },
    { key: "prompt", icon: "📝", labelEn: "System Prompt", labelBn: "সিস্টেম প্রম্পট" },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* ─── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/60 border border-border/60">
          {TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className="relative flex-1 rounded-xl px-3 py-2 text-center transition-colors cursor-pointer"
              >
                {active && (
                  <motion.span
                    layoutId="settings-tab-pill"
                    className="absolute inset-0 rounded-xl bg-brand-gradient shadow-md shadow-primary/20"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 flex items-center justify-center gap-1.5 text-[12px] sm:text-[13px] font-semibold",
                    active ? "text-white font-bold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="text-sm leading-none">{t.icon}</span>
                  <span className="hidden sm:inline">{isBn ? t.labelBn : t.labelEn}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Tab content ─────────────────────────────────────────────────── */}
      <div className="p-5 sm:p-6 space-y-6">
        {/* ═══ TAB 1 — Quick Setup Wizard ═══════════════════════════════════ */}
        {activeTab === "wizard" && (
          <InlineWizard
            initialCategory={bot.chatbotMode || "ecommerce"}
            onGenerated={handleWizardGenerated}
          />
        )}

        {/* ═══ TAB 2 — AI Model & Quality ═══════════════════════════════════ */}
        {activeTab === "model" && (
          <div className="space-y-6">
            <div>
              <ModeSwitcher mode={promptMode} onChange={setPromptMode} />
              <p className="text-[11px] text-muted-foreground mt-2">
                {promptMode === "simple"
                  ? isBn
                    ? "সহজ মোড — ক্রেডিট-ভিত্তিক কোয়ালিটি টিয়ার বেছে নিন।"
                    : "Simple mode — pick a credit-based quality tier."
                  : isBn
                    ? "প্রো মোড — নির্দিষ্ট মডেল প্রোভাইডার ও জেনারেশন সেটিংস আনলক।"
                    : "Pro mode — unlock explicit model providers & generation settings."}
              </p>
            </div>

            {/* ─── SIMPLE MODE: quality tier cards ─────────────────────────── */}
            {promptMode === "simple" && (
              <div className="space-y-3">
                <label className="text-sm font-bold flex items-center gap-2 text-foreground">
                  {isBn ? "AI কোয়ালিটি লেভেল" : "AI Quality Level"}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {QUALITY_LEVELS.map((q) => {
                    const isActive = q.modelKey === currentModelKey;
                    return (
                      <button
                        key={q.key}
                        type="button"
                        onClick={() => onModelSelect(q.modelKey)}
                        className={cn(
                          "relative flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer text-center",
                          isActive
                            ? `${q.activeColor} shadow-lg ring-1 ring-violet-500/30`
                            : `bg-card border-border hover:border-violet-500/50 text-foreground`
                        )}
                      >
                        <span className="text-2xl">{q.icon}</span>
                        <span className="font-bold text-sm text-foreground">{q.label}</span>
                        <span className="text-[10px] text-muted-foreground text-center leading-tight">{q.description}</span>
                        <span className={cn(
                          "text-[10px] font-semibold px-2.5 py-0.5 rounded-full mt-1",
                          isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          {q.credits} {isBn ? "ক্রেডিট" : "credit"}/{isBn ? "রিপ্লাই" : "reply"}
                        </span>
                        {isActive && (
                          <div className="absolute top-2 right-2">
                            <Check className="w-4 h-4 text-primary" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── PRO MODE: advanced model provider selection ──────────── */}
            {promptMode === "pro" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center justify-between text-foreground">
                    <span>{isBn ? "মডেল প্রোভাইডার" : "Model Provider"}</span>
                    {selectedModel?.tier && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-0.5 rounded-md border border-primary/20">
                        {selectedModel.tier}
                      </span>
                    )}
                  </label>

                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full h-auto justify-between rounded-xl border border-border bg-card px-4 py-3 font-normal text-foreground hover:border-violet-500/50 transition-all shadow-2xs cursor-pointer text-left"
                      >
                        {selectedModel ? (
                          <div className="flex flex-col items-start gap-0.5 min-w-0">
                            <span className="font-bold text-sm text-foreground truncate">{selectedModel.label}</span>
                            {selectedModel.note && <span className="text-[11px] text-muted-foreground font-medium line-clamp-1">{selectedModel.note}</span>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Select a model...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-2 rounded-2xl shadow-2xl border border-border bg-popover text-popover-foreground backdrop-blur-md overflow-hidden"
                      align="start"
                      side="bottom"
                      sideOffset={8}
                    >
                      <Command className="bg-transparent">
                        <CommandInput placeholder="Search AI model..." className="h-10 text-sm border-none bg-muted/50 rounded-xl px-3" />
                        <CommandList className="max-h-[300px] overflow-y-auto p-1 space-y-2">
                          <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No model found.</CommandEmpty>
                          {Object.entries(groupedModels).map(([group, models]) => (
                            <CommandGroup key={group} heading={group} className="px-1 text-xs font-bold text-muted-foreground">
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
                                      "flex items-center justify-between p-3 rounded-xl my-1 cursor-pointer transition-all border border-transparent",
                                      isSelected
                                        ? "!bg-primary !text-white shadow-md"
                                        : "bg-secondary/40 hover:bg-secondary !text-foreground border-border/40"
                                    )}
                                  >
                                    <div className="flex flex-col gap-0.5">
                                      <span className={cn("text-sm font-bold", isSelected ? "!text-white" : "!text-foreground")}>
                                        {m.label}
                                      </span>
                                      {m.note && (
                                        <span className={cn("text-[11px] font-medium line-clamp-1", isSelected ? "!text-white/85" : "!text-muted-foreground")}>
                                          {m.note}
                                        </span>
                                      )}
                                    </div>
                                    {isSelected && <Check className="h-4 w-4 !text-white shrink-0 ml-2" />}
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
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB 3 — System Prompt & Guide ════════════════════════════════ */}
        {activeTab === "prompt" && (
          <div className="space-y-4">
            {/* Top Action Bar & Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-bold flex items-center gap-2 text-foreground">
                {isBn ? "সিস্টেম প্রম্পট (বটের পরিচয় ও কাজ)" : "System Prompt (Bot Identity & Role)"}
              </label>

              <div className="flex flex-wrap items-center gap-1.5">
                {/* 📖 System Prompt Guide (Right Side Drawer Trigger) */}
                <SystemPromptGuide isBn={isBn} />

                <TooltipProvider delay={100}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          onClick={handleEnhance}
                          disabled={enhancing}
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs font-semibold bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary transition-all disabled:opacity-50"
                        >
                          {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                          {enhancing ? (isBn ? "এনহ্যান্সিং…" : "Enhancing…") : (isBn ? "AI দিয়ে উন্নত করুন" : "Enhance with AI")}
                        </Button>
                      }
                    />
                    <TooltipContent>{isBn ? "AI দিয়ে প্রম্পট উন্নত করুন" : "Improve the prompt with AI"}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <Button
                  onClick={handleCopy}
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-semibold transition-all"
                >
                  <Copy className="w-3.5 h-3.5" /> {isBn ? "কপি" : "Copy"}
                </Button>

                <Button
                  onClick={handleReset}
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-semibold text-destructive/80 hover:text-destructive border-destructive/20 hover:bg-destructive/5 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> {isBn ? "রিসেট" : "Reset"}
                </Button>
              </div>
            </div>

            {/* Info banner — violet gradient */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-brand-gradient shadow-lg">
              <div className="bg-white/20 p-1.5 rounded-full shrink-0">
                <Info className="w-4 h-4 text-white" />
              </div>
              <p className="text-[12px] text-white/95 leading-relaxed font-medium">
                {isBn
                  ? "এখানে লিখুন আপনার এআই অ্যাসিস্ট্যান্ট কে এবং কীভাবে কাস্টমারদের সাথে কথা বলবে। যত বিস্তারিত, তত স্মার্ট।"
                  : "Describe who your AI assistant is and how it talks to customers. The more detailed, the smarter."}
              </p>
            </div>

            {/* Main Textarea — Visible at top without vertical scrolling */}
            <textarea
              value={rawPrompt}
              onChange={(e) => setRawPrompt(e.target.value)}
              disabled={enhancing}
              className="w-full min-h-[320px] bg-muted/20 border border-border rounded-2xl p-5 text-[15px] focus:ring-2 focus:ring-violet-500/40 outline-none resize-y transition-all leading-relaxed shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Example: You are a friendly customer support agent for DRIPLARE AI..."
            />
          </div>
        )}
      </div>
    </div>
  );
};
