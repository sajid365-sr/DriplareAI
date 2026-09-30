"use client";

import Link from "next/link";
import { ArrowUpRight, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/core/utils";
import { useRegion } from "@/components/region-provider";
import {
  canUseProMode,
  cheapestPaidPlan,
  getPlan,
  resolveLocalStr,
  type PlanKey,
} from "@/lib/domain/plan-config";

/**
 * LockedOverlay — Pro মোডের কার্ডটার গায়ের তালা।
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ কেন blur + overlay, শুধু disabled নয়:
 *
 *    নিষেধটা জানা উচিত **আগে**, সেভ চেপে error toast দেখার পরে নয়। তাই
 *    আটকানো জিনিসটাকে আটকানো হিসেবেই দেখানো হয়: কনটেন্ট blur করা (দেখা যায়,
 *    পড়া যায় না — অর্থাৎ "এটা আছে, কিন্তু এখন আপনার নয়"), আর উপরে তালা +
 *    কারণ + সোজা রাস্তা।
 *
 * ⚠️ এখানে আর মডেল-প্রতি তালা নেই। আগে `requiredPlan` কলার `pickRequiredPlan`
 *    দিয়ে মডেলের `allowedPlans` থেকে বের করত। এখন সীমানাটা মডেলের নয়,
 *    **মোডের** — Starter শুধু Simple (Guided), তার উপরের সবাই Simple + Pro।
 *    তাই দরকারি plan-এর নাম সর্বদা এক: `cheapestPaidPlan(region)`।
 */
interface LockedOverlayProps {
  /** কোন plan কিনলে এটা খোলে। */
  requiredPlan: PlanKey;
  /** Command-এর সারির মতো ছোট জায়গার জন্য সংক্ষিপ্ত রূপ। */
  compact?: boolean;
  className?: string;
}

/**
 * upgrade CTA-র গন্তব্য।
 *
 * ⚠️ plan key-টা query-তে যায়, যাতে payment page সঠিক plan আগেই বেছে রাখতে
 *    পারে — merchant-কে গিয়ে আবার খুঁজতে না হয়। মানটা সবসময়
 *    `cheapestPaidPlan(region)` থেকেই আসে, তাই BD-র merchant-কে কখনো এমন
 *    plan-এর নাম বলা হবে না যা তিনি কিনতেই পারেন না।
 */
function upgradeHref(plan: PlanKey) {
  return `/dashboard/payment?plan=${plan}&reason=pro_mode`;
}

export function LockedOverlay({ requiredPlan, compact = false, className }: LockedOverlayProps) {
  const { t, i18n } = useTranslation("chatbots");
  const { region } = useRegion();

  // plan-এর নাম admin-এর দেওয়া নামই — ভাষা অনুযায়ী (`resolveLocalStr`)।
  // তাই "Business" বাংলায় "বিজনেস" দেখায়, ঠিক pricing page-এ যেমন।
  const planName = resolveLocalStr(getPlan(region, requiredPlan).name, i18n.language);

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning",
          className
        )}
      >
        <Lock className="h-3 w-3" />
        {t("model_lock.badge", "Locked")}
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
        {t("model_lock.onPlan", { plan: planName, defaultValue: "Available on the {{plan}} plan" })}
      </span>

      {/* ⚠️ `nested` — কারণ এই কম্পোনেন্টটা প্রায়ই একটা `<button>`-এর ভেতরে
          বসে (tier কার্ড)। ভেতরে আবার `<button>` বসালে HTML অবৈধ হয়, আর
          React hydration-এ সেটা ধরা পড়ে। তাই CTA-টা `<Link>` রেখে কলারের
          বাইরের এলিমেন্টটাকে `relative` করা হয়েছে — ক্লিক আটকাতে
          `stopPropagation` লাগে, যা এখানেই বসানো। */}
      <Link
        href={upgradeHref(requiredPlan)}
        onClick={(event) => event.stopPropagation()}
        className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-brand-gradient px-2.5 py-1 text-[10px] font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
      >
        {t("model_lock.cta", { plan: planName, defaultValue: "Upgrade to {{plan}}" })}
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
 *    নাহলে blind user একটা "আটকানো" মোড বাছতে পারতেন।
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
 * Pro মোডটা এই plan-এ চলে কি না, আর না চললে কোন plan কিনতে হবে।
 *
 * ⚠️ দুটো উত্তর একই ফাংশনে, কারণ দুটো একই প্রশ্নের দুই দিক। আলাদা করে
 *    লিখলে একদিন একটা বদলে গিয়ে অন্যটা পুরনো থেকে যেত — আর তখন ড্যাশবোর্ড
 *    "Upgrade to Growth" বলত অথচ সার্ভার আটকাত, বা উল্টোটা।
 *
 * ⚠️ `requiredPlan` কখনো `undefined` নয়: Starter-এর উপরে প্রতিটি region-এ
 *    অন্তত একটা paid plan আছে (`cheapestPaidPlan`)। তাই "কোনো plan-এই নেই"
 *    অবস্থাটা আর সম্ভবপর নয় — যে অবস্থাটা আগে BD-র `growth`-কে ঘিরে ছিল।
 */
export function proModeLock(
  plan: string,
  region: Parameters<typeof cheapestPaidPlan>[0]
): { locked: boolean; requiredPlan: PlanKey } {
  return {
    locked: !canUseProMode(plan),
    requiredPlan: cheapestPaidPlan(region).key,
  };
}
