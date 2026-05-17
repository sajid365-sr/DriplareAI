"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Core region helpers
import { getRegionFromCookie, getRegionConfig } from "@/lib/core/region";

// Load locales namespaces
import enChatbots from "../../public/locales/en/chatbots.json";
import bnChatbots from "../../public/locales/bn/chatbots.json";
import enPayment from "../../public/locales/en/payment.json";
import bnPayment from "../../public/locales/bn/payment.json";
import enAnalytics from "../../public/locales/en/analytics.json";
import bnAnalytics from "../../public/locales/bn/analytics.json";

import enCommon from "../../public/locales/en/common.json";
import bnCommon from "../../public/locales/bn/common.json";
import enHome from "../../public/locales/en/home.json";
import bnHome from "../../public/locales/bn/home.json";
import enPricing from "../../public/locales/en/pricing.json";
import bnPricing from "../../public/locales/bn/pricing.json";
import enOverview from "../../public/locales/en/overview.json";
import bnOverview from "../../public/locales/bn/overview.json";
import enTutorial from "../../public/locales/en/tutorial.json";
import bnTutorial from "../../public/locales/bn/tutorial.json";
import enSettings from "../../public/locales/en/settings.json";
import bnSettings from "../../public/locales/bn/settings.json";

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
