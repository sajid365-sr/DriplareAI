import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Check, Loader2, Clock, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveLocalStr, type PlanConfig } from "@/lib/domain/plan-config";
import { PLAN_ICONS, PLAN_HIERARCHY } from "./constants";

interface PricingCardsProps {
  plans: PlanConfig[];
  currentPlan: string;
  usage: any;
  loadingPlan: string | null;
  loadingDowngradePlan: string | null;
  canDowngradeTo: (planKey: string) => boolean;
  checkout: (plan: PlanConfig) => void;
  handleDowngradeClick: (planKey: string) => void;
}

export function PricingCards({
  plans,
  currentPlan,
  usage,
  loadingPlan,
  loadingDowngradePlan,
  canDowngradeTo,
  checkout,
  handleDowngradeClick,
}: PricingCardsProps) {
  const { t, i18n } = useTranslation("payment");
  const isBn = i18n.language === "bn";

  return (
    <div className="grid md:grid-cols-4 gap-5">
      {plans.map((plan, i) => {
        const Icon = PLAN_ICONS[plan.key as keyof typeof PLAN_ICONS] || Sparkles;
        const isCurrent = currentPlan === plan.key;
        const isUpgrade =
          PLAN_HIERARCHY.indexOf(plan.key) >
          PLAN_HIERARCHY.indexOf(currentPlan);
        const isDowngrade = canDowngradeTo(plan.key);
        const isDowngradeLoading = loadingDowngradePlan === plan.key;

        // If scheduled downgrade targets this plan, show as pending
        const isScheduledTarget = usage?.scheduledDowngradePlan === plan.key;

        return (
          <motion.div
            key={plan.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className={`relative flex flex-col p-7 rounded-2xl bg-card border ${
              plan.featured
                ? "border-primary shadow-xl md:-translate-y-3"
                : "border-border"
            } ${isScheduledTarget ? "ring-2 ring-amber-500/40" : ""}`}
            data-testid={`pay-tier-${plan.key}`}
          >
            {/* Badges */}
            {plan.featured && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
                {t("mostPopular")}
              </div>
            )}
            {isScheduledTarget && !plan.featured && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {isBn ? "নির্ধারিত" : "Scheduled"}
              </div>
            )}

            {/* Plan icon & name */}
            <div className="flex items-center gap-2 mb-1">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Icon className="w-4 h-4" />
              </div>
              <div className="font-semibold text-lg">
                {resolveLocalStr(plan.name, i18n.language)}
              </div>
            </div>

            {/* Price */}
            <div className="text-4xl font-bold tracking-tighter mt-4">
              {resolveLocalStr(plan.priceLabel, i18n.language)}
              {!plan.contact && plan.key !== "starter" && (
                <span className="text-sm font-normal text-muted-foreground">
                  /{isBn ? "মাস" : "mo"}
                </span>
              )}
            </div>

            {/* Features */}
            <ul className="space-y-2.5 mt-5 flex-grow">
              {plan.features.map(
                (f: string | { en: string; bn: string }, idx: number) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    {resolveLocalStr(f, i18n.language)}
                  </li>
                )
              )}
              {plan.key !== "starter" && plan.key !== "enterprise" && (
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                  {resolveLocalStr(plan.perMessageLabel, i18n.language)}{" "}
                  {t("perMsgAfterQuota")}
                </li>
              )}
            </ul>

            {/* Action buttons */}
            <div className="mt-6 flex flex-col gap-2">
              {/* Primary CTA */}
              <Button
                className={`w-full rounded-full ${
                  plan.featured
                    ? "bg-primary hover:bg-primary/90 text-white"
                    : ""
                }`}
                variant={plan.featured ? "default" : "outline"}
                disabled={
                  !!loadingPlan ||
                  !!loadingDowngradePlan ||
                  isCurrent ||
                  isDowngrade
                }
                onClick={() =>
                  isUpgrade && !plan.contact
                    ? checkout(plan)
                    : plan.contact
                    ? checkout(plan)
                    : undefined
                }
                data-testid={`pay-cta-${plan.key}`}
              >
                {loadingPlan === plan.key ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isCurrent ? (
                  t("currentPlanBadge")
                ) : plan.contact ? (
                  t("contactUs")
                ) : isDowngrade ? (
                  <span className="text-muted-foreground text-xs">
                    {isBn ? "নিচের প্ল্যান" : "Lower plan"}
                  </span>
                ) : (
                  `${isBn ? "আপগ্রেড" : "Upgrade"} — ${resolveLocalStr(
                    plan.priceLabel,
                    i18n.language
                  )}`
                )}
              </Button>

              {/* Downgrade button (shown for plans below current) */}
              {isDowngrade && (
                <button
                  onClick={() => handleDowngradeClick(plan.key)}
                  disabled={!!loadingDowngradePlan || !!loadingPlan}
                  className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-amber-500 transition-colors uppercase tracking-widest text-center mt-1 disabled:opacity-50"
                  data-testid={`pay-downgrade-${plan.key}`}
                >
                  {isDowngradeLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  {isBn
                    ? `${plan.key.toUpperCase()}-এ নামুন`
                    : `Downgrade to ${plan.key}`}
                </button>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
