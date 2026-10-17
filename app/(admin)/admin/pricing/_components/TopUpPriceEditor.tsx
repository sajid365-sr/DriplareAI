"use client";

import { useTranslation } from "react-i18next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getPaymentPackage } from "@/lib/domain/payment-packages";

import { TOP_UP_PACKAGE_IDS } from "./types";

/**
 * Top-up pack-এর দাম (১৫.৭)
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ top-up-এর দাম **region-ভেদে আলাদা নয়** — সব pack BDT-তে, কারণ UddoktaPay
 *    BDT-only আর Global region-এ gateway নেই। তাই এখানে region প্যানেল নেই;
 *    একটি প্যানেলই সত্যি বলছে।
 *
 * ⚠️ এই পর্দাটি কেবল **দাম** বদলায়, credit সংখ্যা নয়। credit-এর source of
 *    truth `PAYMENT_PACKAGES` (কোড), আর সেটি বদলানো মানে একটি ভিন্ন পণ্য —
 *    যা কোড-পরিবর্তন ও deploy-এর কাজ, admin টগলের নয়।
 */
export function TopUpPriceEditor({
  rows,
  onChange,
}: {
  rows: Record<string, string>;
  onChange: (packageId: string, value: string) => void;
}) {
  const { t } = useTranslation("admin");

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base">{t("pricing.topUp.title")}</CardTitle>
        <CardDescription>{t("pricing.topUp.desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOP_UP_PACKAGE_IDS.map((packageId) => {
            const pkg = getPaymentPackage(packageId);
            if (!pkg) return null;

            return (
              <div key={packageId} className="space-y-1.5">
                <label
                  htmlFor={`topup-${packageId}`}
                  className="block text-xs font-medium text-foreground"
                >
                  {t("pricing.topUp.credits", {
                    credits: (pkg.topUpCredits ?? 0).toLocaleString("en-US"),
                    plan: pkg.plan,
                  })}
                </label>
                <Input
                  id={`topup-${packageId}`}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={rows[packageId] ?? ""}
                  placeholder={String(pkg.amount)}
                  onChange={(event) => onChange(packageId, event.target.value)}
                  data-testid={`topup-${packageId}`}
                  className="h-9 rounded-lg"
                />
                <p className="text-[11px] text-muted-foreground">{packageId}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
