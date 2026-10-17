"use client";

import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { CouponScope } from "@/lib/domain/pricing-catalogue";

import type { CouponDraft } from "./types";

/**
 * কুপন ব্যবস্থাপনা (১৫.৭)
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ এখানে **শতকরা ও স্থির ছাড়ের জন্য দুটো ঘর নেই, একটি `mode` ড্রপডাউন আছে** —
 *    কারণ `normalizeCatalogue` দুটোই থাকলে শতকরাকে জেতায়। দুটো ঘর থাকলে admin
 *    দুটোই ভরে বসে থাকতেন, আর পর্দায় একটি সংখ্যা দেখিয়ে কার্যত অন্য সংখ্যাটি
 *    খাটত — অর্থাৎ পর্দা মিথ্যা বলত।
 *
 * ⚠️ "কতবার ব্যবহার হয়েছে" সংখ্যাটি **লেজার থেকে** আসে (`properties.redemptions`),
 *    এই খসড়া থেকে নয়। কারণটি `countCouponRedemptions`-এর মন্তব্যে: একটি
 *    config-blob-এ গুনলে দুটি checkout একসাথে সংখ্যাটি হারাত।
 */
export function CouponEditor({
  coupons,
  redemptions,
  onChange,
  onAdd,
  onRemove,
}: {
  coupons: CouponDraft[];
  /** কোড → এখন পর্যন্ত সত্যিই কতবার ব্যবহৃত (paid transaction-এ গোনা)। */
  redemptions: Record<string, number>;
  onChange: (index: number, patch: Partial<CouponDraft>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const { t } = useTranslation("admin");

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">{t("pricing.coupon.title")}</CardTitle>
          <CardDescription>{t("pricing.coupon.desc")}</CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          data-testid="coupon-add"
          className="shrink-0 rounded-xl"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("pricing.coupon.add")}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {coupons.length === 0 && (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
            {t("pricing.coupon.empty")}
          </p>
        )}

        {coupons.map((coupon, index) => {
          const used = redemptions[coupon.code.trim().toUpperCase()] ?? 0;
          const limit = Number(coupon.maxRedemptions.trim());
          const exhausted =
            coupon.maxRedemptions.trim() !== "" &&
            Number.isInteger(limit) &&
            limit > 0 &&
            used >= limit;

          // ⚠️ `lg:grid-cols-12`-এ হাতে col-span বসানোর বদলে সমান-প্রস্থের
          //    একটি প্রবাহী গ্রিল — ৮টি ঘর ৪ কলামে ঠিক দুই সারিতে বসে, আর
          //    ছোট পর্দায় এক কলামে। হাতে span গুনলে একটি ঘর যোগ করামাত্র
          //    বিন্যাসটি ভেঙে যেত।
          return (
            <div
              key={index}
              className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2 xl:grid-cols-4"
              data-testid={`coupon-row-${index}`}
            >
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("pricing.coupon.code")}</Label>
                <Input
                  value={coupon.code}
                  // ⚠️ UPPER_CASE-এ normalize এখানেই — `findCoupon` বড় হাতের
                  //    অক্ষরে খোঁজে, তাই ছোট হাতের কোড সংরক্ষিত হলে কেউ সেটি
                  //    ব্যবহারই করতে পারত না।
                  onChange={(event) =>
                    onChange(index, { code: event.target.value.toUpperCase() })
                  }
                  placeholder="EID25"
                  spellCheck={false}
                  className="rounded-lg font-mono tracking-wider"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("pricing.coupon.mode")}</Label>
                <select
                  value={coupon.mode}
                  onChange={(event) =>
                    onChange(index, { mode: event.target.value as CouponDraft["mode"] })
                  }
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm"
                >
                  <option value="percent">{t("pricing.coupon.percent")}</option>
                  <option value="amount">{t("pricing.coupon.amount")}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {coupon.mode === "percent"
                    ? t("pricing.coupon.percentValue")
                    : t("pricing.coupon.amountValue")}
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={coupon.mode === "percent" ? 100 : undefined}
                  inputMode="numeric"
                  value={coupon.value}
                  onChange={(event) => onChange(index, { value: event.target.value })}
                  className="rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("pricing.coupon.appliesTo")}</Label>
                <select
                  value={coupon.appliesTo}
                  onChange={(event) =>
                    onChange(index, { appliesTo: event.target.value as CouponScope })
                  }
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm"
                >
                  <option value="both">{t("pricing.coupon.scope.both")}</option>
                  <option value="plan">{t("pricing.coupon.scope.plan")}</option>
                  <option value="topup">{t("pricing.coupon.scope.topup")}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("pricing.coupon.max")}</Label>
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={coupon.maxRedemptions}
                  placeholder={t("pricing.coupon.unlimited")}
                  onChange={(event) =>
                    onChange(index, { maxRedemptions: event.target.value })
                  }
                  className="rounded-lg"
                />
                {/* ⚠️ ব্যবহারের সংখ্যাটি সীমা থাকুক বা না থাকুক **সবসময়**
                    দেখানো হয় — কারণ "কতবার খরচ হলো" একটি কুপন বানানোর পর
                    admin-এর প্রথম প্রশ্ন, আর সংখ্যাটি গোপন থাকলে তিনি অন্ধভাবে
                    সীমা বাড়াতেন। */}
                <p className="text-[10px] text-muted-foreground">
                  {exhausted
                    ? t("pricing.coupon.exhausted", { used })
                    : t("pricing.coupon.used", { used })}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("pricing.coupon.expiresAt")}</Label>
                <Input
                  type="date"
                  value={coupon.expiresAt}
                  onChange={(event) => onChange(index, { expiresAt: event.target.value })}
                  className="rounded-lg"
                />
                <p className="text-[10px] text-muted-foreground">
                  {t("pricing.coupon.expiresHint")}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t("pricing.coupon.active")}</Label>
                <div className="flex h-9 items-center">
                  <Switch
                    checked={coupon.isActive}
                    onCheckedChange={(checked) => onChange(index, { isActive: checked })}
                    data-testid={`coupon-active-${index}`}
                  />
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(index)}
                  data-testid={`coupon-remove-${index}`}
                  className="w-full rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  {t("pricing.coupon.remove")}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
