"use client";

import Link from "next/link";
import { ArrowUpRight, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/core/utils";
import { useRegion } from "@/components/region-provider";
import { getPlan, resolveLocalStr, type PlanKey } from "@/lib/domain/plan-config";
import { pickRequiredPlan } from "@/lib/domain/model-catalog";

/**
 * LockedOverlay — যে মডেল বা tier কার্ডটা merchant-এর plan-এ নেই তার গায়ের তালা।
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ কেন blur + overlay, শুধু disabled নয়:
 *
 *    ৩c-তে সার্ভার আটকানোর কাজ শেষ — কিন্তু তখনো merchant কার্ডে ক্লিক করে
 *    সেভ চাপলে কিছু সময় পর একটা error toast দেখতেন। অর্থাৎ নিষেধটা তিনি
 *    জানতেন সবার **পরে**, আর "কেন" জানতেন না। তাই আটকানো জিনিসটাকে আটকানো
 *    হিসেবেই দেখানো হয়: কনটেন্ট blur করা (দেখা যায়, পড়া যায় না — অর্থাৎ
 *    "এটা আছে, কিন্তু এখন আপনার নয়"), আর উপরে তালা + কারণ + সোজা রাস্তা।
 *
 * ⚠️ `requiredPlan` এখানে হিসাব করা হয় **না** — কলার `pickRequiredPlan`
 *    দিয়ে বের করে পাঠায়, কারণ সেই একই ফাংশন সার্ভারও চালায়। নাহলে
 *    ড্যাশবোর্ড "Business" বলত আর API "MODEL_NOT_IN_PLAN" — দুই কথা।
 *
 * ⚠️ `requiredPlan` না-ও থাকতে পারে: মডেলটা এই region-এ কোনো plan-এই
 *    পাওয়া যায় না (যেমন BD-তে `growth` নেই)। তখন plan-এর নাম বলার বদলে
 *    শুধু জানানো হয় — ভুল plan-এর নাম বলা তার চেয়ে খারাপ।
 */
interface LockedOverlayProps {
  /** কোন plan কিনলে এটা খোলে। `undefined` = এই region-এ কোনো plan-এই নেই। */
  requiredPlan?: PlanKey;
  /** Command-এর সারির মতো ছোট জায়গার জন্য সংক্ষিপ্ত রূপ। */
  compact?: boolean;
  className?: string;
}

/** upgrade CTA-র গন্তব্য — `usage`-এর অপ্রচলিত লিংকের সাথে একই আকার। */
function upgradeHref(plan?: PlanKey) {
  const base = "/dashboard/payment";
  return plan ? `${base}?plan=${plan}&reason=model_lock` : `${base}?reason=model_lock`;
}

export function LockedOverlay({ requiredPlan, compact = false, className }: LockedOverlayProps) {
  const { t, i18n } = useTranslation("chatbots");
  const { region } = useRegion();

  // plan-এর নাম admin-এর দেওয়া নামই — ভাষা অনুযায়ী (`resolveLocalStr`)।
  // তাই "Business" বাংলায় "বিজনেস" দেখায়, ঠিক pricing page-এ যেমন।
  const planName = requiredPlan
    ? resolveLocalStr(getPlan(region, requiredPlan).name, i18n.language)
    : "";

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning",
          className
        )}
      >
        <Lock className="h-3 w-3" />
        {planName || t("model_lock.badge", "Locked")}
      </span>
    );
  }

  return (
    // ⚠️ ইচ্ছে করেই কোনো `backdrop-blur` নেই: নিচের কনটেন্ট নিজেই blur করা
    //    থাকে, আর তার উপর দ্বিতীয় একটা blur বসালে দুই স্তরের ধোঁয়াশা হয়ে
    //    লেখাটাই পড়া যেত না।
    <span
      className={cn(
        "absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 rounded-[inherit] bg-card/70 p-2 text-center",
        className
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/80 text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
      </span>

      <span className="text-[11px] font-bold leading-tight text-foreground">
        {planName
          ? t("model_lock.onPlan", { plan: planName, defaultValue: "Available on the {{plan}} plan" })
          : t("model_lock.unavailable", "Not available on any plan here")}
      </span>

      {/* ⚠️ `nested` — কারণ এই কম্পোনেন্টটা প্রায়ই একটা `<button>`-এর ভেতরে
          বসে (tier কার্ড, মডেলের সারি)। ভেতরে আবার `<button>` বসালে HTML
          অবৈধ হয়, আর React hydration-এ সেটা ধরা পড়ে। তাই CTA-টা `<Link>`
          রেখে কলারের বাইরের এলিমেন্টটাকে `relative` করা হয়েছে — ক্লিক
          আটকাতে `stopPropagation` লাগে, যা এখানেই বসানো। */}
      <Link
        href={upgradeHref(requiredPlan)}
        onClick={(event) => event.stopPropagation()}
        className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-brand-gradient px-2.5 py-1 text-[10px] font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
      >
        {planName
          ? t("model_lock.cta", { plan: planName, defaultValue: "Upgrade to {{plan}}" })
          : t("model_lock.ctaGeneric", "See plans")}
        <ArrowUpRight className="h-2.5 w-2.5" />
      </Link>
    </span>
  );
}

/**
 * তালা বসানো কনটেন্ট — আসল blur এখানেই।
 *
 * ⚠️ `pointer-events-none` + `aria-hidden` একসাথে: তালা পড়া কার্ডের ভেতরের
 *    লেখা যেন স্ক্রিন-রিডারও না পড়ে, আর ক্লিক যেন উপরের overlay-এ গিয়ে পড়ে।
 *    নাহলে blind user একটা "আটকানো" মডেল বাছতে পারতেন।
 */
export function LockedContent({
  locked,
  children,
  className,
}: {
  locked: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(locked && "pointer-events-none select-none blur-[3px] opacity-60", className)}
      aria-hidden={locked || undefined}
    >
      {children}
    </div>
  );
}

/**
 * একটা মডেল বা tier এই plan-এ চলে কি না, আর না চললে কোন plan দরকার।
 *
 * ⚠️ এখানে `isModelAllowedForPlan` আলাদা করে ডাকা হয় **না** — কারণ
 *    "চলে কি না" আর "কোন plan দরকার" একই প্রশ্নের দুই দিক, আর
 *    `pickRequiredPlan` এর `undefined`-ই দ্বিতীয়টার উত্তর দেয়। দুটো আলাদা
 *    শর্ত লিখলে একদিন একটা বদলে গিয়ে অন্যটা পুরনো থেকে যেত।
 */
export function planLock(
  allowedPlans: readonly PlanKey[] | undefined,
  currentPlan: string,
  region: Parameters<typeof pickRequiredPlan>[1]
): { locked: boolean; requiredPlan?: PlanKey } {
  if (!allowedPlans || allowedPlans.length === 0) return { locked: false };
  if (allowedPlans.includes(currentPlan as PlanKey)) return { locked: false };

  return { locked: true, requiredPlan: pickRequiredPlan(allowedPlans, region) };
}
