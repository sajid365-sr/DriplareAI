"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Brain, DollarSign, Loader2, Save, Sliders } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { type CatalogModelShape } from "@/lib/domain/model-catalog";

export interface OpenRouterModelConfig extends CatalogModelShape {
  name: string;
  provider: string;
  tier: "Economy" | "Standard" | "Premium";
  promptPrice: number;
  completionPrice: number;
  credits: number;
  /**
   * ⚠️ এখানে আবার বাধ্যতামূলক করা হলো, যদিও `CatalogModelShape`-এ এটা ঐচ্ছিক।
   *    কারণটা ভিন্ন প্রশ্নের ভিন্ন উত্তর: ওখানে ঐচ্ছিক, কারণ যে-কোনো আকারের
   *    মডেল ওই যাচাইয়ের ভেতর দিয়ে যেতে পারে (seed, হাতে লেখা JSON)। কিন্তু
   *    admin-এর ক্যাটালগের একটা সারির মান সবসময় সত্যিকারের কিছু — `false`-ও
   *    একটা বৈধ, সংরক্ষিত সিদ্ধান্ত (`fetch-models` route ঠিক এটাই টিকিয়ে
   *    রাখে)। তাই এই স্তরে `boolean | undefined` থাকলে status ফিল্টারগুলোর
   *    হিসাব তৃতীয় একটা "জানা নেই" অবস্থা নিয়ে ভাবতে বাধ্য হত, যা আসলে নেই।
   */
  isMerchantActive: boolean;
  isManualOverride?: boolean;
  contextWindow: number;
  maxTokens: number;
  temperature: number;
}

interface ModelConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: OpenRouterModelConfig | null;
  /**
   * Drawer-এর "Apply Changes" — সোজা DB-তে লেখে, তাই `Promise<boolean>`।
   *
   * `true` ফিরলেই কেবল প্যানেল বন্ধ হয়। ব্যর্থ হলে খোলা থাকে, যাতে admin
   * এররটার কারণ (নিয়ম ভাঙা, নেটওয়ার্ক) চোখের সামনে দেখতে পান — নাহলে
   * প্যানেলটা বন্ধ হয়ে বার্তাটাও সঙ্গে করে নিয়ে যেত।
   */
  onSave: (updatedModel: OpenRouterModelConfig) => Promise<boolean>;
  /**
   * Merchant Active টগল করার অনুমতি চাওয়া — `true` ফিরলে টগলটা সরে।
   *
   * ⚠️ Drawer-এর হাতে কেবল খোলা মডেলটা থাকে, পুরো ক্যাটালগ নয়। তাই
   *    "কমপক্ষে ৫টা active থাকতে হবে" বা "এটা এখন Fast প্রিসেট" — এই হিসাব
   *    এখানে করা অসম্ভব। হিসাবটা parent-এ হয়, কারণ সেখানেই `settings.models`
   *    আছে; নাহলে এই টগলটা ক্যাটালগের নিয়ম এড়িয়ে যাওয়ার পথ হয়ে যেত।
   */
  onRequestMerchantActiveChange?: (nextActive: boolean) => boolean;
}

export function ModelConfigSheet({
  open,
  onOpenChange,
  model,
  onSave,
  onRequestMerchantActiveChange,
}: ModelConfigSheetProps) {
  const { t } = useTranslation("admin");
  const [formData, setFormData] = useState<OpenRouterModelConfig | null>(model);
  const [saving, setSaving] = useState(false);

  /**
   * ফর্মটা কখন নতুন করে বসবে — মডেল বদলালে, বা বন্ধ হয়ে আবার খুললে।
   *
   * ⚠️ এটা `useEffect(() => setFormData(model), [model])` ছিল, আর ওই পথে
   *    একটা সত্যিকারের বাগ ছিল: Cancel চেপে বন্ধ করে **একই** মডেল আবার খুললে
   *    `model` প্রপ-টা একই রেফারেন্স হয় (টেবিলের সারিটা আগের অবজেক্টই দেয়),
   *    তাই effect টা চলে না — আর admin বাতিল করা মানটাই আবার দেখেন, এমনকি
   *    ভুল করে Apply চেপে ফেললে সেটাই সেভ হয়ে যায়।
   *
   *    এখন খোলার মুহূর্তটাও হিসেবে ধরা হয়, আর সবটাই **সেই রেন্ডারেই** —
   *    React-এর অনুমোদিত "adjusting state when a prop changes" প্যাটার্ন।
   *    (effect-এর পথে নতুন মডেল খুললে এক ঝলক পুরনো মডেলের Credit দেখা যেত,
   *    কারণ React আগে পুরনো মান নিয়ে আঁকে, তারপর effect-এ ঠিক করে।)
   */
  const [draftSource, setDraftSource] = useState({ model, open });
  if (draftSource.model !== model || draftSource.open !== open) {
    const reopened = open && !draftSource.open;
    setDraftSource({ model, open });
    // নতুন মডেল হলে, বা একবার বন্ধ হয়ে আবার খোলা হলে — দুই ক্ষেত্রেই
    // admin-এর আগের সম্পাদনা (সেভ হোক বা বাতিল) ফেলে নতুন করে শুরু।
    if (model !== draftSource.model || reopened) setFormData(model);
  }

  if (!formData) return null;

  // ⚠️ Deprecated মানে OpenRouter থেকে মডেলটা উঠে গেছে। ক্যাটালগের টেবিলে
  //    এই টগলটা তখন বন্ধ থাকে, কিন্তু Drawer-এ খোলা থাকত — অর্থাৎ একই মডেল
  //    এক জায়গায় "চালু করা যাবে না", আরেক জায়গায় "চালু করা যাবে"।
  //    এখন দুই জায়গায় একই নিয়ম, আর কারণটা লিখেও দেওয়া হয়।
  const isDeprecated = formData.isDeprecated === true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData || saving) return;

    setSaving(true);
    try {
      // প্যানেল কেবল সেভ সফল হলেই বন্ধ হয় — ব্যর্থ হলে খোলা থাকে।
      if (await onSave(formData)) onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // ⚠️ সেভ চলাকালীন বাইরে ক্লিক করে বা Esc চেপে প্যানেল বন্ধ হয়ে গেলে
        //    admin কী ফল পেলেন তা আর দেখতেই পেতেন না — অথচ অনুরোধটা ততক্ষণে
        //    সার্ভারে চলে গেছে। তাই সেভ শেষ হওয়া পর্যন্ত বন্ধ করা যায় না।
        if (saving) return;
        onOpenChange(next);
      }}
    >
      <SheetContent className="w-full sm:max-w-md overflow-y-auto flex flex-col justify-between">
        <div>
          <SheetHeader className="space-y-2 pb-4 border-b border-border/40">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold">{formData.name}</SheetTitle>
                <SheetDescription className="text-xs font-mono text-muted-foreground">
                  {formData.provider} • {formData.id}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <form id="model-config-form" onSubmit={handleSubmit} className="py-6 space-y-6">
            {/* ── OpenRouter Token Pricing ── */}
            <div className="rounded-xl border border-primary/10 bg-muted/20 p-4 space-y-3">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-primary" />
                {t("aiSettings.configSheet.livePricingTitle")}
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-card p-2.5 rounded-lg border border-border/60">
                  <span className="text-[10px] text-muted-foreground block">
                    {t("aiSettings.configSheet.promptLabel")}
                  </span>
                  <span className="font-mono font-bold text-foreground">${formData.promptPrice.toFixed(2)} / 1M</span>
                </div>
                <div className="bg-card p-2.5 rounded-lg border border-border/60">
                  <span className="text-[10px] text-muted-foreground block">
                    {t("aiSettings.configSheet.completionLabel")}
                  </span>
                  <span className="font-mono font-bold text-foreground">${formData.completionPrice.toFixed(2)} / 1M</span>
                </div>
              </div>
            </div>

            {/* ── Merchant Active Toggle ── */}
            <div className="flex items-center justify-between gap-2 p-4 rounded-xl border border-primary/10 bg-card">
              <div>
                <Label
                  className={
                    isDeprecated
                      ? "text-xs font-medium text-muted-foreground"
                      : "text-xs font-medium cursor-pointer"
                  }
                >
                  {t("aiSettings.configSheet.merchantActiveLabel")}
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  {isDeprecated
                    ? t("aiSettings.configSheet.deprecatedSwitchHint")
                    : t("aiSettings.configSheet.merchantActiveHint")}
                </p>
              </div>
              <Switch
                checked={formData.isMerchantActive}
                disabled={isDeprecated}
                onCheckedChange={(checked) => {
                  // নিয়ম ভাঙলে parent `false` দেয় আর কারণটা toast-এ দেখায় —
                  // তখন টগলটা নড়ে না, কারণ state-ই বদলানো হয় না।
                  if (onRequestMerchantActiveChange && !onRequestMerchantActiveChange(checked)) {
                    return;
                  }
                  setFormData({ ...formData, isMerchantActive: checked });
                }}
              />
            </div>

            {/* ── Deprecation Notice ──
                ⚠️ ক্যাটালগের টেবিলে ডিপ্রিকেটেড মডেলের পাশে লাল badge থাকে, কিন্তু
                Drawer খুললে ওই ইঙ্গিতটাই হারিয়ে যেত — admin একটা মৃত মডেলের
                Credit বদলে বেরিয়ে যেতেন, আর কিছুই বদলাত না। কারণটা এখন এখানেও
                লেখা থাকে, আর সাথে করণীয়টাও। */}
            {isDeprecated && (
              <div className="flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive/10 p-3.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-destructive">
                    {t("aiSettings.configSheet.deprecatedTitle")}
                  </p>
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    {t("aiSettings.configSheet.deprecatedHint")}
                  </p>
                </div>
              </div>
            )}

            {/* ── Credit Cost ──
                ⚠️ আগে এখানে দুটো কন্ট্রোল ছিল, দুটোই বাদ পড়েছে:

                ১. "Assigned Tier" (Economy 1 Cr / Standard 3 Cr / Premium 5 Cr) —
                   এর একমাত্র কাজ ছিল নিচের Credit ঘরটা 1/3/5 দিয়ে ভরে দেওয়া।
                   কিন্তু বিল হয় `credits` থেকে, DB-তে রাখা `tier` থেকে নয়; তাই
                   admin হাতে 10 বসালেই "Standard" লেবেলটা মিথ্যা হয়ে যেত, অথচ
                   Merchant ড্যাশবোর্ডে badge হিসেবে ঠিক ওই লেবেলটাই দেখানো হত।
                   এখন tier ফিল্ডটা DB-তে অটুট থাকে আর "Fetch Models"-এ দাম দেখে
                   নিজে থেকে ঠিক হয় — Admin-এর হাতে একটাই সৎ নিয়ন্ত্রণ: এই সংখ্যাটা।

                ২. "Max Output Tokens" ও "Context Window" — OpenRouter নিজে যে
                   ডিফল্ট দেয় সেটাই ঠিক থাকে; হাতে বদলানোর দরকার নেই। ফিল্ড দুটো
                   অবজেক্টে আগের মতোই থাকে (তাই `ai-models` API ও n8n পেলোড
                   অপরিবর্তিত), শুধু আর সম্পাদনাযোগ্য নয়। */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-primary" />
                {t("aiSettings.configSheet.creditTitle")}
              </h4>

              <div className="space-y-1.5">
                <Label htmlFor="model-credit-cost" className="text-xs">
                  {t("aiSettings.configSheet.creditPerReply")}
                </Label>
                <Input
                  id="model-credit-cost"
                  type="number"
                  min="1"
                  max="50"
                  value={formData.credits}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      credits: parseInt(e.target.value) || 1,
                      isManualOverride: true,
                    })
                  }
                  className="h-9 text-xs rounded-xl border-primary/20 font-mono font-bold text-primary"
                />
              </div>

              <p className="text-[10px] leading-relaxed text-muted-foreground">
                {t("aiSettings.configSheet.creditHint")}
              </p>
            </div>

            {/* ── Plan Access — এখানে আর নেই ──
                ⚠️ আগে এখানে চারটি plan-এর চেকবক্স ছিল ("এই মডেলটা কে পাবে")।
                সেটা তুলে দেওয়া হয়েছে, আর ইচ্ছে করেই কোনো নিয়ন্ত্রণ বসানো হয়নি:

                merchant মডেল বাছেন **tier** দিয়ে (Fast / Smart / Genius), model id
                দিয়ে নয়। তাই plan-প্রতি মডেল বন্ধ করার আসল প্রভাব পড়ত প্রিসেটের
                মধ্য দিয়ে — অর্থাৎ পরোক্ষে, আর admin পর্দায় যা দেখতেন তার সাথে
                merchant যা পেতেন তা মেলাতে দুটো আলাদা হিসাব লাগত।

                একমাত্র সীমানাটা এখন **মোডের**: Starter শুধু Simple (Guided),
                Starter-এর উপরের সব plan Simple + Pro — যত মডেল এখানে Merchant
                Active রাখা আছে, সবগুলো। নিয়মটা এক জায়গায়, এক প্রশ্নে:
                `canUseProMode` (`lib/domain/plan-config.ts`)।

                অর্থাৎ "এই মডেলটা কেউ পাবে না" বলতে চাইলে সঠিক নিয়ন্ত্রণ উপরের
                Merchant Active টগল — এটাই একমাত্র জায়গা। */}
          </form>
        </div>

        <SheetFooter className="pt-4 border-t border-border/40 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="rounded-xl text-xs"
          >
            {t("aiSettings.configSheet.cancel")}
          </Button>
          <Button
            type="submit"
            form="model-config-form"
            size="sm"
            disabled={saving}
            className="rounded-xl text-xs gap-1.5 bg-brand-gradient text-primary-foreground hover:opacity-90"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? t("aiSettings.configSheet.applying") : t("aiSettings.configSheet.apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
