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

  // ─── Pro mode: curated provider groups (non-Enterprise) ─────────────────────
  const PRO_PROVIDER_GROUPS: Array<{ label: string; models: typeof CHAT_MODELS }> = [
    {
      label: "Google Gemini",
      models: CHAT_MODELS.filter((m) => m.model.toLowerCase().includes("gemini")),
    },
    {
      label: "Anthropic Claude",
      models: CHAT_MODELS.filter((m) => m.model.toLowerCase().includes("claude")),
    },
    {
      label: "OpenAI GPT",
      models: CHAT_MODELS.filter(
        (m) => m.model.toLowerCase().includes("gpt") || m.model.toLowerCase().includes("o1")
      ),
    },
    {
      label: "DeepSeek",
      models: CHAT_MODELS.filter((m) => m.model.toLowerCase().includes("deepseek")),
    },
  ].filter((g) => g.models.length > 0);

  const temperature: number = typeof bot.temperature === "number" ? bot.temperature : 0.7;
  const topP: number = typeof bot.topP === "number" ? bot.topP : 1;

  const TABS: Array<{ key: TabKey; icon: string; labelEn: string; labelBn: string }> = [
    { key: "wizard", icon: "🪄", labelEn: "Quick Setup", labelBn: "কুইক সেটআপ" },
    { key: "model", icon: "⚙️", labelEn: "AI Model", labelBn: "AI মডেল" },
    { key: "prompt", icon: "📝", labelEn: "System Prompt", labelBn: "সিস্টেম প্রম্পট" },
  ];

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* ─── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 p-3 border-b border-border/60 bg-purple-50/40 dark:bg-violet-950/10">
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-secondary/50 border border-border/50">
          {TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className="relative flex-1 rounded-xl px-3 py-2 text-center transition-colors"
              >
                {active && (
                  <motion.span
                    layoutId="settings-tab-pill"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 shadow-md shadow-violet-600/25"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 flex items-center justify-center gap-1.5 text-[12px] sm:text-[13px] font-semibold",
                    active ? "text-white" : "text-muted-foreground hover:text-foreground"
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

      {/* ─── Tab content (scrolls internally) ─────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 scrollbar-thin">
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
                <label className="text-sm font-semibold flex items-center gap-2">
                  {isBn ? "AI কোয়ালিটি লেভেল" : "AI Quality Level"}
                  <span className="text-[10px] font-normal bg-violet-500/10 text-violet-600 px-1.5 py-0.5 rounded">
                    {activeQuality ? `${activeQuality.credits} ${isBn ? "ক্রেডিট/রিপ্লাই" : "credit/reply"}` : `${selectedModel?.tier || "custom"}`}
                  </span>
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
                          "relative flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer",
                          isActive ? `${q.activeColor} shadow-lg` : `${q.bgColor}`
                        )}
                      >
                        <span className="text-2xl">{q.icon}</span>
                        <span className="font-bold text-sm">{q.label}</span>
                        <span className="text-[10px] text-muted-foreground text-center leading-tight">{q.description}</span>
                        <span className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1",
                          isActive ? "bg-white/20 text-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          {q.credits} {isBn ? "ক্রেডিট" : "credit"}/{isBn ? "রিপ্লাই" : "reply"}
                        </span>
                        {isActive && (
                          <div className="absolute top-2 right-2">
                            <Check className="w-4 h-4 text-violet-600" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── PRO MODE: advanced picker + generation sliders ──────────── */}
            {promptMode === "pro" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    {isBn ? "মডেল প্রোভাইডার" : "Model Provider"}
                    <span className="text-[10px] font-normal bg-violet-500/10 text-violet-600 px-1.5 py-0.5 rounded">
                      {selectedModel?.tier || "custom"}
                    </span>
                  </label>

                  {/* Enterprise → full searchable catalog; others → curated groups */}
                  {isEnterprise ? (
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={open}
                          className="w-full h-12 justify-between rounded-xl border-border bg-background px-4 py-3 font-normal hover:border-violet-500/50 transition-all shadow-sm"
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
                                        isSelected ? "!bg-violet-600 !text-white shadow-md" : "hover:bg-violet-500/10"
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
                  ) : (
                    <select
                      value={currentModelKey}
                      onChange={(e) => onModelSelect(e.target.value)}
                      className="w-full h-12 rounded-xl border border-secondary bg-secondary/30 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    >
                      {PRO_PROVIDER_GROUPS.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.models.map((m) => (
                            <option key={`${m.provider}|${m.model}`} value={`${m.provider}|${m.model}`}>
                              {m.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  )}
                </div>

                {/* Generation settings — Temperature & Top-P */}
                <div className="space-y-5 rounded-2xl border border-purple-200/70 dark:border-violet-500/20 bg-purple-50/60 dark:bg-violet-950/20 p-4">
                  <p className="text-xs font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wide">
                    {isBn ? "জেনারেশন সেটিংস" : "Generation Settings"}
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">Temperature</span>
                      <span className="font-mono text-violet-600 dark:text-violet-300">{temperature.toFixed(2)}</span>
                    </div>
                    <Slider
                      value={[temperature]}
                      min={0}
                      max={1}
                      step={0.1}
                      onValueChange={(v) => onBotChange("temperature", sliderNum(v))}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {isBn
                        ? "কম = নির্ভুল ও ধারাবাহিক, বেশি = সৃজনশীল ও বৈচিত্র্যময়।"
                        : "Lower = focused & consistent, higher = creative & varied."}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">Top-P</span>
                      <span className="font-mono text-violet-600 dark:text-violet-300">{topP.toFixed(2)}</span>
                    </div>
                    <Slider
                      value={[topP]}
                      min={0}
                      max={1}
                      step={0.05}
                      onValueChange={(v) => onBotChange("topP", sliderNum(v))}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {isBn
                        ? "উত্তরের শব্দ নির্বাচনের বৈচিত্র্য নিয়ন্ত্রণ করে (nucleus sampling)।"
                        : "Controls word-choice diversity via nucleus sampling."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB 3 — System Prompt & Guide ════════════════════════════════ */}
        {activeTab === "prompt" && (
          <div className="space-y-4">
            <SystemPromptGuide />

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-bold flex items-center gap-2">
                  {isBn ? "সিস্টেম প্রম্পট (বটের পরিচয় ও কাজ)" : "System Prompt (Bot Identity & Role)"}
                </label>

                <div className="flex items-center gap-1.5">
                  <TooltipProvider delay={100}>
                    <Tooltip>
                      <TooltipTrigger render={<div className="inline-block" />}>
                        <Button
                          onClick={handleEnhance}
                          disabled={enhancing}
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs font-semibold bg-violet-500/5 hover:bg-violet-500/10 border-violet-500/20 text-violet-600 transition-all disabled:opacity-50"
                        >
                          {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                          {enhancing ? (isBn ? "এনহ্যান্সিং…" : "Enhancing…") : (isBn ? "AI দিয়ে উন্নত করুন" : "Enhance with AI")}
                        </Button>
                      </TooltipTrigger>
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

              {/* Info box — violet gradient */}
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-br from-primary via-violet-500 to-indigo-500 shadow-lg">
                <div className="bg-white/20 p-1.5 rounded-full shrink-0">
                  <Info className="w-4 h-4 text-white" />
                </div>
                <p className="text-[12px] text-white/95 leading-relaxed font-medium">
                  {isBn
                    ? "এখানে লিখুন আপনার এআই অ্যাসিস্ট্যান্ট কে এবং কীভাবে কাস্টমারদের সাথে কথা বলবে। যত বিস্তারিত, তত স্মার্ট।"
                    : "Describe who your AI assistant is and how it talks to customers. The more detailed, the smarter."}
                </p>
              </div>

              <textarea
                value={rawPrompt}
                onChange={(e) => setRawPrompt(e.target.value)}
                disabled={enhancing}
                className="w-full min-h-[280px] bg-muted/20 border border-border rounded-2xl p-5 text-[15px] focus:ring-2 focus:ring-violet-500/40 outline-none resize-y transition-all leading-relaxed shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Example: You are a friendly customer support agent for DRIPLARE AI..."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
