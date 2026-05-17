"use client";

import { useEffect, useMemo, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/core/i18n";
import { useRegion } from "@/components/region-provider";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { region } = useRegion();
  const [clientLang, setClientLang] = useState<string | null>(null);

  useEffect(() => {
    // Only run on client after hydration to catch localStorage preferences
    const saved = localStorage.getItem("driplare_lang");
    if (saved && region === "bd") {
      setClientLang(saved);
    }
  }, [region]);

  // Determine target language synchronously
  let targetLang = "bn";
  if (region === "global") {
    targetLang = "en";
  } else {
    // If client hasn't hydrated yet or hasn't checked localStorage, default to 'bn' to match SSR perfectly.
    targetLang = clientLang || "bn";
  }

  // Clone instance to prevent SSR singleton bleeding and async changeLanguage bugs
  const i18nInstance = useMemo(() => {
    const clone = i18n.cloneInstance({ lng: targetLang });
    return clone;
  }, [targetLang]);

  useEffect(() => {
    document.documentElement.lang = targetLang;
  }, [targetLang]);

  return <I18nextProvider i18n={i18nInstance} defaultNS="translation">{children}</I18nextProvider>;
}
