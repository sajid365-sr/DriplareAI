/**
 * Plan configuration for REMOVED — separate BD and Global pricing.
 *
 * BD market:  Lower prices (lower CAC), BDT currency, Uddoktapay
 * Global:     Higher prices (higher CAC), USD currency, Stripe
 */

import type { Region } from "./region";

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
  includedMessages: number; 
  perMessageRate: number;   
  perMessageLabel: LocalizedString;  
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
    price: 0,
    priceLabel: { en: "৳0", bn: "৳০" },
    maxChatbots: 1,
    maxIntegrationsPerChatbot: 1,
    allowedPlatforms: ["facebook"],
    includedMessages: 50,
    perMessageRate: 0.10,
    perMessageLabel: { en: "৳0.10", bn: "৳০.১০" },
    features: [
      { en: "1 Chatbot", bn: "১টি চ্যাটবট" },
      { en: "1 Integration (Facebook)", bn: "১টি ইন্টিগ্রেশন (ফেসবুক)" },
      { en: "50 Free AI Messages", bn: "৫০টি ফ্রি AI মেসেজ" },
      { en: "Web Widget", bn: "ওয়েব উইজেট" },
      { en: "7-day trial", bn: "৭ দিনের ট্রায়াল" },
    ],
    trialDays: 7,
  },
  {
    key: "growth",
    name: { en: "Growth", bn: "গ্রোথ" },
    price: 999,
    priceLabel: { en: "৳999", bn: "৳৯৯৯" },
    maxChatbots: 3,
    maxIntegrationsPerChatbot: 3,
    allowedPlatforms: ["facebook", "whatsapp", "instagram"],
    includedMessages: 500,
    perMessageRate: 0.10,
    perMessageLabel: { en: "৳0.10", bn: "৳০.১০" },
    features: [
      { en: "3 Chatbots", bn: "৩টি চ্যাটবট" },
      { en: "3 Integrations", bn: "৩টি ইন্টিগ্রেশন" },
      { en: "500 Free AI Messages/mo", bn: "৫০০টি ফ্রি AI মেসেজ/মাস" },
      { en: "Priority Support", bn: "প্রায়োরিটি সাপোর্ট" },
    ],
    featured: true,
  },
  {
    key: "business",
    name: { en: "Business", bn: "বিজনেস" },
    price: 2499,
    priceLabel: { en: "৳2,499", bn: "৳২,৪৯৯" },
    maxChatbots: 10,
    maxIntegrationsPerChatbot: 7,
    allowedPlatforms: ["*"],
    includedMessages: 2000,
    perMessageRate: 0.08,
    perMessageLabel: { en: "৳0.08", bn: "৳০.০৮" },
    features: [
      { en: "10 Chatbots", bn: "১০টি চ্যাটবট" },
      { en: "7 Integrations", bn: "৭টি ইন্টিগ্রেশন" },
      { en: "2,000 Free AI Messages/mo", bn: "২,০০০ ফ্রি AI মেসেজ/মাস" },
      { en: "Live Chat", bn: "লাইভ চ্যাট" },
      { en: "Team Access", bn: "টিম অ্যাক্সেস" },
    ],
  },
  {
    key: "enterprise",
    name: { en: "Enterprise", bn: "এন্টারপ্রাইজ" },
    price: 0,
    priceLabel: { en: "Custom", bn: "কাস্টম" },
    maxChatbots: Infinity,
    maxIntegrationsPerChatbot: Infinity,
    allowedPlatforms: ["*"],
    includedMessages: Infinity,
    perMessageRate: 0,
    perMessageLabel: { en: "Custom", bn: "কাস্টম" },
    features: [
      { en: "Unlimited Chatbots", bn: "আনলিমিটেড চ্যাটবট" },
      { en: "Unlimited Messages", bn: "আনলিমিটেড মেসেজ" },
      { en: "SLA + Dedicated Support", bn: "SLA + ডেডিকেটেড সাপোর্ট" },
      { en: "Custom Integrations", bn: "কাস্টম ইন্টিগ্রেশন" },
    ],
    contact: true,
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
    includedMessages: 100,
    perMessageRate: 0.01,
    perMessageLabel: "$0.01",
    features: [
      "1 Chatbot",
      "1 Integration (Facebook)",
      "100 Free AI Messages",
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
    includedMessages: 1000,
    perMessageRate: 0.008,
    perMessageLabel: "$0.008",
    features: [
      "5 Chatbots",
      "5 Integrations",
      "1,000 Free AI Messages/mo",
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
    includedMessages: 5000,
    perMessageRate: 0.006,
    perMessageLabel: "$0.006",
    features: [
      "20 Chatbots",
      "15 Integrations",
      "5,000 Free AI Messages/mo",
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
    includedMessages: Infinity,
    perMessageRate: 0,
    perMessageLabel: "Custom",
    features: [
      "Unlimited Chatbots",
      "Unlimited Messages",
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

/** Get default included messages for a plan key and region. */
export function getIncludedMessages(region: Region, planKey: PlanKey): number {
  return getPlan(region, planKey).includedMessages;
}
