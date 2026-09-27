"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Core region helpers
import { getRegionFromCookie, getRegionConfig } from "@/lib/core/region";

// Load locales namespaces
import enAnalytics from "../../public/locales/en/analytics.json";
import bnAnalytics from "../../public/locales/bn/analytics.json";
import enChatbots from "../../public/locales/en/chatbots.json";
import bnChatbots from "../../public/locales/bn/chatbots.json";
import enCommon from "../../public/locales/en/common.json";
import bnCommon from "../../public/locales/bn/common.json";
import enHome from "../../public/locales/en/home.json";
import bnHome from "../../public/locales/bn/home.json";
import enKnowledgeBase from "../../public/locales/en/knowledge-base.json";
import bnKnowledgeBase from "../../public/locales/bn/knowledge-base.json";
import enLiveInbox from "../../public/locales/en/live-inbox.json";
import bnLiveInbox from "../../public/locales/bn/live-inbox.json";
import enOverview from "../../public/locales/en/overview.json";
import bnOverview from "../../public/locales/bn/overview.json";
import enPayment from "../../public/locales/en/payment.json";
import bnPayment from "../../public/locales/bn/payment.json";
import enPricing from "../../public/locales/en/pricing.json";
import bnPricing from "../../public/locales/bn/pricing.json";
import enSettings from "../../public/locales/en/settings.json";
import bnSettings from "../../public/locales/bn/settings.json";
import enProducts from "../../public/locales/en/products.json";
import bnProducts from "../../public/locales/bn/products.json";
import enTutorial from "../../public/locales/en/tutorial.json";
import bnTutorial from "../../public/locales/bn/tutorial.json";
import enAdmin from "../../public/locales/en/admin.json";
import bnAdmin from "../../public/locales/bn/admin.json";

const resources = {
  en: {
    chatbots: enChatbots,
    payment: enPayment,
    analytics: enAnalytics,
    common: enCommon,
    home: enHome,
    pricing: enPricing,
    overview: enOverview,
    tutorial: enTutorial,
    settings: enSettings,
    "live-inbox": enLiveInbox,
    liveInbox: enLiveInbox,
    "knowledge-base": enKnowledgeBase,
    knowledgeBase: enKnowledgeBase,
    products: enProducts,
    admin: enAdmin,
  },
  bn: {
    chatbots: bnChatbots,
    payment: bnPayment,
    analytics: bnAnalytics,
    common: bnCommon,
    home: bnHome,
    pricing: bnPricing,
    overview: bnOverview,
    tutorial: bnTutorial,
    settings: bnSettings,
    "live-inbox": bnLiveInbox,
    liveInbox: bnLiveInbox,
    "knowledge-base": bnKnowledgeBase,
    knowledgeBase: bnKnowledgeBase,
    products: bnProducts,
    admin: bnAdmin,
  },
};

// Determine initial language based on region
function getInitialLanguage(): string {
  if (typeof document === "undefined") return "bn"; // SSR default

  // Check saved preference
  const saved = localStorage.getItem("driplare_lang");
  
  // Read region from cookie
  const regionMatch = document.cookie.match(/(?:^|;\s*)driplare_region=([^;]*)/);
  const region = regionMatch?.[1] || "bd";
  
  if (region === "global") {
    // Global region → always English, ignore saved preference
    return "en";
  }

  // BD region → use saved preference, or default to Bangla
  return saved || "bn";
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: "en",
    defaultNS: "common",
    fallbackNS: ["common"],
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
