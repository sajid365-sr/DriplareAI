"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Check, Loader2, Sparkles, Zap, Crown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRegion } from "@/components/region-provider";
import { getPlansForRegion, resolveLocalStr, type PlanConfig } from "@/lib/plan-config";

const PLAN_ICONS = {
  starter: Sparkles,
  growth: Zap,
  business: Crown,
  enterprise: Building2,
};

export default function Payment() {
  const { t, i18n } = useTranslation();
  const { region, config: regionConfig } = useRegion();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ plan?: string } | null>(null);

  const currentPlan = usage?.plan || "starter";
  const plans = getPlansForRegion(region);
  const isBn = i18n.language === "bn";

  useEffect(() => {
    fetch("/api/usage")
      .then((response) => response.json())
      .then((data) => setUsage(data))
      .catch(() => {});
  }, []);

  const checkout = async (plan: PlanConfig) => {
    if (plan.contact) {
      toast.info("Email sales@driplare.com to discuss Enterprise plans");
      return;
    }
    if (plan.key === "starter") {
      toast.info("You're on the Starter plan");
      return;
    }
    setLoadingPlan(plan.key);
    try {
      const origin_url = window.location.origin;

      if (regionConfig.paymentGateway === "stripe") {
        // Global → Stripe
        const r = await fetch("/api/payments/checkout/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ package_id: `${plan.key}_usd`, origin_url }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Checkout failed");
        if (data.url) window.location.assign(data.url);
      } else {
        // BD → Uddoktapay
        const r = await fetch("/api/payments/uddoktapay/charge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ package_id: `${plan.key}_bdt`, origin_url }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Checkout failed");
        if (data.url) window.location.assign(data.url);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Checkout failed";
      toast.error(message);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-3 p-1.5 pr-4 rounded-2xl bg-muted/30 border border-border/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background/50 border border-border shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("common.status", "Subscription")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              const Icon = PLAN_ICONS[currentPlan as keyof typeof PLAN_ICONS] || Sparkles;
              return (
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-primary to-purple-600 text-white shadow-lg shadow-primary/20 transition-all hover:scale-105 cursor-default">
                  <Icon className="w-3.5 h-3.5" />
                  <span className="font-bold capitalize text-sm tracking-tight">{currentPlan}</span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Payment gateway info */}
      <div className="text-xs text-muted-foreground">
        {regionConfig.paymentGateway === "stripe"
          ? "Powered by Stripe — secure global payments"
          : "Powered by Uddoktapay — bKash, Nagad, Rocket, cards (Bangladesh)"}
      </div>

      <div className="grid md:grid-cols-4 gap-5">
        {plans.map((plan, i) => {
          const Icon = PLAN_ICONS[plan.key] || Sparkles;
          const isCurrent = currentPlan === plan.key;

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
              }`}
              data-testid={`pay-tier-${plan.key}`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
                  {t("pricing.featured", "Most popular")}
                </div>
              )}

              <div className="flex items-center gap-2 mb-1">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="font-semibold text-lg">{resolveLocalStr(plan.name, i18n.language)}</div>
              </div>

              <div className="text-4xl font-bold tracking-tighter mt-4">
                {resolveLocalStr(plan.priceLabel, i18n.language)}
                {!plan.contact && plan.key !== "starter" && (
                  <span className="text-sm font-normal text-muted-foreground">
                    /{isBn ? "মাস" : "mo"}
                  </span>
                )}
              </div>

              <ul className="space-y-2.5 mt-5 flex-grow">
                {plan.features.map((f: any, idx: number) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" /> {resolveLocalStr(f, i18n.language)}
                  </li>
                ))}
                {/* Show per-message rate for paid plans */}
                {plan.key !== "starter" && plan.key !== "enterprise" && (
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                    {resolveLocalStr(plan.perMessageLabel, i18n.language)}{" "}
                    {isBn ? "কোটার পরে প্রতি মেসেজ" : "per msg after quota"}
                  </li>
                )}
              </ul>

              <Button
                className={`mt-6 rounded-full ${
                  plan.featured
                    ? "bg-primary hover:bg-primary/90 text-white"
                    : ""
                }`}
                variant={plan.featured ? "default" : "outline"}
                disabled={!!loadingPlan || isCurrent}
                onClick={() => checkout(plan)}
                data-testid={`pay-cta-${plan.key}`}
              >
                {loadingPlan === plan.key ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isCurrent ? (
                  isBn ? "বর্তমান প্ল্যান" : "Current plan"
                ) : plan.contact ? (
                  isBn ? "যোগাযোগ করুন" : "Contact us"
                ) : (
                  `${isBn ? "আপগ্রেড" : "Upgrade"} — ${resolveLocalStr(plan.priceLabel, i18n.language)}`
                )}
              </Button>
            </motion.div>
          );
        })}
      </div>

      <div className="text-xs text-muted-foreground">
        {isBn
          ? "সব পেমেন্ট টেস্ট মোডে আছে।"
          : "All payments are in test mode. No real charges will be made."}
      </div>
    </div>
  );
}
