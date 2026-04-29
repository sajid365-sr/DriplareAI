"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Sparkles, MessageSquare, Layers, Brain, BarChart3, Headset, Code2, Check, Star, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import PublicNav from "@/components/layout/PublicNav";
import Footer from "@/components/layout/Footer";
import FloatingBubbles from "@/components/layout/FloatingBubbles";
import { DriplareIcon } from "@/components/layout/BrandLogo";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

export default function LandingPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isSignedIn } = useUser();

  const features = [
    { icon: Layers, k: "train" },
    { icon: Globe, k: "channels" },
    { icon: Brain, k: "models" },
    { icon: BarChart3, k: "analytics" },
    { icon: Headset, k: "live" },
    { icon: Code2, k: "api" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-28 md:pt-28 md:pb-36 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5" /> {t("hero.eyebrow")}
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter leading-[1.05]">
              {t("hero.title").split(" ").slice(0, -1).join(" ")} <span className="bg-gradient-to-r from-primary via-fuchsia-500 to-violet-400 bg-clip-text text-transparent">{t("hero.title").split(" ").slice(-1)}</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-6 text-lg text-muted-foreground max-w-xl">
              {t("hero.subtitle")}
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 flex flex-wrap gap-3">
              {isSignedIn ? (
                <Button size="lg" className="rounded-full bg-primary hover:bg-primary/90 px-7 text-white" onClick={() => router.push("/app/chatbots")} data-testid="hero-cta-primary">
                  {t("hero.cta")}
                </Button>
              ) : (
                <Link href="/sign-up">
                  <Button size="lg" className="rounded-full bg-primary hover:bg-primary/90 px-7 text-white" data-testid="hero-cta-primary">
                    {t("hero.cta")}
                  </Button>
                </Link>
              )}
              <Button size="lg" variant="outline" className="rounded-full px-7" onClick={() => router.push("/tutorial")} data-testid="hero-cta-secondary">
                {t("hero.secondary")}
              </Button>
            </motion.div>
            <div className="mt-10 flex items-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-primary" /> 100 free messages</div>
              <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-primary" /> All channels</div>
              <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-primary" /> Bangla support</div>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="relative">
            <div className="absolute -top-10 -right-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
            <div className="relative bg-card border border-border rounded-2xl shadow-2xl p-6">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <img src={DriplareIcon} alt="" className="w-9 h-9" />
                <div>
                  <div className="font-semibold text-sm">Driplare Agent</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Online</div>
                </div>
              </div>
              <div className="space-y-3 py-4">
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2 text-sm max-w-[80%]">Do you have refund policy?</div>
                </div>
                <div className="flex">
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2 text-sm max-w-[80%]">Yes — 30 day money back. Want me to start a refund?</div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2 text-sm">Yes please</div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="h-9 flex-1 rounded-full border border-border bg-background px-3 text-xs flex items-center text-muted-foreground">Reply…</div>
                <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-white"><MessageSquare className="w-4 h-4" /></div>
              </div>
              <div className="absolute -bottom-3 -right-3 flex gap-1">
                <div className="w-9 h-9 rounded-full bg-[#1877F2] flex items-center justify-center text-white shadow-lg"><MessageSquare className="w-4 h-4" /></div>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#E1306C] to-[#F77737] flex items-center justify-center text-white shadow-lg"><Globe className="w-4 h-4" /></div>
                <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center text-white shadow-lg"><MessageSquare className="w-4 h-4" /></div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t("features.title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("features.subtitle")}</p>
          </div>
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
            {features.map((f, i) => (
              <motion.div key={f.k} variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }} className="p-6 rounded-2xl border border-border bg-card hover:-translate-y-1 hover:shadow-xl transition-all" data-testid={`feature-${f.k}`}>
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-lg mb-1.5">{t(`features.items.${f.k}.t`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`features.items.${f.k}.d`)}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6 rounded-3xl bg-gradient-to-br from-primary to-fuchsia-600 p-12 text-center text-white shadow-2xl">
          <Star className="w-8 h-8 mx-auto mb-3 opacity-80" />
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Ship a smart agent in under 10 minutes.</h2>
          <p className="mt-3 opacity-90">Free to try. No credit card. Cancel anytime.</p>
          {isSignedIn ? (
            <Button size="lg" variant="secondary" className="mt-6 rounded-full bg-white text-primary hover:bg-white/90" onClick={() => router.push("/app/chatbots")} data-testid="bottom-cta">
              Get started free
            </Button>
          ) : (
            <Link href="/sign-up">
              <Button size="lg" variant="secondary" className="mt-6 rounded-full bg-white text-primary hover:bg-white/90" data-testid="bottom-cta">
                Get started free
              </Button>
            </Link>
          )}
        </div>
      </section>

      <Footer />
      <FloatingBubbles />
    </div>
  );
}
