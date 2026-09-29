"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trans, useTranslation } from "react-i18next";
import { AlertTriangle, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isActiveModel } from "@/lib/domain/model-catalog";
import { type AISettingsData } from "./types";
import { ModelCombobox } from "./ModelCombobox";

export type QuickSetupKey = "fastModel" | "smartModel" | "geniusModel";

/**
 * এই সেকশনের অসমাপ্ত (unsaved) পরিবর্তন।
 *
 * ⚠️ আগে কার্ডের প্রতিটি কী-স্ট্রোক আর প্রতিটি Model-বাছাই সঙ্গে সঙ্গে
 *    `settings`-এ চলে যেত, আর সেভ হত উপরের হেডার বাটনে। এখন এই সেকশনের
 *    নিজের সেভ বাটন আছে, তাই মানগুলো সেভ করার আগ পর্যন্ত এখানেই অপেক্ষা করে।
 *
 * `credits`-এ কেবল **বদলানো** Model-গুলোই থাকে — সবগুলো নয়। নাহলে সেভ করার
 * সময় এমন Model-এর credit-ও জোর করে লেখা হত যা admin ছোঁয়ইনি।
 */
export interface QuickSetupDraft {
  quickSetup: Record<QuickSetupKey, string>;
  /** modelId → নতুন credit (শুধু যেগুলো admin সত্যিই বদলেছেন)। */
  credits: Record<string, number>;
}

interface QuickSetupPresetsProps {
  settings: AISettingsData;
  /** হেডারের সেভ কিংবা এই সেকশনের সেভ — যেকোনোটা চললে `true`। */
  saving: boolean;
  /**
   * ড্রাফটটা সেভ করে।
   *
   * `true` ফেরত মানে মানগুলো সত্যিই DB-তে গেছে — কেবল তখনই অসমাপ্ত পরিবর্তনের
   * চিহ্নটা মুছে ফেলা হয়। ব্যর্থ হলে ড্রাফট অটুট থাকে, যাতে admin-এর খেটে করা
   * পরিবর্তন হারিয়ে না যায়।
   */
  onSave: (draft: QuickSetupDraft) => Promise<boolean>;
}

type PresetKey = QuickSetupKey;

/**
 * Static parts of the three preset cards. The credit number is deliberately
 * absent here — it is read from the selected model's `credits`, which is the
 * very value billing uses.
 */
const PRESET_CARDS: Array<{
  key: PresetKey;
  /** Short tier name — kept in English in every locale (brand/technical term). */
  tier: string;
  /** Translation branch under `aiSettings.presets.*`. */
  i18nKey: "fast" | "smart" | "genius";
  titleClass: string;
  inputClass: string;
}> = [
  {
    key: "fastModel",
    tier: "Fast",
    i18nKey: "fast",
    titleClass: "text-success",
    inputClass: "border-success/30 text-success",
  },
  {
    key: "smartModel",
    tier: "Smart",
    i18nKey: "smart",
    titleClass: "text-primary",
    inputClass: "border-primary/30 text-primary",
  },
  {
    key: "geniusModel",
    tier: "Genius",
    i18nKey: "genius",
    titleClass: "text-warning",
    inputClass: "border-warning/30 text-warning",
  },
];

export function QuickSetupPresets({ settings, saving, onSave }: QuickSetupPresetsProps) {
  const { t } = useTranslation("admin");

  // ⚠️ `useState`-এর lazy initialiser — কেবল প্রথম render-এ চলে। ইচ্ছে করেই
  //    prop বদলালে ড্রাফট রিসেট করা হয় না: admin এই সেকশনে কিছু বদলানোর পর
  //    নিচের Catalogue-তে একটা টগল চাপলেই `settings` নতুন অবজেক্ট হয়, আর
  //    তখন ড্রাফট মুছে গেলে খেটে করা কাজ হারিয়ে যেত।
  const [draft, setDraft] = useState<QuickSetupDraft>(() => ({
    quickSetup: { ...settings.quickSetup },
    credits: {},
  }));
  const [savingDraft, setSavingDraft] = useState(false);

  /**
   * গুণক এখন আর অ্যাডমিন প্যানেল থেকে বদলানো যায় না (UI তুলে দেওয়া হয়েছে),
   * কিন্তু হিসাব থেকে বাদ দেওয়া যায় না — DB-তে পুরনো কোনো মান থাকলে কার্ডে
   * "৫ credit" লিখে বিলে ১০ কাটা চলত, আর সেটাই এই কোডবেসের সবচেয়ে পুরনো বাগ।
   */
  const multiplier = settings.testChatMultiplier;

  /**
   * কেবল Merchant Active মডেলগুলো।
   *
   * ⚠️ আগে এখানে পুরো `settings.models` দেওয়া হত, তাই admin এমন মডেলকেও
   *    Fast / Smart / Genius বানাতে পারতেন যেটা merchant-দের জন্য বন্ধ।
   *    তখন ড্যাশবোর্ডের কার্ডে এমন মডেল দেখাত যা merchant নিজে বেছে নিতে
   *    পারতেন না — এবং `resolveModelConfig`-এর যাচাই তাকে অন্য মডেলে ফেরাত,
   *    অর্থাৎ কার্ডে যা লেখা থাকত তা-ই চলত না।
   */
  const activeModels = useMemo(
    () => settings.models.filter(isActiveModel),
    [settings.models]
  );

  /** ড্রাফটে থাকলে ড্রাফটের মান, নাহলে DB থেকে আসা আসল মান। */
  const creditOf = (model: { id: string; credits: number }) =>
    typeof draft.credits[model.id] === "number" ? draft.credits[model.id] : model.credits;

  const hasModelChanges = PRESET_CARDS.some(
    (card) => draft.quickSetup[card.key] !== settings.quickSetup[card.key]
  );
  const hasCreditChanges = settings.models.some(
    (m) => typeof draft.credits[m.id] === "number" && draft.credits[m.id] !== m.credits
  );
  const isDirty = hasModelChanges || hasCreditChanges;

  const setPresetModel = (key: PresetKey, value: string) =>
    setDraft((prev) => ({ ...prev, quickSetup: { ...prev.quickSetup, [key]: value } }));

  const setPresetCredit = (modelId: string, credits: number) =>
    setDraft((prev) => ({ ...prev, credits: { ...prev.credits, [modelId]: credits } }));

  const handleSave = async () => {
    setSavingDraft(true);
    try {
      const saved = await onSave(draft);
      // সেভ ব্যর্থ হলে ড্রাফটটা ইচ্ছে করেই রেখে দেওয়া হয়।
      if (saved) setDraft({ quickSetup: { ...draft.quickSetup }, credits: {} });
    } finally {
      setSavingDraft(false);
    }
  };

  const busy = saving || savingDraft;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className="w-full rounded-2xl border border-primary/20 bg-card p-4 sm:p-5 shadow-xs space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              {t("aiSettings.presets.title")}
            </h3>
            <p className="text-xs text-muted-foreground">{t("aiSettings.presets.sub")}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {PRESET_CARDS.map((card) => {
          const label = t(`aiSettings.presets.${card.i18nKey}.label`);
          const modelId = draft.quickSetup[card.key];
          const model = settings.models.find((m) => m.id === modelId);
          const credits = model ? creditOf(model) : 0;
          const effective = Math.round(credits * multiplier);
          const isInactive = !!model && !isActiveModel(model);

          // তালিকায় কেবল Active মডেল — কিন্তু বাছা মডেলটা যদি আর Active না থাকে
          // (admin বন্ধ করলেন, বা "Validate Status"-এ ডিপ্রিকেট হয়ে গেল), তবু
          // তাকে সবার আগে রাখতে হয়। নাহলে trigger-টা নামের বদলে placeholder
          // দেখাত, অথচ প্রিসেট এখনো ওই মডেলেই পয়েন্ট করে আছে — পর্দায় মিথ্যা।
          const comboboxModels = isInactive
            ? [model, ...activeModels.filter((m) => m.id !== model.id)]
            : activeModels;

          return (
            <div
              key={card.key}
              className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor={`preset-credit-${card.key}`}
                  className={cn("text-xs sm:text-sm font-bold", card.titleClass)}
                >
                  {label}
                </label>

                <div className="flex items-center gap-1.5">
                  <Input
                    id={`preset-credit-${card.key}`}
                    type="number"
                    min="1"
                    max="50"
                    disabled={!model}
                    value={model ? credits : ""}
                    onChange={(e) => {
                      if (!model) return;
                      setPresetCredit(model.id, parseInt(e.target.value) || 1);
                    }}
                    aria-label={t("aiSettings.presets.creditAria", { tier: card.tier })}
                    className={cn(
                      "h-8 w-16 text-center font-bold text-xs sm:text-sm rounded-xl bg-background",
                      card.inputClass
                    )}
                  />
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {t("aiSettings.presets.creditUnit")}
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {t(`aiSettings.presets.${card.i18nKey}.hint`)}
              </p>

              <ModelCombobox
                models={comboboxModels}
                value={modelId}
                onSelect={(val) => setPresetModel(card.key, val)}
                usdToBdtRate={settings.usdToBdtRate}
                placeholder={t("aiSettings.presets.selectPlaceholder", { tier: card.tier })}
              />

              {isInactive && (
                <p className="flex items-center gap-1.5 text-[11px] text-warning">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {t("aiSettings.presets.inactiveModel")}
                </p>
              )}

              {!model ? (
                <p className="flex items-center gap-1.5 text-[11px] text-warning">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {modelId
                    ? t("aiSettings.presets.notInCatalog")
                    : t("aiSettings.presets.noModelSelected")}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  <Trans
                    t={t}
                    i18nKey={
                      multiplier === 1
                        ? "aiSettings.presets.chargeLine"
                        : "aiSettings.presets.chargeLineMultiplier"
                    }
                    values={{ count: effective, base: credits, multiplier }}
                    components={[<span key="credits" className="font-bold text-foreground" />]}
                  />
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── এই সেকশনের নিজের সেভ ───────────────────────────────────────────
          হেডারের সেভ বাটন পেজের একদম উপরে, অথচ প্রিসেট কার্ডগুলো অনেক নিচে —
          তাই শুধু প্রিসেট বদলাতে গেলেও scroll করে উপরে যেতে হত। এই বাটন
          সেটাই বাঁচায়, আর নিচ-ডান কোণে বসে কার্ডগুলোর ঠিক শেষে। */}
      <div className="flex flex-col gap-2 border-t border-border/50 pt-3 sm:flex-row sm:items-center sm:justify-end">
        {isDirty && (
          <p className="flex items-center gap-1.5 text-[11px] text-warning sm:mr-auto">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {t("aiSettings.presets.unsavedChanges")}
          </p>
        )}

        <Button
          size="sm"
          onClick={handleSave}
          disabled={busy || !isDirty}
          className="rounded-xl gap-2 text-xs sm:text-sm h-9 bg-brand-gradient text-primary-foreground hover:opacity-90 font-medium shadow-xs w-full sm:w-auto justify-center"
        >
          <Save className="h-4 w-4" />
          {savingDraft ? t("aiSettings.presets.saving") : t("aiSettings.presets.save")}
        </Button>
      </div>
    </motion.div>
  );
}
