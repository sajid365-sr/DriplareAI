"use client";
import { useState } from "react";
import { Loader2, Info, Check, ChevronsUpDown, Wand2, Copy, RotateCcw, Lock } from "lucide-react";
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
import { getModelKey, useOpenRouterModels, type UiTierKey } from "@/components/chatbots/use-openrouter-models";
import { proModeLock } from "@/components/chatbots/LockedOverlay";
import { useRegion } from "@/components/region-provider";
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

export const ChatSettings = ({ bot, userPlan = "starter", onBotChange, onModelSelect }: ChatSettingsProps) => {
  const [activeTab, setActiveTab] = useState<TabKey>("wizard");
  const [open, setOpen] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const { models, grouped, tiers, loading: loadingModels } = useOpenRouterModels();
  const { t, i18n } = useTranslation("chatbots");
  const { region } = useRegion();
  const isBn = i18n.language === "bn";

  const filteredGrouped = Object.entries(grouped).reduce((acc, [group, groupModels]) => {
    const filtered = groupModels.filter((m) => {
      if (!modelSearchQuery.trim()) return true;
      const q = modelSearchQuery.toLowerCase();
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

  // ─── Pro মোড এই plan-এ আছে কি না ───────────────────────────────────────────
  // ⚠️ এটাই এখন **একমাত্র** নিয়ম (`canUseProMode`, `lib/domain/plan-config.ts`):
  //    Starter শুধু Simple (Guided) পায়, আর Starter-এর উপরের সব plan Simple +
  //    Pro — admin-এর Merchant Active রাখা সব মডেল নিয়ে। মডেল-প্রতি আলাদা
  //    তালা আর নেই, তাই `allowedPlans`-ভিত্তিক কোনো হিসাবও এখানে নেই।
  const { locked: proLocked, requiredPlan } = proModeLock(userPlan, region);

  // ─── Prompt Mode (Simple / Pro) ────────────────────────────────────────────
  const promptMode: PromptMode = bot.promptMode === "pro" ? "pro" : "simple";
  const setPromptMode = (mode: PromptMode) => onBotChange("promptMode", mode);

  // ⚠️ DB-তে এখনো `"pro"` পড়ে থাকতে পারে — plan এই সবে নামল, আর সার্ভারের
  //    reconciliation তখনো চলে নি। ব্যবহারকারীর সামনে একটা অচল Pro প্যানেল
  //    দেখানোর চেয়ে Simple দেখিয়ে সেভ করতে বলা অনেক ভালো, কারণ এই অবস্থায়
  //    bot-এর আসল উত্তর বন্ধ (`chat` রুট ৪০৩ দেয়)।
  const proForcedBackToSimple = proLocked && promptMode === "pro";
  const effectiveMode: PromptMode = proLocked ? "simple" : promptMode;

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
  const selectedModel = models.find((m) => getModelKey(m) === currentModelKey);

  // ─── Which quality tier is in effect? ──────────────────────────────────────
  // A bot stores one of two shapes, and both must light up the same card:
  //   • Simple mode      → the tier key itself ("fast" | "smart" | "genius"),
  //                        which is what the tier cards write and what the API
  //                        persists for this mode.
  //   • Pro mode / legacy → a concrete OpenRouter model id, matched against
  //                        whatever each tier currently resolves to.
  // Without the second branch a bot created with an explicit model reads as
  // "nothing selected", which looks like the setup was lost.
  const TIER_KEYS: UiTierKey[] = ["fast", "smart", "genius"];
  const activeTierKey: UiTierKey | null =
    TIER_KEYS.find((key) => key === bot.model) ??
    TIER_KEYS.find((key) => tiers[key].modelId === bot.model) ??
    null;

  // ─── Quality Level definitions (Simple mode) ───────────────────────────────
  // কার্ডে `effectiveCredits` দেখানো হয় — গুণক প্রয়োগের পর যা **সত্যিই কাটা
  // হবে**। base `credits` দেখালে আবার "কার্ডে ৫, কাটে ১০" হয়ে যেত।
  //
  // ⚠️ এখানে `allowedPlans` আর নেই — Simple মোড **সবার** জন্য খোলা, তাই তিনটি
  //    tier কার্ডের কোনোটাতেই কোনো plan-এর তালা বসে না। যা বদলায় তা admin-এর
  //    Merchant Active টগল, আর সেটা প্রিসেট বাছার সময়েই যাচাই হয়ে যায়।
  //
  // ⚠️ রঙগুলোও এখন থিম-টোকেন — আগে `bg-emerald-500/10`, `bg-blue-500/20`,
  //    `ring-violet-500/30` লেখা ছিল, যা AGENTS.md §3 ভাঙে এবং dark mode-এ
  //    আলাদা করে ঠিক করতে হত। এখন success → info → primary: একই ক্রমবর্ধমান
  //    মাত্রা, কেবল theme-এর ভাষায়।
  const QUALITY_LEVELS = [
    {
      key: "fast" as UiTierKey,
      label: "Fast",
      icon: "⚡",
      description: isBn ? "দ্রুত ও সাশ্রয়ী — সাধারণ প্রশ্নোত্তরের জন্য" : "Quick & affordable — for general Q&A",
      credits: tiers.fast.effectiveCredits,
      // `tier|` is the prefix `handleModelSelect` understands: it stores the key
      // rather than a model id, so admin can repoint the tier later without
      // this bot being pinned to whatever model happened to be Fast today.
      modelKey: "tier|fast",
      modelId: tiers.fast.modelId,
      activeColor: "bg-success/10 border-success ring-1 ring-success/30 shadow-lg shadow-success/20",
      hoverColor: "hover:border-success/50",
    },
    {
      key: "smart" as UiTierKey,
      label: "Smart",
      icon: "🎯",
      description: isBn ? "বুদ্ধিমান ও নির্ভুল — বেশিরভাগ কাজের জন্য আদর্শ" : "Intelligent & precise — ideal for most tasks",
      credits: tiers.smart.effectiveCredits,
      modelKey: "tier|smart",
      modelId: tiers.smart.modelId,
      activeColor: "bg-info/10 border-info ring-1 ring-info/30 shadow-lg shadow-info/20",
      hoverColor: "hover:border-info/50",
    },
    {
      key: "genius" as UiTierKey,
      label: "Genius",
      icon: "🧠",
      description: isBn ? "সর্বোচ্চ বুদ্ধিমত্তা — জটিল সমস্যা সমাধানে" : "Highest intelligence — for complex problem solving",
      credits: tiers.genius.effectiveCredits,
      modelKey: "tier|genius",
      modelId: tiers.genius.modelId,
      activeColor: "bg-primary/10 border-primary ring-1 ring-primary/30 shadow-lg shadow-primary/20",
      hoverColor: "hover:border-primary/50",
    },
  ];

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
              {/* ⚠️ `effectiveMode` — `promptMode` নয়। plan-এ Pro না থাকলে
                  (Starter) UI জোর করে Simple-এ থাকে, তাই Pro প্যানেলটা
                  Starter ব্যবহারকারীর সামনে কোনোদিন খোলে না। */}
              <ModeSwitcher
                mode={effectiveMode}
                onChange={setPromptMode}
                proLocked={proLocked}
                requiredPlan={requiredPlan}
              />
              <p className="text-[11px] text-muted-foreground mt-2">
                {effectiveMode === "simple"
                  ? isBn
                    ? "সহজ মোড — ক্রেডিট-ভিত্তিক কোয়ালিটি টিয়ার বেছে নিন।"
                    : "Simple mode — pick a credit-based quality tier."
                  : isBn
                    ? "প্রো মোড — নির্দিষ্ট মডেল প্রোভাইডার ও জেনারেশন সেটিংস আনলক।"
                    : "Pro mode — unlock explicit model providers & generation settings."}
              </p>

              {/* plan এই সবে নামল, তাই DB-তে এখনো "pro" পড়ে আছে — সেভ করলেই
                  সার্ভার সেটা Simple-এ নামিয়ে দেয় (`reconcilePromptModeForPlan`)। */}
              {proForcedBackToSimple && (
                <p className="mt-2 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-[11px] leading-relaxed text-foreground">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                  <span>
                    {t(
                      "model_lock.proFellBackToSimple",
                      "Pro mode is no longer in your plan, so this agent has been switched to Simple. Save to apply it — until then the agent cannot reply."
                    )}
                  </span>
                </p>
              )}
            </div>

            {/* ─── SIMPLE MODE: quality tier cards ─────────────────────────── */}
            {effectiveMode === "simple" && (
              <div className="space-y-3">
                <label className="text-sm font-bold flex items-center gap-2 text-foreground">
                  {isBn ? "AI কোয়ালিটি লেভেল" : "AI Quality Level"}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {QUALITY_LEVELS.map((q) => {
                    const isActive = q.key === activeTierKey;
                    return (
                      // ⚠️ এখানে আর কোনো তালা নেই — Simple মোড **সবার** জন্য
                      //    খোলা (এটাই Starter-এর একমাত্র মোড)। তাই নিচের
                      //    `LockedContent`/`LockedOverlay` আর দরকার নেই, আর
                      //    তুলে দেওয়া হয়েছে। তালাটা এখন কেবল উপরের Pro
                      //    সেগমেন্টে।
                      <button
                        key={q.key}
                        type="button"
                        onClick={() => onModelSelect(q.modelKey)}
                        aria-pressed={isActive}
                        className={cn(
                          "relative flex h-full w-full flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all duration-200 text-center cursor-pointer",
                          isActive
                            ? q.activeColor
                            : `bg-card border-border text-foreground ${q.hoverColor}`
                        )}
                      >
                        <span className="text-2xl">{q.icon}</span>
                        <span className="font-bold text-sm text-foreground">{q.label}</span>
                        <span className="text-[10px] text-muted-foreground text-center leading-tight">{q.description}</span>
                        <span className={cn(
                          "text-[10px] font-semibold px-2.5 py-0.5 rounded-full mt-1",
                          isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          {/* লোড হওয়ার আগে কোনো সংখ্যাই দেখানো হয় না — তা না হলে
                              এক মুহূর্তের জন্য ভুল credit দেখিয়ে আবার বদলে যেত,
                              আর কেউ সেটা বিশ্বাস করে ফেলতে পারত। */}
                          {loadingModels
                            ? isBn ? "ক্রেডিট…" : "credits…"
                            : `${q.credits} ${isBn ? "ক্রেডিট" : "credit"}/${isBn ? "রিপ্লাই" : "reply"}`}
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

                {/* A bot whose model matches no tier — one picked in Pro mode, or
                    an older bot whose tier model was since repointed by admin —
                    would otherwise show three unselected cards and read as if the
                    setup had been lost. Say so instead of leaving it ambiguous. */}
                {!loadingModels && activeTierKey === null && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {isBn
                      ? "বর্তমান মডেলটি কোনো কোয়ালিটি লেভেলের সাথে মেলে না। নিচের যেকোনো একটি বেছে নিলে সেটিই প্রযোজ্য হবে।"
                      : "The current model doesn't match a quality level. Pick one below to switch to it."}
                  </p>
                )}

              </div>
            )}

            {/* ─── PRO MODE: advanced model provider selection ──────────── */}
            {effectiveMode === "pro" && (
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
                          <span className="text-muted-foreground text-sm">
                            {loadingModels ? "Loading live models..." : "Select a model..."}
                          </span>
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
                      <Command shouldFilter={false} className="bg-transparent">
                        <CommandInput
                          value={modelSearchQuery}
                          onValueChange={setModelSearchQuery}
                          placeholder="Search AI model..."
                          className="h-10 text-sm border-none bg-muted/50 rounded-xl px-3"
                        />
                        <CommandList className="max-h-[300px] overflow-y-auto p-1 space-y-2">
                          <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No model found.</CommandEmpty>
                          {Object.entries(filteredGrouped).map(([group, models]) => (
                            <CommandGroup key={group} heading={group} className="px-1 text-xs font-bold text-muted-foreground">
                              {models.map((m) => {
                                const modelKey = getModelKey(m);
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
                                    <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                                      <div className="flex flex-col gap-0.5 min-w-0">
                                        <span className={cn("text-sm font-bold", isSelected ? "!text-white" : "!text-foreground")}>
                                          {m.label}
                                        </span>
                                        {m.note && (
                                          <span className={cn("text-[11px] font-medium line-clamp-1", isSelected ? "!text-white/85" : "!text-muted-foreground")}>
                                            {m.note}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center shrink-0">
                                        {isSelected && <Check className="h-4 w-4 !text-white shrink-0 ml-2" />}
                                      </div>
                                    </div>
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
