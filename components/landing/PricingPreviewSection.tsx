"use client";

import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Check, Zap, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BD_PLANS, resolveLocalStr } from "@/lib/domain/plan-config";

export default function PricingPreviewSection() {
  const { t, i18n } = useTranslation(["home", "common"]);
  const lang = i18n.language || "en";

  return (
    <section id="pricing-preview" className="py-24 bg-muted/30 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4 border border-primary/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t("pricing.badge")}
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight"
          >
            {t("pricing.title")}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-base sm:text-lg text-muted-foreground"
          >
            {t("pricing.subtitle")}
          </motion.p>
        </div>

        {/* Pricing Cards (BDT Plans) */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch mb-12">
          {BD_PLANS.map((plan, idx) => {
            const isFeatured = plan.featured;
            return (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className={`relative rounded-3xl p-8 flex flex-col justify-between backdrop-blur-xl transition-all duration-300 ${
                  isFeatured
                    ? "bg-card border-2 border-primary shadow-2xl scale-105 z-10"
                    : "bg-card/70 border border-border/80 shadow-md hover:shadow-xl"
                }`}
              >
                {isFeatured && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-md">
                    <Crown className="w-3 h-3" /> {lang === "bn" ? "সর্বাধিক জনপ্রিয়" : "Most Popular"}
                  </div>
                )}

                <div>
                  <div className="font-bold text-xl mb-1">
                    {resolveLocalStr(plan.name, lang)}
                  </div>

                  <div className="my-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight">
                      {resolveLocalStr(plan.priceLabel, lang)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      /{lang === "bn" ? "মাস" : "mo"}
                    </span>
                  </div>

                  <ul className="space-y-3 text-xs sm:text-sm border-t border-border/60 pt-6">
                    {plan.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-primary shrink-0" />
                        <span>{resolveLocalStr(feat, lang)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-4">
                  <Link href="/pricing" className="w-full block">
                    <Button
                      variant={isFeatured ? "default" : "outline"}
                      className={`w-full rounded-full ${
                        isFeatured
                          ? "bg-primary hover:bg-primary/90 text-white"
                          : ""
                      }`}
                    >
                      {lang === "bn" ? "শুরু করুন" : "Get Started"} <Zap className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* View Full Matrix Link */}
        <div className="text-center">
          <Link href="/pricing">
            <Button size="lg" variant="ghost" className="rounded-full gap-2 text-primary hover:text-primary/90">
              {t("pricing.viewAll")} <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
