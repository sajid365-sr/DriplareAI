"use client";

import { motion } from "framer-motion";
import { Sparkles, Zap, Crown, Building2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

/**
 * প্রতিটি plan-এর রঙ **CSS variable দিয়ে** (`globals.css`), হার্ডকোড palette
 * নয় (AGENTS.md §3) — তাই Dark ও Light-এ মান আলাদা করে বসানো থাকে, আর থিম
 * বদলালে এখানে হাত দিতে হয় না।
 *
 * ⚠️ badge-এ solid token (`bg-warning text-warning-foreground`), tint নয়:
 *    `text-warning` একটি ১০% টিন্টের উপর ছোট (text-xs) লেখায় পড়লে contrast
 *    যথেষ্ট নয়। `-foreground` ভেরিয়েবলগুলো ঠিক সেই কারণেই আছে।
 */
interface PlanMeta {
  label: string;
  icon: LucideIcon;
  /** আইকন-বর্গের রঙ (বড় আইকন, তাই টিন্টই যথেষ্ট)। */
  tint: string;
  /** "Active" / "Trial" ব্যাজের রঙ (ছোট লেখা, তাই solid)। */
  badge: string;
}

const PLAN_META: Record<string, PlanMeta> = {
  starter: {
    label: "Starter",
    icon: Sparkles,
    tint: "bg-muted text-muted-foreground",
    badge: "bg-muted text-foreground",
  },
  growth: {
    label: "Growth",
    icon: Zap,
    tint: "bg-primary/10 text-primary",
    badge: "bg-primary text-primary-foreground",
  },
  business: {
    label: "Business",
    icon: Crown,
    tint: "bg-warning/10 text-warning",
    badge: "bg-warning text-warning-foreground",
  },
  enterprise: {
    label: "Enterprise",
    icon: Building2,
    tint: "bg-info/10 text-info",
    badge: "bg-info text-info-foreground",
  },
};

interface CurrentPlanProps {
  usage: any;
}

export function CurrentPlan({ usage }: CurrentPlanProps) {
  const router = useRouter();
  const { t } = useTranslation("settings");

  const plan     = usage?.plan || "starter";
  const planMeta = PLAN_META[plan] || PLAN_META.starter;
  const PlanIcon = planMeta.icon;

  // ⚠️ `planExpiresAt` থাকলেই "Renews on" লেখা যেত না (১৫.৬): trial-এর মেয়াদও
  //    ঠিক এই কলামেই বসে, অথচ সেখানে নবায়ন হয় না — সেবা বন্ধ হয়। কোনটি তা
  //    সার্ভারেই ঠিক হয় (`/api/usage` → `planIsTrial`)।
  const isTrial = usage?.planIsTrial === true;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
      className="p-6 rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">{t("profile.currentPlan", "Current Plan")}</h3>
        <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary"
          onClick={() => router.push("/dashboard/payment")}>{t("profile.manage", "Manage →")}</Button>
      </div>
      <div className="flex items-center gap-4 mt-4">
        <div className={`p-3 rounded-xl ${planMeta.tint}`}>
          <PlanIcon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold capitalize">{planMeta.label}</span>
            {isTrial ? (
              <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${planMeta.badge}`}>
                {t("profile.trial", "Trial")}
              </span>
            ) : (
              plan !== "starter" && (
                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${planMeta.badge}`}>
                  {t("profile.active", "Active")}
                </span>
              )
            )}
          </div>
          {usage?.planExpiresAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {isTrial
                ? t("profile.trialEndsOn", "Free trial ends on {{date}}", { date: format(new Date(usage.planExpiresAt), "MMMM d, yyyy") })
                : t("profile.renewsOn", "Renews on {{date}}", { date: format(new Date(usage.planExpiresAt), "MMMM d, yyyy") })}
            </p>
          )}
        </div>
      </div>
      {usage && (
        <div className="mt-5 pt-5 border-t border-border">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>{t("profile.creditUsage", "Credit Usage this cycle")}</span>
            <span>{usage.creditsUsedThisCycle ?? 0} / {usage.includedCreditsTotal === Infinity ? "∞" : (usage.includedCreditsTotal ?? 500)}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-brand-gradient rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.round(((usage.creditsUsedThisCycle ?? 0) / (usage.includedCreditsTotal || 1)) * 100))}%` }}
              transition={{ duration: 1 }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
