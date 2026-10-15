"use client";

import { useTranslation } from "react-i18next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Region } from "@/lib/core/region";
import { getPlansForRegion, resolveLocalStr } from "@/lib/domain/plan-config";
import { formatPrice } from "@/lib/domain/pricing-catalogue";

import { REGION_LABEL_KEY, type PlanPriceDraft } from "./types";

/**
 * প্রতি-region ছাড়ের প্যানেল (১৫.৭)
 * ─────────────────────────────────────────────────────────────────────────────
 * দুটি আলাদা ধারণা, একটি প্যানেলে — কারণ দুটোই region-ভিত্তিক আর দুটোই "সব
 * merchant-এর জন্য":
 *
 * · **সবার জন্য ছাড় (%)** — checkout-এ বসে (`resolveCheckoutAmount`)। পর্দায়
 *   কাটা দাম হিসেবে দেখা যায়, পাশে আসল দাম।
 * · **বার্ষিক ছাড় (%)** — plan-এর বার্ষিক দাম বের করার ভিত্তি
 *   (`resolveListPrice`)। ২৫ মানে "১২ মাসের দাম = ৯ মাসের দাম"।
 *
 * ⚠️ দুটোই **আলাদা** রাখা হয়েছে, একটি করে দেওয়া হয়নি: admin যদি সব merchant-কে
 *    ২০% ছাড় দিতে চান, সেটি বার্ষিক ছাড় নয় — বার্ষিক ছাড় না বদলালে দুই ছাড়
 *    গুণ হয়ে ৪০% হয়ে যেত, অথচ admin ২০% চেয়েছিলেন।
 */
export function DiscountEditor({
  region,
  discountPercent,
  annualDiscountPercent,
  onDiscountChange,
  onAnnualChange,
}: {
  region: Region;
  discountPercent: string;
  annualDiscountPercent: string;
  onDiscountChange: (value: string) => void;
  onAnnualChange: (value: string) => void;
}) {
  const { t, i18n } = useTranslation("admin");
  const lang = i18n.language;

  // ⚠️ উদাহরণটি **এই region-এর প্রথম সক্রিয় plan** দিয়ে — হার্ডকড "স্টার্টার"
  //    দিয়ে নয়, কারণ Global region-এর plan-তালিকা সম্পূর্ণ আলাদা।
  const sample = getPlansForRegion(region).find((plan) => plan.contact !== true);
  const annual = Number(annualDiscountPercent);
  const monthly = sample?.price ?? 0;
  const yearlyList = Math.round((monthly * 12 * (100 - annual)) / 100);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base">{t(REGION_LABEL_KEY[region])}</CardTitle>
        <CardDescription>{t("pricing.discount.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`discount-${region}`} className="text-xs font-medium">
            {t("pricing.field.discount")}
          </Label>
          <Input
            id={`discount-${region}`}
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            value={discountPercent}
            onChange={(event) => onDiscountChange(event.target.value)}
            data-testid={`discount-${region}`}
            className="rounded-xl"
          />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t("pricing.discount.globalHint")}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`annual-${region}`} className="text-xs font-medium">
            {t("pricing.field.annualDiscount")}
          </Label>
          <Input
            id={`annual-${region}`}
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            value={annualDiscountPercent}
            onChange={(event) => onAnnualChange(event.target.value)}
            data-testid={`annual-discount-${region}`}
            className="rounded-xl"
          />
          {/* ⚠️ এই লাইনটিই admin-কে বলে দেয় তাঁর শতাংশ আসলে কী করছে —
              একটি সংখ্যা একা পড়া যায়, কিন্তু "১২ মাসের দাম = ৯ মাসের" জাতীয়
              ফলাফল পড়া যায়, আর সেটিই তিনি সত্যিই স্থির করছেন। */}
          {sample && !Number.isNaN(annual) && annual > 0 && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t("pricing.discount.annualExample", {
                plan: resolveLocalStr(sample.name, lang),
                monthly: formatPrice(monthly, region, lang),
                yearly: formatPrice(yearlyList, region, lang),
              })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * প্রতি-plan দামের সারণি (১৫.৭)
 *
 * ⚠️ **ফাঁকা ঘর = "কোডের ডিফল্ট দাম"** — এবং কলামের প্লেসহোল্ডারেই ডিফল্টটি
 *    দেখানো হয়। নইলে admin জানতেনই না কোন মানটি এখন চলছে, আর দুটি সংখ্যার
 *    (কোডের ও DB-র) তুলনা করতে পারতেন না।
 */
export function PlanPriceEditor({
  region,
  rows,
  onPriceChange,
  onHiddenChange,
}: {
  region: Region;
  rows: Record<string, PlanPriceDraft>;
  onPriceChange: (planKey: string, cycle: "monthly" | "yearly", value: string) => void;
  onHiddenChange: (planKey: string, hidden: boolean) => void;
}) {
  const { t } = useTranslation("admin");

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{t(REGION_LABEL_KEY[region])}</h3>
        <p className="text-[11px] text-muted-foreground">{t("pricing.plan.placeholderHint")}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">{t("pricing.plan.name")}</th>
              <th className="px-4 py-2.5 text-left font-medium">{t("pricing.cycle.monthly")}</th>
              <th className="px-4 py-2.5 text-left font-medium">{t("pricing.cycle.yearly")}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t("pricing.plan.hidden")}</th>
            </tr>
          </thead>
          <tbody>
            {getPlansForRegion(region).map((plan) => {
              const row = rows[plan.key];
              if (!row) return null;

              return (
                <tr key={plan.key} className="border-t border-border">
                  <td className="px-4 py-3">
                    <span className="font-medium">{plan.key}</span>
                    {plan.contact === true && (
                      // নেগোসিয়েটেড tier-এর দাম নেই — একটি ঘর দিলে admin কিছু
                      // লিখতেন যা কোনো হিসাবে ঢুকত না।
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {t("pricing.plan.negotiated")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={row.monthly}
                      disabled={plan.contact === true}
                      placeholder={String(plan.price)}
                      onChange={(event) =>
                        onPriceChange(plan.key, "monthly", event.target.value)
                      }
                      data-testid={`plan-${region}-${plan.key}-monthly`}
                      className="h-9 w-32 rounded-lg"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={row.yearly}
                      disabled={plan.contact === true}
                      // বার্ষিক দাম না দিলে ছাড় থেকে গণনা হয় — তাই "স্বয়ংক্রিয়"
                      placeholder={t("pricing.plan.auto")}
                      onChange={(event) =>
                        onPriceChange(plan.key, "yearly", event.target.value)
                      }
                      data-testid={`plan-${region}-${plan.key}-yearly`}
                      className="h-9 w-32 rounded-lg"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Switch
                      checked={row.hidden}
                      onCheckedChange={(checked) => onHiddenChange(plan.key, checked)}
                      data-testid={`plan-${region}-${plan.key}-hidden`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
