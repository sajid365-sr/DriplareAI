/**
 * Plan configuration for DRIPLARE — separate BD and Global pricing.
 *
 * BD market:  Lower prices (lower CAC), BDT currency, Uddoktapay
 * Global:     Higher prices (higher CAC), USD currency, Stripe
 */

import type { Region } from "@/lib/core/region";

export type PlanKey = "starter" | "growth" | "business" | "enterprise";

type LocalizedString = string | { en: string; bn: string };

export interface PlanConfig {
  key: PlanKey;
  name: LocalizedString;
  price: number;
  priceLabel: LocalizedString;
  maxChatbots: number;
  maxIntegrationsPerChatbot: number;
  allowedPlatforms: string[];
  includedCredits: number;
  perCreditRate: number;
  perCreditLabel: LocalizedString;
  features: LocalizedString[];
  trialDays?: number;
  featured?: boolean;
  contact?: boolean;
}

/* ───────── Bangladesh Plans (BDT) ───────── */

export const BD_PLANS: PlanConfig[] = [
  {
    key: "starter",
    name: { en: "Starter", bn: "স্টার্টার" },
    price: 999,
    priceLabel: { en: "৳999", bn: "৳৯৯৯" },
    maxChatbots: 1,
    maxIntegrationsPerChatbot: 1,
    allowedPlatforms: ["facebook"],
    includedCredits: 15000,
    perCreditRate: 0.01,
    perCreditLabel: { en: "৳0.01", bn: "৳০.০১" },
    features: [
      { en: "1 Chatbot", bn: "১টি চ্যাটবট" },
      { en: "15,000 Free AI Credits/mo", bn: "১৫,০০০টি ফ্রি AI ক্রেডিট/মাস" },
      { en: "Facebook Channel Only", bn: "শুধু Facebook চ্যানেল" },
      { en: "No E-Commerce Integration", bn: "ই-কমার্স ইন্টিগ্রেশন নেই" },
      { en: "3-day free trial", bn: "৩-দিনের ফ্রি ট্রায়াল" },
    ],
    trialDays: 3,
  },
  {
    key: "business",
    name: { en: "Business", bn: "বিজনেস" },
    price: 2499,
    priceLabel: { en: "৳2,499", bn: "৳২,৪৯৯" },
    maxChatbots: 10,
    maxIntegrationsPerChatbot: 7,
    allowedPlatforms: ["*"],
    includedCredits: 50000,
    perCreditRate: 0.008,
    perCreditLabel: { en: "৳0.008", bn: "৳০.০০৮" },
    features: [
      { en: "10 Chatbots", bn: "১০টি চ্যাটবট" },
      { en: "50,000 Free AI Credits/mo", bn: "৫০,০০০ ফ্রি AI ক্রেডিট/মাস" },
      { en: "All Channels", bn: "সব চ্যানেল" },
      { en: "E-Commerce (All Couriers)", bn: "ই-কমার্স (সব কুরিয়ার)" },
      { en: "Credit Top-up Enabled", bn: "ক্রেডিট টপ-আপ সুবিধা" },
    ],
    featured: true,
  },
  {
    key: "enterprise",
    name: { en: "Enterprise", bn: "এন্টারপ্রাইজ" },
    price: 4999,
    priceLabel: { en: "৳4,999", bn: "৳৪,৯৯৯" },
    maxChatbots: Infinity,
    maxIntegrationsPerChatbot: Infinity,
    allowedPlatforms: ["*"],
    includedCredits: 150000,
    perCreditRate: 0.005,
    perCreditLabel: { en: "৳0.005", bn: "৳০.০০৫" },
    features: [
      { en: "Unlimited Chatbots", bn: "আনলিমিটেড চ্যাটবট" },
      { en: "150,000 Free AI Credits/mo", bn: "১,৫০,০০০ ফ্রি AI ক্রেডিট/মাস" },
      { en: "All Channels + Web Widget", bn: "সব চ্যানেল + ওয়েব উইজেট" },
      { en: "E-Commerce + Custom Integration", bn: "ই-কমার্স + কাস্টম কুরিয়ার" },
      { en: "Advanced Model Customization", bn: "উন্নত মডেল কাস্টমাইজেশন টগল" },
    ],
  },
];

/* ───────── Global Plans (USD) ───────── */

export const GLOBAL_PLANS: PlanConfig[] = [
  {
    key: "starter",
    name: "Starter",
    price: 0,
    priceLabel: "$0",
    maxChatbots: 1,
    maxIntegrationsPerChatbot: 1,
    allowedPlatforms: ["facebook"],
    includedCredits: 500,
    perCreditRate: 0.0002,
    perCreditLabel: "$0.0002",
    features: [
      "1 Chatbot",
      "1 Integration (Facebook)",
      "500 Free AI Credits",
      "Web Widget",
      "14-day trial",
    ],
    trialDays: 14,
  },
  {
    key: "growth",
    name: "Growth",
    price: 29,
    priceLabel: "$29",
    maxChatbots: 5,
    maxIntegrationsPerChatbot: 5,
    allowedPlatforms: ["*"],
    includedCredits: 15000,
    perCreditRate: 0.0002,
    perCreditLabel: "$0.0002",
    features: [
      "5 Chatbots",
      "5 Integrations",
      "15,000 Free AI Credits/mo",
      "Priority Support",
    ],
    featured: true,
  },
  {
    key: "business",
    name: "Business",
    price: 79,
    priceLabel: "$79",
    maxChatbots: 20,
    maxIntegrationsPerChatbot: 15,
    allowedPlatforms: ["*"],
    includedCredits: 50000,
    perCreditRate: 0.0001,
    perCreditLabel: "$0.0001",
    features: [
      "20 Chatbots",
      "15 Integrations",
      "50,000 Free AI Credits/mo",
      "Live Chat",
      "Team Access",
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: 0,
    priceLabel: "Custom",
    maxChatbots: Infinity,
    maxIntegrationsPerChatbot: Infinity,
    allowedPlatforms: ["*"],
    includedCredits: Infinity,
    perCreditRate: 0,
    perCreditLabel: "Custom",
    features: [
      "Unlimited Chatbots",
      "Unlimited Credits",
      "SLA & Dedicated Support",
      "Custom Integrations",
    ],
    contact: true,
  },
];

/* ───────── Helpers ───────── */

/** Get plans for a given region. */
export function getPlansForRegion(region: Region): PlanConfig[] {
  return region === "bd" ? BD_PLANS : GLOBAL_PLANS;
}

/** Resolve localized string based on i18n language */
export function resolveLocalStr(str: LocalizedString, lang: string): string {
  if (typeof str === "string") return str;
  return lang === "bn" ? str.bn : str.en;
}

/** Get a specific plan by key and region. */
export function getPlan(region: Region, planKey: PlanKey): PlanConfig {
  const plans = getPlansForRegion(region);
  return plans.find((p) => p.key === planKey) ?? plans[0];
}

/** Get the total integration limit across all allowed chatbots for a plan. */
export function getTotalIntegrationLimit(plan: PlanConfig): number {
  if (!Number.isFinite(plan.maxChatbots) || !Number.isFinite(plan.maxIntegrationsPerChatbot)) {
    return Infinity;
  }

  return plan.maxChatbots * plan.maxIntegrationsPerChatbot;
}

/** Get default included credits for a plan key and region. */
export function getIncludedCredits(region: Region, planKey: PlanKey): number {
  return getPlan(region, planKey).includedCredits;
}
