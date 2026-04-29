"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Check, Loader2, DollarSign, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

type Tier = {
  key: "free" | "pro" | "ent";
  name: string;
  priceUSD: string;
  priceBDT: string;
  desc: string;
  features: string[];
  pkg: { usd: string; bdt: string } | null;
  featured?: boolean;
  contact?: boolean;
};

export default function Payment() {
  const { t } = useTranslation();
  const [currency, setCurrency] = useState("usd");
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<{ plan?: string } | null>(null);

  const currentPlan = usage?.plan || "free";

  useEffect(() => {
    fetch("/api/usage")
      .then((response) => response.json())
      .then((data) => setUsage(data))
      .catch(() => {});
  }, []);

  const tiers: Tier[] = [
    { key: "free", name: t("pricing.free.name", "Free"), priceUSD: "$0", priceBDT: "৳0", desc: t("pricing.free.desc", "For personal projects"), features: ["1 Chatbot", "10,000 Characters", "100 Messages /mo"], pkg: null },
    { key: "pro", name: t("pricing.pro.name", "Pro"), priceUSD: "$29", priceBDT: "৳2,900", desc: t("pricing.pro.desc", "For small businesses"), features: ["5 Chatbots", "2,000,000 Characters", "5,000 Messages /mo"], pkg: { usd: "pro_usd", bdt: "pro_bdt" }, featured: true },
    { key: "ent", name: t("pricing.ent.name", "Enterprise"), priceUSD: "Custom", priceBDT: "Custom", desc: t("pricing.ent.desc", "For large teams"), features: ["Unlimited Chatbots", "Unlimited Characters", "Unlimited Messages", "White-glove onboarding"], pkg: null, contact: true },
  ];

  const checkout = async (tier: Tier) => {
    if (tier.contact) { toast.info("Email sales@driplare.com to discuss Enterprise plans"); return; }
    if (!tier.pkg) { toast.info("You're already on the Free plan"); return; }
    setBusy(true);
    try {
      const origin_url = window.location.origin;
      if (currency === "usd") {
        const r = await fetch("/api/payments/checkout/session", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ package_id: tier.pkg.usd, origin_url })
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Checkout failed");
        if (data.url) window.location.assign(data.url);
      } else {
        const r = await fetch("/api/payments/uddoktapay/charge", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ package_id: tier.pkg.bdt, origin_url })
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Checkout failed");
        if (data.url) window.location.assign(data.url);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Checkout failed";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing & Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">Pick the plan that fits you. Switch currencies for local pricing.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Current plan</span>
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold capitalize text-sm">{currentPlan}</span>
        </div>
      </div>

      <Tabs value={currency} onValueChange={setCurrency}>
        <TabsList className="rounded-full p-1 bg-muted">
          <TabsTrigger value="usd" className="rounded-full px-5" data-testid="cur-usd"><DollarSign className="w-4 h-4 mr-1" /> Pay in USD</TabsTrigger>
          <TabsTrigger value="bdt" className="rounded-full px-5" data-testid="cur-bdt"><Wallet className="w-4 h-4 mr-1" /> Pay in BDT</TabsTrigger>
        </TabsList>
        <TabsContent value="usd" className="mt-2">
          <div className="text-xs text-muted-foreground">Powered by Stripe — secure global payments (test mode)</div>
        </TabsContent>
        <TabsContent value="bdt" className="mt-2">
          <div className="text-xs text-muted-foreground">Powered by Uddoktapay — bKash, Nagad, Rocket, cards (Bangladesh)</div>
        </TabsContent>
      </Tabs>

      <div className="grid md:grid-cols-3 gap-5">
        {tiers.map((tier, i) => (
          <motion.div
            key={tier.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className={`relative flex flex-col p-7 rounded-2xl bg-card border ${tier.featured ? "border-primary shadow-xl md:-translate-y-3" : "border-border"}`}
            data-testid={`pay-tier-${tier.key}`}
          >
            {tier.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">Most popular</div>}
            <div className="font-semibold text-lg">{tier.name}</div>
            <p className="text-sm text-muted-foreground mt-1">{tier.desc}</p>
            <div className="text-4xl font-bold tracking-tighter mt-5">
              {currency === "usd" ? tier.priceUSD : tier.priceBDT}
              {!tier.contact && tier.key !== "free" && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
            </div>
            <ul className="space-y-2.5 mt-5 flex-grow">
              {tier.features.map((f: string) => (
                <li key={f} className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-primary" /> {f}</li>
              ))}
            </ul>
            <Button
              className={`mt-6 rounded-full ${tier.featured ? "bg-primary hover:bg-primary/90 text-white" : ""}`}
              variant={tier.featured ? "default" : "outline"}
              disabled={busy || (currentPlan === tier.key)}
              onClick={() => checkout(tier)}
              data-testid={`pay-cta-${tier.key}`}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : currentPlan === tier.key ? "Current plan" : tier.contact ? "Contact us" : `Upgrade — ${currency === "usd" ? tier.priceUSD : tier.priceBDT}`}
            </Button>
          </motion.div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">All payments are in test mode. No real charges will be made.</div>
    </div>
  );
}
