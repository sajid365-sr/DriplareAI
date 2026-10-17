"use client";

import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

import { usePricing } from "@/components/region-provider";
import type { BillingCycle } from "@/lib/domain/billing-cycle";

/**
 * মাসিক ⇄ বার্ষিক টগল (১৫.৭)
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ একটি **controlled** component — cycle নিজে ধরে রাখে না, parent-এর state।
 *    কারণ যে সংখ্যাটি এখানে বদলানো হচ্ছে (দাম) সেটি কার্ডের ভিতরে, আর দুটি
 *    component একসাথে একটি state ধরে রাখলে সেগুলো একদিন আলাদা হয়ে যেত।
 *
 * ⚠️ ছাড়ের শতাংশটি পর্দায় লেখা হয় (`annualDiscountPercent`), কারণ বার্ষিক
 *    বেছে নেওয়ার পুরো কারণটিই ছাড়। এটি **ক্যাটালগ থেকে** আসে, হার্ডকড নয়:
 *    admin ছাড় ২৫% → ৪০% করলে পর্দার লেখাও সাথে সাথে বদলায়, নইলে পর্দা
 *    একটি মিথ্যা বিজ্ঞাপন দেখাত (৪০% চার্জ করে "২৫% সাশ্রয়" লেখা থাকত)।
 *
 * ⚠️ `role="tablist"` ব্যবহার করা হয়েছে কারণ এখানে সত্যিই দুই অবস্থার একটি
 *    পছন্দ — আর screen reader-এর কাছে "button" বললে বোঝা যেত না কোনটি এখন
 *    বেছে আছে। `aria-selected` সেটিই জানায়।
 */
export function CycleToggle({
  cycle,
  onCycleChange,
  disabled = false,
}: {
  cycle: BillingCycle;
  onCycleChange: (cycle: BillingCycle) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation("payment");
  const { annualDiscountPercent } = usePricing();

  const options: BillingCycle[] = ["monthly", "yearly"];

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div
        role="tablist"
        aria-label={t("cycle.label", "Billing cycle")}
        className="inline-flex items-center rounded-full border border-border bg-muted/40 p-1"
      >
        {options.map((option) => {
          const selected = cycle === option;
          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => onCycleChange(option)}
              data-testid={`pay-cycle-${option}`}
              className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                selected ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {/* ⚠️ `layoutId`-এর পেছনের pill — Framer Motion-এর shared layout
                  animation, তাই নির্বাচিত অবস্থাটি দুই বাটনের মাঝে সরে যায়
                  (একটি আলাদা background div কে translate করার বদলে)। */}
              {selected && (
                <motion.span
                  layoutId="cycle-pill"
                  className="absolute inset-0 rounded-full bg-primary shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative z-10">
                {t(`cycle.${option}`, option === "monthly" ? "Monthly" : "Yearly")}
              </span>
            </button>
          );
        })}
      </div>

      {cycle === "yearly" && annualDiscountPercent > 0 && (
        <p className="text-xs font-medium text-primary">
          {t("cycle.saving", {
            percent: annualDiscountPercent,
            defaultValue: "Save {{percent}}% with annual billing",
          })}
        </p>
      )}
    </div>
  );
}
