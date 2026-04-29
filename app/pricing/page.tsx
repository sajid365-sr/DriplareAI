"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Check, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@clerk/nextjs";

export default function PricingPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState("monthly");
  const router = useRouter();
  const { isSignedIn } = useUser();
  const tiers = ["free", "pro", "ent"];
  const featured = "pro";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground" data-testid="back-home">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Link>
        <div className="text-center mt-8 mb-10">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter">{t("pricing.title")}</h1>
          <p className="mt-3 text-muted-foreground">{t("pricing.subtitle")}</p>
        </div>

        <div className="flex justify-center mb-12">
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList className="rounded-full p-1 bg-muted">
              <TabsTrigger value="monthly" className="rounded-full px-5" data-testid="period-monthly">{t("pricing.monthly")}</TabsTrigger>
              <TabsTrigger value="yearly" className="rounded-full px-5" data-testid="period-yearly">{t("pricing.yearly")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((tier, i) => {
            const isFeatured = tier === featured;
            return (
              <motion.div
                key={tier}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative flex flex-col p-8 rounded-2xl bg-card border ${isFeatured ? "border-primary shadow-xl md:-translate-y-4" : "border-border shadow-sm"}`}
                data-testid={`tier-${tier}`}
              >
                {isFeatured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase">
                    {t("pricing.featured")}
                  </div>
                )}
                <h3 className="font-semibold text-lg">{t(`pricing.${tier}.name`)}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t(`pricing.${tier}.desc`)}</p>
                <div className="text-4xl font-bold tracking-tighter mt-6">
                  {t(`pricing.${tier}.price`)}
                  {tier !== "ent" && <span className="text-sm font-normal text-muted-foreground">/{period === "monthly" ? "mo" : "yr"}</span>}
                </div>
                <ul className="space-y-3 mt-6 flex-grow">
                  {(t(`pricing.${tier}.features`, { returnObjects: true }) as string[]).map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
                {isSignedIn ? (
                  <Button
                    className={`mt-8 rounded-full ${isFeatured ? "bg-primary hover:bg-primary/90 text-white" : ""}`}
                    variant={isFeatured ? "default" : "outline"}
                    onClick={() => router.push("/app/payment")}
                    data-testid={`tier-cta-${tier}`}
                  >
                    {t("pricing.cta")}
                  </Button>
                ) : (
                  <Link href="/sign-up">
                    <Button
                      className={`mt-8 rounded-full ${isFeatured ? "bg-primary hover:bg-primary/90 text-white" : ""}`}
                      variant={isFeatured ? "default" : "outline"}
                      data-testid={`tier-cta-${tier}`}
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
