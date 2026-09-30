"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2, Info, Sparkles, Check, ChevronsUpDown, Wand2, Copy, RotateCcw, Lock } from "lucide-react";
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
import { getModelKey, useOpenRouterModels, type UiTierKey } from "@/components/chatbots/use-openrouter-models";
import { LockedContent, LockedOverlay, planLock } from "@/components/chatbots/LockedOverlay";
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

/** Reads a scalar out of the base-ui Slider `onValueChange` (number | number[]). */
const sliderNum = (v: number | readonly number[]) =>
  Array.isArray(v) ? v[0] : (v as number);

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

  // ─── Plan-এ কী নেই ─────────────────────────────────────────────────────────
  // ⚠️ এই হিসাবগুলো **সার্ভারের পাঠানো `allowedPlans` থেকেই** হয়, কোনো
  //    আলাদা নিয়ম থেকে নয় — আর যাচাইয়ের ফাংশনও সেই একটাই
  //    (`lib/domain/model-catalog.ts`), যা ৩c-তে API route-গুলো চালায়।
  //    তাই "ড্যাশবোর্ডে খোলা, সেভ করলে ৪০৩" অবস্থাটা এখানে অসম্ভব।
  const lockedCount = Object.values(filteredGrouped).reduce(
    (total, groupModels) =>
      total +
      groupModels.filter((m) => planLock(m.allowedPlans, userPlan, region).locked).length,
    0
  );

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
  const selectedModel = models.find((m) => getModelKey(m) === currentModelKey);

  // বটের **বর্তমানে সেভ করা** মডেলটাই যদি plan-এ না থাকে (যেমন plan নামানোর
  // পরে admin ওই মডেলটা বন্ধ করে দিলেন) — এটা সবচেয়ে জরুরি অবস্থা, কারণ
  // তখন bot-এর reply বন্ধ। তাই আলাদা ব্যানার দিয়ে সেটা বলা হয়, শুধু কার্ডে
  // তালা বসিয়ে চুপ করে থাকা নয়।
  const selectedLock = selectedModel
    ? planLock(selectedModel.allowedPlans, userPlan, region)
    : { locked: false };

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
  // `allowedPlans` আসে প্রিসেটের নিজের মডেল থেকে — কারণ merchant এখানে মডেল
  // বাছেন না, tier বাছেন; কিন্তু tier-টা কোনো plan-এ নেই কি না সেটা ঠিক হয়
  // প্রিসেটের মডেল দিয়ে। ৩c-তে সার্ভারও ঠিক এই কারণেই tier key-কে resolve
  // করে তারপর যাচাই করে।
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
      allowedPlans: tiers.fast.allowedPlans,
      bgColor: "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60",
      activeColor: "bg-emerald-500/20 border-emerald-500 shadow-emerald-500/20",
    },
    {
      key: "smart" as UiTierKey,
      label: "Smart",
      icon: "🎯",
      description: isBn ? "বুদ্ধিমান ও নির্ভুল — বেশিরভাগ কাজের জন্য আদর্শ" : "Intelligent & precise — ideal for most tasks",
      credits: tiers.smart.effectiveCredits,
      modelKey: "tier|smart",
      modelId: tiers.smart.modelId,
      allowedPlans: tiers.smart.allowedPlans,
      bgColor: "bg-blue-500/10 border-blue-500/30 hover:border-blue-500/60",
      activeColor: "bg-blue-500/20 border-blue-500 shadow-blue-500/20",
    },
    {
      key: "genius" as UiTierKey,
      label: "Genius",
      icon: "🧠",
      description: isBn ? "সর্বোচ্চ বুদ্ধিমত্তা — জটিল সমস্যা সমাধানে" : "Highest intelligence — for complex problem solving",
      credits: tiers.genius.effectiveCredits,
      modelKey: "tier|genius",
      modelId: tiers.genius.modelId,
      allowedPlans: tiers.genius.allowedPlans,
      bgColor: "bg-violet-500/10 border-violet-500/30 hover:border-violet-500/60",
      activeColor: "bg-violet-500/20 border-violet-500 shadow-violet-500/20",
    },
  ];

  // বটের বর্তমান tier-টাই যদি বন্ধ হয়ে থাকে — কার্ডটায় দুইটা অবস্থা একসাথে
  // (active + locked) দেখানোর বদলে নিচে আলাদা করে বলা হয়, কারণ তখন করণীয়টা
  // "এটাই রাখুন" নয়, "অন্য একটা বেছে নিন"।
  const lockedActiveTier =
    activeTierKey !== null &&
    planLock(tiers[activeTierKey].allowedPlans, userPlan, region).locked;

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
                    const isActive = q.key === activeTierKey;
                    const lock = planLock(q.allowedPlans, userPlan, region);
                    return (
                      // ⚠️ বাইরের `div`-টা এখানে দরকার: তালা বসলে কার্ডটার
                      //    গায়ে overlay বসাতে হয়, আর overlay-এর জন্য একটা
                      //    `relative` ধারক লাগে যা blur-প্রাপ্ত অংশটার
                      //    **বাইরে** থাকবে (নাহলে overlay নিজেও blur হয়ে যেত)।
                      //    `rounded-xl` এখানে দেওয়া আছে যাতে overlay-এর
                      //    `rounded-[inherit]` ঠিক কোণাটা ধরে।
                      <div key={q.key} className="relative rounded-xl">
                        {/* `h-full` — তিনটা কার্ডের উচ্চতা সমান রাখতে (grid item
                            stretch করে, কিন্তু ভেতরের div না করলে বাটনটাই ছোট
                            থেকে যেত, আর তালার overlay কার্ডের চেয়ে বড় দেখাত)। */}
                        <LockedContent locked={lock.locked} className="h-full">
                          <button
                            type="button"
                            // আটকানো কার্ডে ক্লিক অর্থহীন, কিন্তু `disabled`
                            // দিলে তালা-বসানো কারণটাও পড়া যেত না — তাই
                            // ক্লিকটা শুধু কিছুই করে না, আর ভেতরের CTA
                            // (`stopPropagation`) আলাদা করে কাজ করে।
                            onClick={() => {
                              if (lock.locked) return;
                              onModelSelect(q.modelKey);
                            }}
                            aria-disabled={lock.locked || undefined}
                            className={cn(
                              "relative flex h-full w-full flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all duration-200 text-center",
                              lock.locked
                                ? "bg-card border-border cursor-not-allowed"
                                : isActive
                                  ? `${q.activeColor} shadow-lg ring-1 ring-violet-500/30 cursor-pointer`
                                  : `bg-card border-border hover:border-violet-500/50 text-foreground cursor-pointer`
                            )}
                          >
                            <span className="text-2xl">{q.icon}</span>
                            <span className="font-bold text-sm text-foreground">{q.label}</span>
                            <span className="text-[10px] text-muted-foreground text-center leading-tight">{q.description}</span>
                            <span className={cn(
                              "text-[10px] font-semibold px-2.5 py-0.5 rounded-full mt-1",
                              isActive && !lock.locked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}>
                              {/* লোড হওয়ার আগে কোনো সংখ্যাই দেখানো হয় না — তা না হলে
                                  এক মুহূর্তের জন্য ভুল credit দেখিয়ে আবার বদলে যেত,
                                  আর কেউ সেটা বিশ্বাস করে ফেলতে পারত। */}
                              {loadingModels
                                ? isBn ? "ক্রেডিট…" : "credits…"
                                : `${q.credits} ${isBn ? "ক্রেডিট" : "credit"}/${isBn ? "রিপ্লাই" : "reply"}`}
                            </span>
                            {isActive && !lock.locked && (
                              <div className="absolute top-2 right-2">
                                <Check className="w-4 h-4 text-primary" />
                              </div>
                            )}
                          </button>
                        </LockedContent>

                        {lock.locked && <LockedOverlay requiredPlan={lock.requiredPlan} />}
                      </div>
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

                {/* বর্তমান tier-টাই আটকানো — সবচেয়ে জরুরি অবস্থা, কারণ তখন
                    bot-এর reply বন্ধ। তাই তালার পাশাপাশি করণীয়টাও বলা হয়। */}
                {lockedActiveTier && (
                  <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-[11px] leading-relaxed text-foreground">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                    <span>
                      {t(
                        "model_lock.currentTierLocked",
                        "Your current quality level is no longer in your plan, so this agent cannot reply. Pick another level and save."
                      )}
                    </span>
                  </p>
                )}
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
                          <span className="text-muted-foreground text-sm">
                            {loadingModels ? "Loading live models..." : "Select a model..."}
                          </span>
                        )}
                        {selectedLock.locked ? (
                          <Lock className="ml-2 h-4 w-4 shrink-0 text-warning" />
                        ) : (
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
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
                                const lock = planLock(m.allowedPlans, userPlan, region);
                                return (
                                  <CommandItem
                                    key={modelKey}
                                    value={modelKey + " " + m.label + " " + (m.note || "")}
                                    // ⚠️ `disabled` এখানে শুধু সাজসজ্জা নয় —
                                    //    cmdk নিজেই এই অবস্থায় `onSelect`
                                    //    ডাকে না, আর কীবোর্ড (তীর চিহ্ন) দিয়ে
                                    //    ঘুরেও আটকানো সারিতে থামে না। শুধু
                                    //    `onSelect`-এ শর্ত বসালে কীবোর্ড দিয়ে
                                    //    এখনো বেছে ফেলা যেত।
                                    disabled={lock.locked}
                                    onSelect={() => {
                                      if (lock.locked) return;
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
                                    <LockedContent
                                      locked={lock.locked}
                                      className="flex flex-1 items-center justify-between gap-2 min-w-0"
                                    >
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
                                        {lock.locked ? (
                                          <LockedOverlay compact requiredPlan={lock.requiredPlan} />
                                        ) : (
                                          isSelected && <Check className="h-4 w-4 !text-white shrink-0 ml-2" />
                                        )}
                                      </div>
                                    </LockedContent>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          ))}
                        </CommandList>

                        {/* আটকানো মডেলের upgrade রাস্তা এখানে — সারির ভেতরে নয়।
                            ⚠️ কারণ সারিটা নিজেই (cmdk-র) একটা বাটন, আর তার
                            ভেতরে `<a>` বসালে HTML-ই অবৈধ হয় (interactive
                            কনটেন্ট নেস্টিং), তখন ক্লিকও অনির্ভরযোগ্য হয়ে পড়ে। */}
                        {lockedCount > 0 && (
                          <div className="mt-1 flex items-center justify-between gap-2 border-t border-border px-3 py-2">
                            <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                              <Lock className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {t("model_lock.footer", "Some models are not in your plan")}
                              </span>
                            </span>
                            <Link
                              href="/dashboard/payment?reason=model_lock"
                              className="shrink-0 text-[11px] font-bold text-primary hover:underline"
                            >
                              {t("model_lock.ctaGeneric", "See plans")}
                            </Link>
                          </div>
                        )}
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {/* সেভ করা মডেলটা যদি আটকানো হয় — তখন bot-এর reply বন্ধ,
                      তাই শুধু তালার আইকন দেখিয়ে চুপ থাকা যায় না। */}
                  {selectedLock.locked && (
                    <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-[11px] leading-relaxed text-foreground">
                      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                      <span>
                        {t(
                          "model_lock.currentModelLocked",
                          "This model is no longer in your plan, so this agent cannot reply. Pick an unlocked model and save."
                        )}
                      </span>
                    </p>
                  )}
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
