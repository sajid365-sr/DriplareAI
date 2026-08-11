"use client";
import { useState } from "react";
import { Save, Loader2, Info, Sparkles, Check, ChevronsUpDown, Search, Wand2, Rocket } from "lucide-react";
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
import { CHATBOT_MODES } from "@/lib/ai/demo-prompts";
import { toast } from "sonner";
import { cn } from "@/lib/core/utils";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ModeSwitcher, type PromptMode } from "@/components/chatbots/ModeSwitcher";
import { WizardModal } from "@/components/chatbots/WizardModal";
import type { WizardData } from "@/lib/ai/wizard-schema";

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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardCategory, setWizardCategory] = useState("ecommerce");
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

  // ─── Guided Setup Wizard ───────────────────────────────────────────────────
  const openWizard = (category: string) => {
    setWizardCategory(category);
    setWizardOpen(true);
  };

  const handleWizardGenerated = (
    generatedRaw: string,
    compiled: string,
    wizardData: WizardData
  ) => {
    setRawPrompt(generatedRaw);
    onBotChange("compiledPrompt", compiled);
    onBotChange("wizardData", wizardData);
    onBotChange("chatbotMode", wizardCategory);
  };

  const currentModelKey = `${bot.provider}|${bot.model}`;
  const selectedModel = CHAT_MODELS.find(m => `${m.provider}|${m.model}` === currentModelKey);

  // ─── Quality Level definitions (Simple mode) ───────────────────────────────
  const QUALITY_LEVELS = [
    {
      key: "fast",
      label: isBn ? "Fast" : "Fast",
      icon: "⚡",
      description: isBn ? "দ্রুত ও সাশ্রয়ী — সাধারণ প্রশ্নোত্তরের জন্য" : "Quick & affordable — for general Q&A",
      credits: 1,
      modelKey: "gemini|google/gemini-flash-1.5-8b",
      color: "from-emerald-500 to-teal-500",
      bgColor: "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60",
      activeColor: "bg-emerald-500/20 border-emerald-500 shadow-emerald-500/20",
    },
    {
      key: "smart",
      label: isBn ? "Smart" : "Smart",
      icon: "🎯",
      description: isBn ? "বুদ্ধিমান ও নির্ভুল — বেশিরভাগ কাজের জন্য আদর্শ" : "Intelligent & precise — ideal for most tasks",
      credits: 3,
      modelKey: "gemini|google/gemini-2.0-flash-001",
      color: "from-blue-500 to-indigo-500",
      bgColor: "bg-blue-500/10 border-blue-500/30 hover:border-blue-500/60",
      activeColor: "bg-blue-500/20 border-blue-500 shadow-blue-500/20",
    },
    {
      key: "genius",
      label: isBn ? "Genius" : "Genius",
      icon: "🧠",
      description: isBn ? "সর্বোচ্চ বুদ্ধিমত্তা — জটিল সমস্যা সমাধানে" : "Highest intelligence — for complex problem solving",
      credits: 5,
      modelKey: "openrouter|anthropic/claude-3.5-sonnet:beta",
      color: "from-violet-500 to-purple-600",
      bgColor: "bg-violet-500/10 border-violet-500/30 hover:border-violet-500/60",
      activeColor: "bg-violet-500/20 border-violet-500 shadow-violet-500/20",
    },
  ];

  const activeQuality = QUALITY_LEVELS.find(q => q.modelKey === currentModelKey);

  // Grouping logic for advanced model combobox (Enterprise only)
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

  // ─── Pro mode: explicit provider groups ────────────────────────────────────
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

        {/* ─── Simple vs Pro Mode Switcher ─────────────────────────────── */}
        <div className="mb-8">
          <ModeSwitcher mode={promptMode} onChange={setPromptMode} />
          <p className="text-[11px] text-muted-foreground mt-2">
            {promptMode === "simple"
              ? isBn
                ? "সহজ মোড — মডেল টিয়ার ও ক্যাটাগরি টেমপ্লেট থেকে গাইডেড সেটআপ।"
                : "Simple mode — guided setup via model tiers & category templates."
              : isBn
                ? "প্রো মোড — মডেল প্রোভাইডার ও সম্পূর্ণ প্রম্পট এডিটর আনলক।"
                : "Pro mode — unlock explicit model providers & the full prompt editor."}
          </p>
        </div>

        <div className="space-y-8">
          {/* ─── SIMPLE MODE VIEW ─────────────────────────────────────── */}
          {promptMode === "simple" && (
            <>
              {/* AI Quality Level Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    {isBn ? "AI কোয়ালিটি লেভেল" : "AI Quality Level"}
                    <span className="text-[10px] font-normal bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      {activeQuality ? `${activeQuality.credits} ${isBn ? "ক্রেডিট/রিপ্লাই" : "credit/reply"}` : `${selectedModel?.tier || "custom"}`}
                    </span>
                  </label>

                  {/* Enterprise Advanced Toggle */}
                  {isEnterprise && (
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className={cn(
                        "flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all",
                        showAdvanced
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                      )}
                    >
                      <ChevronsUpDown className="w-3 h-3" />
                      {isBn ? "কাস্টম মডেল" : "Custom Models"}
                    </button>
                  )}
                </div>

                {/* Quality Level Cards */}
                {(!isEnterprise || !showAdvanced) && (
                  <div className="grid grid-cols-3 gap-3">
                    {QUALITY_LEVELS.map((q) => {
                      const isActive = q.modelKey === currentModelKey;
                      return (
                        <button
                          key={q.key}
                          type="button"
                          onClick={() => onModelSelect(q.modelKey)}
                          className={cn(
                            "relative flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all duration-200 group cursor-pointer",
                            isActive
                              ? `${q.activeColor} shadow-lg`
                              : `${q.bgColor}`
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
                              <Check className="w-4 h-4 text-primary" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Enterprise Advanced Model Combobox */}
                {isEnterprise && showAdvanced && (
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
                )}
              </div>

              {/* Category Template Cards → open Guided Setup Wizard */}
              <div className="space-y-4 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                    {isBn ? "ক্যাটাগরি টেমপ্লেট" : "Category Templates"}
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openWizard(bot.chatbotMode || "ecommerce")}
                    className="h-8 gap-1.5 text-xs font-semibold bg-gradient-to-r from-primary/10 to-violet-500/10 hover:from-primary/20 hover:to-violet-500/20 border-primary/20 text-primary transition-all"
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    {isBn ? "কুইক সেটআপ উইজার্ড" : "Quick Setup Wizard"}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {CHATBOT_MODES.map((m) => {
                    const isSelected = bot.chatbotMode === m.mode || (!bot.chatbotMode && m.mode === "general");
                    return (
                      <button
                        key={m.mode}
                        type="button"
                        onClick={() => openWizard(m.mode)}
                        className={cn(
                          "flex flex-col gap-2 p-4 text-left border rounded-2xl transition-all relative overflow-hidden hover:scale-[1.01] active:scale-[0.99] group",
                          isSelected
                            ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                            : "border-border hover:border-primary/30 hover:bg-muted/10"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-bold text-[14px] text-foreground group-hover:text-primary transition-colors">{m.title}</span>
                          {isSelected ? (
                            <span className="bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
                              Active
                            </span>
                          ) : m.badge ? (
                            <span className="bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 text-[10px] px-2 py-0.5 rounded-full font-medium">
                              {m.badge}
                            </span>
                          ) : null}
                        </div>
                        <span className="text-[12px] text-muted-foreground leading-relaxed">
                          {m.description}
                        </span>
                        <span className="text-[10px] font-semibold text-primary/70 group-hover:text-primary transition-colors">
                          {isBn ? "উইজার্ড দিয়ে সেটআপ করুন →" : "Setup with wizard →"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ─── PRO MODE VIEW ────────────────────────────────────────── */}
          {promptMode === "pro" && (
            <div className="space-y-3">
              <label className="text-sm font-semibold flex items-center gap-2">
                {isBn ? "মডেল প্রোভাইডার" : "Model Provider"}
                <span className="text-[10px] font-normal bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {selectedModel?.tier || "custom"}
                </span>
              </label>
              <select
                value={currentModelKey}
                onChange={(e) => onModelSelect(e.target.value)}
                className="w-full h-12 rounded-xl border border-secondary bg-secondary/30 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
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
              <p className="text-[11px] text-muted-foreground">
                {isBn
                  ? "প্রো মোডে আপনি সরাসরি মডেল প্রোভাইডার ও মডেল বেছে নিতে পারবেন।"
                  : "In Pro mode you can pick the exact model provider and model."}
              </p>
            </div>
          )}

          {/* ─── System Prompt (rawPrompt) — shared by both modes ─────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold flex items-center gap-2">
                {isBn ? "সিস্টেম প্রম্পট (বটের পরিচয় ও কাজ)" : "System Prompt (Bot Identity & Role)"}
              </label>

              <TooltipProvider delay={100}>
                <Tooltip>
                  <TooltipTrigger render={<div className="inline-block" />}>
                    <Button
                      onClick={handleEnhance}
                      disabled={enhancing}
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs font-semibold bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary transition-all disabled:opacity-50"
                    >
                      {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                      {enhancing ? (isBn ? "এনহ্যান্সিং…" : "Enhancing…") : "Enhance with AI"}
                    </Button>
                  </TooltipTrigger>
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
                  {isBn ? "বটের পরিচয় ও কাজের বিবরণ (Identity)" : "Bot Identity & Role Description"}
                </p>
                <p className="text-[13px] text-white/90 leading-relaxed font-medium">
                  {isBn
                    ? "এখানে বিস্তারিত লিখে দিন আপনার এআই অ্যাসিস্ট্যান্ট কে এবং তাকে কাস্টমারদের সাথে কীভাবে কথা বলতে হবে। এটি যত বিস্তারিত হবে, আপনার বট তত বুদ্ধিমান হবে।"
                    : "Describe who your AI assistant is and how it should talk to customers. The more detailed, the smarter your bot."}
                </p>
              </div>
            </div>

            <textarea
              value={rawPrompt}
              onChange={(e) => setRawPrompt(e.target.value)}
              disabled={enhancing}
              className="w-full h-72 bg-muted/20 border border-border rounded-2xl p-5 text-[15px] focus:ring-2 focus:ring-primary/50 outline-none resize-none transition-all leading-relaxed shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Example: You are a friendly customer support agent for DRIPLARE AI..."
            />
          </div>
        </div>
      </div>

      {/* Guided Setup Wizard Modal */}
      <WizardModal
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        category={wizardCategory}
        onGenerated={handleWizardGenerated}
      />
    </div>
  );
};
