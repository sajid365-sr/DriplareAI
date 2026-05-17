"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Check, ArrowLeft, Sparkles, Zap, Crown, Building2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/nextjs";
import { useRegion } from "@/components/region-provider";
import { getPlansForRegion, resolveLocalStr } from "@/lib/domain/plan-config";
import i18n from "@/lib/core/i18n";

const PLAN_ICONS = {
  starter: Sparkles,
  growth: Zap,
  business: Crown,
  enterprise: Building2,
};

export default function PricingPage() {
  const { t } = useTranslation(["pricing", "common"]);
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { region } = useRegion();

  const plans = getPlansForRegion(region);

  return (
    <div className="bg-background">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          data-testid="back-home"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> {region === "bd" ? "ফিরে যান" : "Back"}
        </Link>

        <div className="text-center mt-8 mb-10">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter">
            {t("pricing.title")}
          </h1>
          <p className="mt-3 text-muted-foreground">{t("pricing.subtitle")}</p>
        </div>

        <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {plans.map((plan, i) => {
            const Icon = PLAN_ICONS[plan.key] || Sparkles;

            return (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative flex flex-col p-8 rounded-2xl bg-card border ${plan.featured
                    ? "border-primary shadow-xl md:-translate-y-4"
                    : "border-border shadow-sm"
                  }`}
                data-testid={`tier-${plan.key}`}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase">
                    {t("pricing.featured")}
                  </div>
                )}

                <div className="flex items-center gap-2 mb-1">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-lg">{resolveLocalStr(plan.name, i18n.language)}</h3>
                </div>

                <div className="text-4xl font-bold tracking-tighter mt-6">
                  {resolveLocalStr(plan.priceLabel, i18n.language)}
                  {!plan.contact && plan.key !== "starter" && (
                    <span className="text-sm font-normal text-muted-foreground">
                      /{region === "bd" ? "মাস" : "mo"}
                    </span>
                  )}
                </div>

                <ul className="space-y-3 mt-6 flex-grow">
                  {plan.features.map((f, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary shrink-0" /> {resolveLocalStr(f, i18n.language)}
                    </li>
                  ))}
                  {plan.key !== "starter" && plan.key !== "enterprise" && (
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                      {resolveLocalStr(plan.perMessageLabel, i18n.language)} {t("pricing.perMessage", "per msg after quota")}
                    </li>
                  )}
                </ul>

                {isSignedIn ? (
                  <Button
                    className={`mt-8 rounded-full ${plan.featured
                        ? "bg-primary hover:bg-primary/90 text-white"
                        : ""
                      }`}
                    variant={plan.featured ? "default" : "outline"}
                    onClick={() => router.push("/dashboard/payment")}
                    data-testid={`tier-cta-${plan.key}`}
                  >
                    {t("pricing.cta")}
                  </Button>
                ) : (
                  <Link href="/sign-up">
                    <Button
                      className={`mt-8 rounded-full w-full ${plan.featured
                          ? "bg-primary hover:bg-primary/90 text-white"
                          : ""
                        }`}
                      variant={plan.featured ? "default" : "outline"}
                      data-testid={`tier-cta-${plan.key}`}
                    >
                      {t("pricing.cta")}
                    </Button>
                  </Link>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
