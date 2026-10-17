"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Coins, Lock, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePricing, useRegion } from "@/components/region-provider";
import { PAYMENT_PACKAGES } from "@/lib/domain/payment-packages";
import { formatPrice } from "@/lib/domain/pricing-catalogue";

/**
 * Top-up কার্ড (১৫.৭)
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ **এখানে pack-তালিকার একটি নকল কপি ছিল** — `topup_50k_business_bdt: 400`
 *    জাতীয় সংখ্যা হাতে লেখা, অথচ ঠিক সেই pack-গুলোর আসল সংখ্যা
 *    `PAYMENT_PACKAGES`-এ আছে (`lib/domain/payment-packages.ts`) এবং সেটিই
 *    checkout-এ চার্জের ভিত্তি।
 *
 *    **সৎভাবে: মুছে ফেলার সময় পাঁচটি pack-এর দাম ও credit-সংখ্যা হুবহু মিলেছিল**
 *    — অর্থাৎ কপিটি তখন ভুল কিছু বলেনি, এবং "পর্দায় ৳৪০০ দেখিয়ে ৳৫০০ কাটা
 *    যেত" জাতীয় কোনো ঘটনা ঘটেনি। সমস্যাটি ছিল **সম্ভাবনা**, ঘটনা নয়। কিন্তু
 *    এখন থেকে কপিটির জন্য ভুল হওয়াটা **অবশ্যম্ভাবী**: admin `/admin/pricing` থেকে
 *    top-up-এর দাম বদলাতে পারেন, আর checkout (`resolveCheckoutAmount`) সেই নতুন
 *    সংখ্যাই চার্জ করবে — অথচ এই হাতে-লেখা তালিকা ও override-এর কথা জানার কোনো
 *    উপায়ই রাখে না। তখন পর্দা পুরনো দাম দেখাত, আর গ্রাহক বেশি টাকা দিতেন।
 *    এখন তালিকা একটি, আর দাম admin-এর ক্যাটালগ-অনুযায়ী context থেকে।
 *
 * ⚠️ `topUpPrice()` ডাকা হয় **আসল** ডিফল্ট amount-টি দিয়ে (`pkg.amount`), যাতে
 *    admin একটি override বসালে সেটিই দেখায়, আর না বসালে ঠিক checkout-এর
 *    সংখ্যাটিই দেখায়।
 */

interface TopUpCardsProps {
  currentPlan: string;
  loadingPackage: string | null;
  onBuy: (packageId: string) => void;
}

export function TopUpCards({ currentPlan, loadingPackage, onBuy }: TopUpCardsProps) {
  const { t, i18n } = useTranslation("payment");
  const { region } = useRegion();
  const { topUpPrice } = usePricing();
  const normalizedPlan = currentPlan.toLowerCase();

  const isEligible = normalizedPlan === "business" || normalizedPlan === "enterprise";

  // Filter packages based on current plan, or show business ones as preview if not eligible
  const activePlanType = isEligible ? (normalizedPlan as "business" | "enterprise") : "business";

  const filteredPackages = useMemo(
    () =>
      Object.entries(PAYMENT_PACKAGES)
        .filter(([, pkg]) => pkg.isTopUp === true && pkg.plan === activePlanType)
        .map(([id, pkg]) => ({
          id,
          plan: pkg.plan,
          credits: pkg.topUpCredits ?? 0,
          // catalogue-অনুযায়ী দাম — checkout-এর সঙ্গে হুবহু একই হিসাব
          price: topUpPrice(id, pkg.amount),
        })),
    [activePlanType, topUpPrice]
  );

  return (
    <div className="space-y-6 mt-10">
      <div className="flex flex-col gap-1 border-t border-border/60 pt-8">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Coins className="w-5 h-5 text-primary" />
          {t("topUp.title", "Buy Top-up Credits")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("topUp.desc", "Top-up credits never expire and roll over to the next billing cycle.")}
        </p>
      </div>

      <div className="relative rounded-2xl overflow-hidden p-0.5 bg-gradient-to-br from-border/50 to-border/10">
        {!isEligible && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-md z-10 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 mb-3 border border-amber-500/20">
              <Lock className="w-5 h-5" />
            </div>
            <p className="font-semibold text-foreground max-w-sm">
              {t("topUp.locked", "Credit Top-up is only available for Business and Enterprise plans.")}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 p-6 bg-card rounded-[14px]">
          {filteredPackages.map((p, i) => {
            const isLoading = loadingPackage === p.id;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex flex-col p-6 rounded-xl border border-border bg-background/50 hover:border-primary/30 transition-all shadow-sm relative overflow-hidden group"
              >
                {/* Background glow hover effect */}
                <div className="absolute inset-0 -translate-y-full group-hover:translate-y-0 bg-gradient-to-t from-primary/5 to-transparent transition-transform duration-300 pointer-events-none" />

                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold bg-muted px-2 py-0.5 rounded text-muted-foreground uppercase">
                    {p.plan}
                  </span>
                </div>

                <div className="font-bold text-lg mb-1">
                  {t("topUp.creditsCount", "{{val}} Credits", { val: p.credits.toLocaleString() })}
                </div>

                <div className="text-3xl font-extrabold tracking-tight text-foreground my-4">
                  {/* ⚠️ `formatPrice` — বাংলায় "৳৪০০", ইংরেজিতে "৳400"। আগে
                      `toLocaleString()` হাতে বসানো হত, ফলে বাংলায় অঙ্কগুলো
                      ইংরেজিতেই থেকে যেত, অথচ পাশের plan-কার্ডে বাংলা অঙ্ক। */}
                  {formatPrice(p.price, region, i18n.language)}
                </div>

                <Button
                  onClick={() => onBuy(p.id)}
                  disabled={!isEligible || !!loadingPackage}
                  className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground mt-auto relative z-10 transition-all"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    t("topUp.buyNow", "Buy Now")
                  )}
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
