"use client";

import { motion } from "framer-motion";
import { Sparkles, Zap, Crown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

const PLAN_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  starter:    { label: "Starter",    icon: Sparkles,   color: "text-muted-foreground", bg: "bg-muted" },
  growth:     { label: "Growth",     icon: Zap,        color: "text-violet-500",        bg: "bg-violet-500/10" },
  business:   { label: "Business",   icon: Crown,      color: "text-amber-500",         bg: "bg-amber-500/10" },
  enterprise: { label: "Enterprise", icon: Building2,  color: "text-sky-500",           bg: "bg-sky-500/10" },
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

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
      className="p-6 rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">{t("profile.currentPlan", "Current Plan")}</h3>
        <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary"
          onClick={() => router.push("/dashboard/payment")}>{t("profile.manage", "Manage →")}</Button>
      </div>
      <div className="flex items-center gap-4 mt-4">
        <div className={`p-3 rounded-xl ${planMeta.bg}`}>
          <PlanIcon className={`w-6 h-6 ${planMeta.color}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold capitalize">{planMeta.label}</span>
            {plan !== "starter" && (
              <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${planMeta.bg} ${planMeta.color}`}>
                {t("profile.active", "Active")}
              </span>
            )}
          </div>
          {usage?.planExpiresAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("profile.renewsOn", "Renews on {{date}}", { date: format(new Date(usage.planExpiresAt), "MMMM d, yyyy") })}
            </p>
          )}
        </div>
      </div>
      {usage && (
        <div className="mt-5 pt-5 border-t border-border">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>{t("profile.messageUsage", "Message Usage this cycle")}</span>
            <span>{usage.messagesUsedThisCycle ?? 0} / {usage.includedMessagesTotal ?? 50}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-fuchsia-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.round(((usage.messagesUsedThisCycle ?? 0) / (usage.includedMessagesTotal ?? 50)) * 100))}%` }}
              transition={{ duration: 1 }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
