"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Sparkles, Check, Star, Play, Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import FloatingBubbles from "@/components/layout/FloatingBubbles";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

// Landing Page Modular Sections
import AIAgentVisual from "@/components/landing/AIAgentVisual";
import BookDemoModal from "@/components/landing/BookDemoModal";
import DemoSection from "@/components/landing/DemoSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import ChannelsSection from "@/components/landing/ChannelsSection";
import BeforeAfterSection from "@/components/landing/BeforeAfterSection";
import PricingPreviewSection from "@/components/landing/PricingPreviewSection";
import FAQSection from "@/components/landing/FAQSection";

export default function LandingPage() {
  const { t, i18n } = useTranslation(["home", "common"]);
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [bookDemoOpen, setBookDemoOpen] = useState(false);

  // Prevent crash if translations are not yet loaded
  if (!i18n.isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">
        Loading REMOVED...
      </div>
    );
  }

  const heroTitle = t("hero.title") || "Build chatbots that actually answer.";
  const titleParts = heroTitle.split(" ");
  const lastWord = titleParts.pop();
  const mainTitle = titleParts.join(" ");

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* SECTION 1: HERO SECTION */}
      <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32">
        {/* Background Gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/15 via-background to-background pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center relative z-10">
          {/* Left Column: Hero Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Eyebrow & Free Trial Badge */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20 shadow-sm">
                <Sparkles className="w-3.5 h-3.5" /> {t("hero.eyebrow")}
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {t("hero.trialBadge")}
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter leading-[1.08]">
              {mainTitle}{" "}
              <span className="bg-gradient-to-r from-primary via-fuchsia-500 to-violet-400 bg-clip-text text-transparent">
                {lastWord}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
              {t("hero.subtitle")}
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {isSignedIn ? (
                <Button
                  size="lg"
                  className="rounded-full bg-primary hover:bg-primary/90 text-white px-7 text-sm font-medium shadow-lg shadow-primary/25"
                  onClick={() => router.push("/dashboard/chatbots")}
                  data-testid="hero-cta-primary"
                >
                  Go to Dashboard <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              ) : (
                <Link href="/sign-up">
                  <Button
                    size="lg"
                    className="rounded-full bg-primary hover:bg-primary/90 text-white px-7 text-sm font-medium shadow-lg shadow-primary/25"
                    data-testid="hero-cta-primary"
                  >
                    {t("hero.cta")}
                  </Button>
                </Link>
              )}

              {/* Watch Demo -> Redirects to /tutorial */}
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-6 text-sm font-medium gap-2 border-border/80"
                onClick={() => router.push("/tutorial")}
                data-testid="hero-cta-secondary"
              >
                <Play className="w-4 h-4 text-primary fill-primary" /> {t("hero.secondary")}
              </Button>

              {/* Book Live Demo -> Opens Modal */}
              <Button
                size="lg"
                variant="ghost"
                className="rounded-full px-5 text-sm font-medium gap-2 text-muted-foreground hover:text-foreground"
                onClick={() => setBookDemoOpen(true)}
                data-testid="hero-cta-book-demo"
              >
                <Calendar className="w-4 h-4 text-primary" /> {t("hero.bookDemo")}
              </Button>
            </div>

            {/* Trust Chips */}
            <div className="mt-10 flex flex-wrap items-center gap-6 text-xs text-muted-foreground font-medium">
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500" /> Free to start
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500" /> All channels supported
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500" /> No credit card required
              </div>
            </div>
          </motion.div>

          {/* Right Column: AI Agent Visual Component */}
          <div className="relative">
            <AIAgentVisual />
          </div>
        </div>
      </section>

      {/* SECTION 2: HOW IT WORKS / LIVE DEMO VIDEO */}
      <DemoSection />

      {/* SECTION 3: WHAT OUR AGENT CAN DO */}
      <FeaturesSection />

      {/* SECTION 4: OUR SUPPORTED CHANNELS */}
      <ChannelsSection />

      {/* SECTION 5: BEFORE & AFTER COMPARISON */}
      <BeforeAfterSection />

      {/* SECTION 6: PRICING PREVIEW */}
      <PricingPreviewSection />

      {/* SECTION 7: FAQ SECTION */}
      <FAQSection />

      {/* BOTTOM FINAL CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6 rounded-3xl bg-gradient-to-br from-primary via-violet-600 to-fuchsia-600 p-12 text-center text-white shadow-2xl relative overflow-hidden">
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <Star className="w-8 h-8 mx-auto mb-3 opacity-90 text-amber-300 fill-amber-300" />
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Ship a smart AI Sales Agent in under 10 minutes.
          </h2>
          <p className="mt-3 opacity-90 text-sm sm:text-base max-w-xl mx-auto">
            Start with our 3-day free trial. No credit card required. Cancel anytime.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {isSignedIn ? (
              <Button
                size="lg"
                variant="secondary"
                className="rounded-full bg-white text-primary hover:bg-white/90 px-8 font-semibold shadow-lg"
                onClick={() => router.push("/dashboard/chatbots")}
                data-testid="bottom-cta"
              >
                Go to Dashboard
              </Button>
            ) : (
              <Link href="/sign-up">
                <Button
                  size="lg"
                  variant="secondary"
                  className="rounded-full bg-white text-primary hover:bg-white/90 px-8 font-semibold shadow-lg"
                  data-testid="bottom-cta"
                >
                  Start 3-Day Free Trial
                </Button>
              </Link>
            )}
            <Button
              size="lg"
              variant="outline"
              className="rounded-full border-white/40 text-white bg-white/10 hover:bg-white/20 px-6 font-medium"
              onClick={() => setBookDemoOpen(true)}
            >
              Book Live Demo
            </Button>
          </div>
        </div>
      </section>

      {/* BOOK LIVE DEMO MODAL */}
      <BookDemoModal open={bookDemoOpen} onOpenChange={setBookDemoOpen} />

      {/* FLOATING BUBBLES BACKGROUND DECORATION */}
      <FloatingBubbles />
    </div>
  );
}
