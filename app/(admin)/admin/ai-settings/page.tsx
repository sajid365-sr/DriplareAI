"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import {
  ModelConfigSheet,
  type OpenRouterModelConfig,
} from "@/components/admin/ai-settings/ModelConfigSheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { type AISettingsData } from "./_components/types";
import {
  CATALOG_VIOLATION_I18N,
  validateModelCatalog,
  type CatalogViolation,
} from "@/lib/domain/model-catalog";
import { AISettingsHeader } from "./_components/AISettingsHeader";
import {
  QuickSetupPresets,
  type QuickSetupDraft,
} from "./_components/QuickSetupPresets";
import { ModelCatalogToolbar } from "./_components/ModelCatalogToolbar";
import { ModelCatalogTable } from "./_components/ModelCatalogTable";
import { ModelPagination } from "./_components/ModelPagination";
import { DeleteModelModal } from "./_components/DeleteModelModal";
import {
  matchesPriceRange,
  sortByPrice,
  type PriceRange,
  type PriceSort,
} from "./_components/price-filter";

/**
 * "Validate Status" কখন থেমে যায় তার কারণ → i18n key।
 *
 * ⚠️ সার্ভার ইচ্ছে করেই সেসব ক্ষেত্রে কিছুই লেখে না, কারণ OpenRouter-এর উত্তর
 *    সন্দেহজনক মানে "কিছু ভুল হয়েছে" নয় — "কিছু বদলানো হয়নি, আবার চেষ্টা
 *    করুন"। সাধারণ "validateError" বার্তাটা সেটা বোঝাত না।
 */
const VALIDATE_ABORT_I18N: Record<string, string> = {
  "empty-live-catalog": "aiSettings.toasts.validateAbortedEmpty",
  "incomplete-live-catalog": "aiSettings.toasts.validateAbortedIncomplete",
  "would-deprecate-all": "aiSettings.toasts.validateAbortedAll",
};

export default function AdminAISettingsPage() {
  const { t } = useTranslation("admin");

  const [settings, setSettings] = useState<AISettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchingOpenRouter, setFetchingOpenRouter] = useState(false);
  const [validatingModels, setValidatingModels] = useState(false);
  /** initial load সত্যিই ব্যর্থ হলে — পেজ আর "Loading…"-এ আটকে থাকে না। */
  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * `settings`-এর শেষ সেভ-হওয়া (বা DB থেকে পড়া) রূপ।
   *
   * ⚠️ এটা ছাড়া বোঝার উপায় নেই যে পর্দায় অসেভ করা পরিবর্তন আছে কি না — অথচ
   *    ReFetch / Fetch / Validate তিনটাই `settings`-কে DB-র মান দিয়ে
   *    প্রতিস্থাপন করে। ওগুলো চালানোর আগে এই পার্থক্য দেখে অসেভ করা কাজ
   *    আগে সেভ করে নেওয়া হয়, নাহলে admin-এর টাইপ করা credit নিঃশব্দে উবে যেত।
   */
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);

  /**
   * একসাথে দুইটা অপারেশন চলা আটকায়।
   *
   * ⚠️ state নয়, ref — কারণ গার্ডটা **সিঙ্ক্রোনাসভাবে** হতে হবে। ক্লিকের
   *    হ্যান্ডলার যখন চলে তখন `saving`-এর মতো state এখনো পুরনো রেন্ডারের মান
   *    ধরে রাখে, তাই দ্রুত দুইবার চাপলে (বা Save চলাকালীন Validate চাপলে)
   *    দুটোই চলে যেত — আর দুটোই পুরো `ai_credit_rules` লেখে, ফলে
   *    last-writer-wins: Validate-এর deprecated করা মডেল Save-এর পুরনো
   *    কপিতে আবার জীবিত হয়ে উঠত।
   */
  const busyRef = useRef(false);

  /**
   * পর্দার মান আর শেষ সেভ-হওয়া মানের মধ্যে ফারাক আছে কি না।
   *
   * Catalogue-র Credit ইনপুট, Merchant Active টগল আর USD→BDT রেট — এগুলো
   * লোকাল state-এ লেখে আর সেভ হয় উপরের "Save" বাটনে। তাই ReFetch / Fetch /
   * Validate চালানোর আগে এই পতাকাটা দেখে নেওয়া হয়।
   */
  const isDirty = useMemo(
    () =>
      settings !== null &&
      savedSnapshot !== null &&
      JSON.stringify(settings) !== savedSnapshot,
    [settings, savedSnapshot]
  );

  // Search & Multi-Criteria Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [creditFilter, setCreditFilter] = useState("all");
  // Price controls — `priceSort` orders the survivors, `priceRange` narrows them first.
  const [priceSort, setPriceSort] = useState<PriceSort>("default");
  const [priceRange, setPriceRange] = useState<PriceRange>("all");

  // Drawer & Modal state
  const [selectedModel, setSelectedModel] = useState<OpenRouterModelConfig | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<OpenRouterModelConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Advanced Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ── Auto-Collapse Main Admin Sidebar on Component Mount ──
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("driplare:collapse-sidebar", { detail: true })
    );
  }, []);

  // Reset to Page 1 when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, providerFilter, statusFilter, creditFilter, priceSort, priceRange]);

  // ── Fetch Settings ───────────────────────────────────────────────────────────
  /**
   * Loads settings from the API.
   *
   * `"refresh"` is the manual ReFetch path: the page already has data on screen,
   * so it stays mounted and only the ReFetch button spins. `"initial"` owns the
   * full-page placeholder — the only moment when there is genuinely nothing to show.
   *
   * ⚠️ আগে দুই পথেই `loading` সেট হত। তাতে ReFetch চাপলে পেজটা unmount হয়ে
   *    "Loading…" হয়ে যেত — অর্থাৎ বাটনটি নিজের লোডিং কখনোই দেখাতে পারত না,
   *    আর ইউজারের Search/Filter/Page সব হারিয়ে যেত।
   */
  const fetchSettings = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      try {
        // `no-store` — ReFetch-এর একমাত্র কাজই DB থেকে সত্যিকারের বর্তমান অবস্থা
        // আনা, তাই ব্রাউজার-ক্যাশ থেকে পুরনো উত্তর ফেরত আসা চলবে না।
        const res = await fetch("/api/admin/ai-settings", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load settings");
        const data = await res.json();
        setSettings(data);
        setSavedSnapshot(JSON.stringify(data));
        setLoadError(null);
      } catch {
        // ⚠️ initial load ব্যর্থ হলে পেজ আর চিরকাল "Loading…" দেখিয়ে বসে থাকে
        //    না — পুরো এরর-স্ক্রিন দেখানো হয়, Retry বাটনসহ। `refresh` পথে
        //    পর্দায় তো আগের ডেটাই আছে, তাই সেখানে শুধু টোস্ট।
        if (mode === "initial") {
          setLoadError(t("aiSettings.loadError", "Could not load AI settings."));
        } else {
          toast.error(t("aiSettings.loadError", "Could not load AI settings."));
        }
      } finally {
        if (mode === "refresh") setRefreshing(false);
        else setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // `onClick` hands the click event straight to its handler, so the ReFetch button
  // must not receive `fetchSettings` itself — the MouseEvent would land in the
  // `mode` slot and every click would read as an initial load.
  //
  // সাধারণ ফাংশন (useCallback নয়) — কারণ এটা `flushPendingEdits`-কে ডাকে,
  // যেটা ফাইলে আরও নিচে `persistSettings`-এর পরে তৈরি হয়। useCallback হলে
  // dependency অ্যারে ওটা রেফারেন্স করা হত **রেন্ডারের সময়ই**, অর্থাৎ
  // initialization-এর আগে — TDZ ReferenceError।
  const handleRefresh = async () => {
    if (busyRef.current) return;
    // অসেভ করা পরিবর্তন থাকলে আগে সেভ — নাহলে নিচের refresh সেগুলো মুছে দিত।
    if (!(await flushPendingEdits())) return;

    busyRef.current = true;
    try {
      await fetchSettings("refresh");
    } finally {
      busyRef.current = false;
    }
  };

  // ── Fetch Live OpenRouter Catalog & Persist DB ──
  /**
   * OpenRouter থেকে লাইভ ক্যাটালগ এনে DB-তে লেখে।
   *
   * ⚠️ আগে এখানে সার্ভারের উত্তরের উপর হাতে একটা merge হত (`isManualOverride`
   *    দেখে credit ফিরিয়ে আনা)। সেটা তুলে দেওয়া হয়েছে — সার্ভার নিজেই
   *    admin-এর credit/tier/toggle রক্ষা করে, তাই ওই merge কেবল পর্দায়
   *    পুরনো মান ফিরিয়ে আনার সুযোগ ছিল (বিশেষ করে অসেভ করা মান থাকলে)।
   *    এখন কেবল DB থেকে আবার পড়ে নেওয়া হয়, অর্থাৎ পর্দায় যা দেখা যায় তা
   *    হুবহু DB-তে যা আছে তাই।
   */
  const handleFetchOpenRouterModels = async () => {
    if (busyRef.current) return;
    if (!(await flushPendingEdits())) return;

    busyRef.current = true;
    setFetchingOpenRouter(true);
    try {
      const res = await fetch("/api/admin/ai-settings/fetch-models");
      if (!res.ok) throw new Error("Failed to fetch OpenRouter catalog");
      const data = await res.json();

      await fetchSettings("refresh");

      if (data.carriedOverCount > 0) {
        // ⚠️ চুপ করে থাকা যায় না: top-35-এর বাইরে পড়ে যাওয়া মডেলগুলো এখন
        //    মুছে যায় না, বরং অপরিবর্তিত রাখা হয় — admin জানতে পারেন।
        toast.success(
          t("aiSettings.toasts.fetchSuccessKept", {
            count: data.fetchedCount ?? data.total,
            kept: data.carriedOverCount,
          })
        );
      } else {
        toast.success(
          t("aiSettings.toasts.fetchSuccess", { count: data.fetchedCount ?? data.total })
        );
      }

      // ক্যাটালগে নতুন মডেল ঢোকার পর প্রিসেটের মডেলটা বন্ধ/অনুপস্থিত হয়ে
      // গেলে সেটাও জানাতে হয় — নাহলে admin জানতেই পারতেন না।
      if (data.violation) showCatalogViolation(data.violation);
    } catch {
      toast.error(t("aiSettings.toasts.fetchError"));
    } finally {
      setFetchingOpenRouter(false);
      busyRef.current = false;
    }
  };

  // ── Validate Model Status via OpenRouter ──────────────────────────────────
  const handleValidateModels = async () => {
    if (busyRef.current) return;
    if (!(await flushPendingEdits())) return;

    busyRef.current = true;
    setValidatingModels(true);
    try {
      const res = await fetch("/api/admin/ai-settings/validate-models", {
        method: "POST",
      });
      const data = await res.json().catch(() => null);

      // ⚠️ সার্ভার ইচ্ছে করেই কখনো কখনো থেমে যায় (OpenRouter-এর উত্তর
      //    সন্দেহজনক হলে) আর তখন কিছুই লেখে না। সেটা ব্যর্থতা নয় — তাই
      //    কারণটা ধরে ধরে বলা হয়, যাতে admin জানেন আবার চাপলেই চলবে।
      const abortKey = data?.code ? VALIDATE_ABORT_I18N[data.code] : undefined;
      if (!res.ok) {
        toast.error(
          abortKey ? t(abortKey) : t("aiSettings.toasts.validateError")
        );
        return;
      }

      // সার্ভার নিজেই DB-তে লিখেছে — তাই পর্দা তার সত্য থেকে নতুন করে পড়া হয়।
      await fetchSettings("refresh");

      if (data.deprecatedCount > 0) {
        toast.warning(
          t("aiSettings.toasts.validateDeprecated", { count: data.deprecatedCount })
        );
      } else {
        toast.success(t("aiSettings.toasts.validateSuccess"));
      }

      // ⚠️ ডিপ্রিকেট হয়ে ক্যাটালগের নিয়ম ভেঙে গেলে সেটাও জানাতে হয়।
      //    এই পথটা admin-এর নিজের কাজ নয় — OpenRouter নিজে মডেল তুলে নিয়েছে —
      //    তাই আটকানো হয় না, কিন্তু চুপ করে থাকাও যায় না: admin জানতে
      //    পারবেন না যে এখন ৫-এর কম মডেল চালু আছে, বা একটা প্রিসেট মডেল
      //    merchant-দের জন্য বন্ধ হয়ে গেছে।
      if (data.violation) showCatalogViolation(data.violation);
    } catch {
      toast.error(t("aiSettings.toasts.validateError"));
    } finally {
      setValidatingModels(false);
      // ⚠️ এই লাইনটা না থাকলে একবার "Validate Status" চাপার পর `busyRef` চিরকাল
      //    `true` হয়ে বসে থাকত — কারণ এই route-এর সফল পথটা `return` দিয়ে শেষ
      //    হয়, তাই `busyRef.current = false` লেখার আর কোনো জায়গা থাকে না।
      //    তখন লকটা নিজে থেকে খোলে না: ReFetch, Fetch, Save সব একসাথে পাথর হয়ে
      //    যেত, আর পেজ রিলোড করা ছাড়া আর কোনো উপায় থাকত না।
      busyRef.current = false;
    }
  };

  // ── Handlers for Model Updates & Deletion ───────────────────────────────────
  // ⚠️ প্রিসেট মডেল বাছাই আর প্রিসেট credit এখন `QuickSetupPresets`-এর নিজের
  //    ড্রাফটে থাকে, তাই এখানে আর `handleUpdateQuickSetup` নেই — ওই সেকশনের
  //    নিজের সেভ বাটনই `handleSavePresets` দিয়ে সেটা DB-তে লেখে।

  // ── Catalogue Rules ──────────────────────────────────────────────────────────
  /**
   * ক্যাটালগের নিয়ম ভাঙলে ব্যবহারকারীকে জানায়।
   *
   * violation অবজেক্টটাই সরাসরি `t()`-এর values হিসেবে দেওয়া হয় — তাই
   * `{{required}}`, `{{activeCount}}`, `{{presetLabel}}` আলাদা করে বসাতে হয় না।
   *
   * ⚠️ সাধারণ ফাংশন — `useCallback` নয়। নিচের `checkCatalog` / `persistSettings`
   *    থেকে ডাকা হলেও এরা কোথাও hook-এর dependency হিসেবে যায় না, তাই মেমোয়ের
   *    কোনো লাভ নেই; বরং React Compiler তখনই "memoization ধরে রাখা গেল না" বলে
   *    পুরো কম্পোনেন্টটা অপ্টিমাইজ করা ছেড়ে দেয়।
   */
  const showCatalogViolation = (violation: CatalogViolation) => {
    toast.error(t(CATALOG_VIOLATION_I18N[violation.code], { ...violation }));
  };

  /**
   * প্রস্তাবিত মডেল-তালিকা নিয়ে নিয়ম যাচাই — ঠিক থাকলে `true`।
   *
   * ⚠️ একটাই ভ্যালিডেটর, দুইটা নিয়ম (সর্বনিম্ন ৫টা active + প্রিসেট active
   *    মডেলে হতে হবে)। তাই টগল, Drawer আর ডিলিট — তিন পথেই একই উত্তর আসে।
   *    `lib/domain/model-catalog.ts`-এর এই ফাংশনটাই সার্ভারেও চলে, ফলে
   *    ক্লায়েন্টের গার্ড কখনো সার্ভারের চেয়ে ঢিলা হতে পারে না।
   */
  const checkCatalog = (
    models: OpenRouterModelConfig[],
    // প্রিসেট সেকশন সেভ করার সময় quickSetup এখনো `settings`-এ বসেনি —
    // তখন ড্রাফটের মানটা এখান দিয়ে দেওয়া হয়, নাহলে পুরনো মান যাচাই হত।
    quickSetup: AISettingsData["quickSetup"] | undefined = settings?.quickSetup
  ): boolean => {
    const violation = validateModelCatalog({ models, quickSetup });
    if (!violation) return true;
    showCatalogViolation(violation);
    return false;
  };

  // ── Save Settings ────────────────────────────────────────────────────────────
  /**
   * প্রিসেট ড্রাফটটা `settings`-এর উপরে বসিয়ে নতুন অবজেক্ট বানায়।
   *
   * ⚠️ কেবল ড্রাফটে থাকা মডেলের credit-ই লেখা হয়। সব মডেলের উপর ড্রাফট চাপালে
   *    admin যা ছোঁয়ইনি তার উপরেও জোর করে মান বসে যেত।
   */
  const applyQuickSetupDraft = (
    current: AISettingsData,
    draft: QuickSetupDraft
  ): AISettingsData => ({
    ...current,
    quickSetup: { ...draft.quickSetup },
    models: current.models.map((m) =>
      typeof draft.credits[m.id] === "number"
        ? { ...m, credits: draft.credits[m.id], isManualOverride: true }
        : m
    ),
  });

  /**
   * পুরো `ai_credit_rules` সেভ করে। সফল হলে `true`।
   *
   * ⚠️ ব্যর্থ হলে আগের অবস্থায় ফিরিয়ে আনা হয় — নাহলে পর্দায় নতুন মান দেখাত,
   *    অথচ DB-তে পুরনো মান থেকে যেত। আর সেভের পরে রিফেচ হয় `"refresh"` মোডে,
   *    কারণ `"initial"` দিলে পুরো পেজ unmount হয়ে "Loading…" ঝলক দিত — অর্থাৎ
   *    সেভ করার পর admin-এর Search/Filter/Page সব হারিয়ে যেত।
   */
  const persistSettings = async (
    next: AISettingsData,
    options?: {
      /** Drawer নিজের বার্তা দেখায় (মডেলের নাম ধরে) — সাধারণ টোস্ট চাপা পড়ে। */
      silentSuccess?: boolean;
      /** ব্যর্থ হলে সাধারণ "saveError"-এর বদলে এই key-এর বার্তা দেখানো হয়। */
      errorKey?: string;
    }
  ): Promise<boolean> => {
    if (!settings) return false;

    // ⚠️ একসাথে দুইটা সেভ কখনো চলবে না — দুটোই পুরো `ai_credit_rules` লেখে,
    //    তাই last-writer-wins হলে একটা অপারেশনের ফল আরেকটা মুছে দিত।
    if (busyRef.current) return false;
    busyRef.current = true;

    const previous = settings;
    setSettings(next);
    setSaving(true);

    try {
      const res = await fetch("/api/admin/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });

      if (!res.ok) {
        // ⚠️ সার্ভার ক্যাটালগের নিয়মে আটকালে কারণটা দেখানো হয়। সাধারণ
        //    "সেভ করা গেল না" বার্তা admin-কে বলত না ঠিক কী করতে হবে, অথচ
        //    এই ৪০০-টা কোনো দুর্ঘটনা নয় — এটা ইচ্ছাকৃত নিয়ম।
        const payload = await res.json().catch(() => null);
        setSettings(previous);
        if (payload?.violation) {
          showCatalogViolation(payload.violation);
        } else {
          toast.error(
            options?.errorKey
              ? t(options.errorKey)
              : t("aiSettings.saveError", "Could not save settings. Please try again.")
          );
        }
        return false;
      }

      if (!options?.silentSuccess) {
        toast.success(t("aiSettings.saveSuccess", "AI & Credit rules updated successfully!"));
      }
      await fetchSettings("refresh");
      return true;
    } catch {
      setSettings(previous);
      toast.error(
        options?.errorKey
          ? t(options.errorKey)
          : t("aiSettings.saveError", "Could not save settings. Please try again.")
      );
      return false;
    } finally {
      setSaving(false);
      busyRef.current = false;
    }
  };

  /**
   * অসেভ করা পরিবর্তন থাকলে সেগুলো আগে সেভ করে।
   *
   * ⚠️ ReFetch / Fetch / Validate — তিনটাই `settings`-কে DB-র মান দিয়ে
   *    প্রতিস্থাপন করে। admin Catalogue-র Credit ইনপুটে কিছু লিখে (এখনো
   *    Save না চেপে) ওগুলোর যেকোনোটা চাপলে তাঁর লেখাটা নিঃশব্দে উবে যেত —
   *    কোনো সতর্কবার্তা ছাড়াই। এখন আগে সেভ হয়ে যায়, তাই কিছুই হারায় না।
   *
   * সেভ ব্যর্থ হলে (নিয়ম ভাঙা / নেটওয়ার্ক) `false` ফেরে, আর ডাকার জায়গায়
   * অপারেশনটাই চলে না — কারণটা টোস্টে আগেই দেখানো হয়ে গেছে।
   */
  const flushPendingEdits = async (): Promise<boolean> => {
    if (!isDirty || !settings) return true;
    return persistSettings(settings, { silentSuccess: true });
  };

  /** হেডারের সেভ — পেজে যা আছে ঠিক তাই পাঠায়। */
  const handleSave = () => {
    if (!settings) return;
    void persistSettings(settings);
  };

  /**
   * Quick Setup Presets সেকশনের নিজের সেভ।
   *
   * আগে প্রিসেট কার্ডের প্রতিটি পরিবর্তন সঙ্গে সঙ্গে `settings`-এ চলে যেত,
   * আর সেভ করতে হত পেজের একদম উপরের হেডার বাটনে — অথচ কার্ডগুলো অনেক নিচে।
   */
  const handleSavePresets = (draft: QuickSetupDraft): Promise<boolean> => {
    if (!settings) return Promise.resolve(false);

    const next = applyQuickSetupDraft(settings, draft);

    // সার্ভারে যাওয়ার আগেই নিয়ম যাচাই — নাহলে অকারণে একটা round-trip নষ্ট হয়,
    // আর admin দ্রুত উত্তর পান।
    if (!checkCatalog(next.models, next.quickSetup)) return Promise.resolve(false);

    return persistSettings(next);
  };

  /**
   * Drawer থেকে Merchant Active বদলানোর অনুমতি চাওয়া।
   *
   * ⚠️ Drawer নিজে `settings.models` দেখতে পায় না (তার হাতে কেবল খোলা মডেলটা),
   *    তাই হিসাবটা এখানেই হয় — নাহলে ওই টগলটা গার্ড এড়িয়ে যেত।
   */
  const requestMerchantActiveChange = (
    model: OpenRouterModelConfig,
    nextActive: boolean
  ): boolean => {
    if (!settings) return false;

    // ⚠️ এখানে আগে `m.isDeprecated ? false : nextActive` লেখা হত। সেটা
    //    তুলে দেওয়া হয়েছে — deprecated মডেল merchant-দের কাছে যাওয়া
    //    আটকায় `isActiveModel` নিজেই (`isDeprecated` দেখে), অথচ
    //    `isMerchantActive` admin-এর নিজের সিদ্ধান্ত। জোর করে `false`
    //    বসালে মডেলটা একদিন OpenRouter-এ ফিরে এলেও তাঁর বন্ধ-অন অবস্থা
    //    আর কখনো ফিরত না।
    const nextModels = settings.models.map((m) =>
      m.id === model.id ? { ...m, isMerchantActive: nextActive } : m
    );

    return checkCatalog(nextModels);
  };

  const handleToggleMerchantActive = (modelId: string, active: boolean) => {
    if (!settings) return;
    const updated = settings.models.map((m) =>
      m.id === modelId ? { ...m, isMerchantActive: active } : m
    );
    // নিয়ম ভাঙলে কিছুই বদলানো হয় না — টগলটা নিজের আগের অবস্থায় ফিরে যায়।
    // (error toast টা `checkCatalog` নিজেই দেখায়।)
    if (!checkCatalog(updated)) return;
    setSettings({ ...settings, models: updated });
  };

  const handleUpdateCreditCost = (modelId: string, credits: number) => {
    if (!settings) return;
    const updated = settings.models.map((m) =>
      m.id === modelId ? { ...m, credits, isManualOverride: true } : m
    );
    setSettings({ ...settings, models: updated });
  };

  /**
   * USD → BDT রেট আপডেট।
   *
   * ⚠️ এখানে ইচ্ছে করেই ক্ল্যাম্প করা হয় না — admin যখন "১২" টাইপ করছেন
   *    (১২৯ লিখতে গিয়ে), তখনই জোর করে ১ করে দিলে ইনপুটটা লাফিয়ে যেত।
   *    তাই শুধু সংখ্যা কি না দেখা হয়; আসল sanitize হয় সেভ করার সময়
   *    API route-এ (`sanitizeUsdToBdtRate`)।
   */
  const handleUpdateUsdToBdtRate = (value: number) => {
    if (!settings) return;
    if (!Number.isFinite(value) || value <= 0) return;
    setSettings({ ...settings, usdToBdtRate: value });
  };

  /**
   * Drawer-এর "Apply Changes" — এটাই এখন ফাইনাল, সোজা DB-তে যায়।
   *
   * ⚠️ আগে এই ফাংশন কেবল `settings`-এ মান বসিয়ে একটা টোস্ট দেখাত; আসল সেভ হত
   *    পেজের একদম উপরের "Save" বাটনে চাপলে। তাতে admin ড্রয়ার বন্ধ করে উপরে না
   *    উঠলে পর্দায় নতুন Credit দেখতেন অথচ DB-তে পুরনোটা থেকে যেত — আর পরের
   *    রিফেচে সেটা নীরবে উবে যেত।
   *
   * `true` ফিরলেই Drawer বন্ধ হয় (দেখুন `ModelConfigSheet`) — তাই ব্যর্থ হলে
   * এররটা প্যানেলের ভেতরেই চোখের সামনে থাকে।
   */
  const handleUpdateModelConfig = async (
    updatedModel: OpenRouterModelConfig
  ): Promise<boolean> => {
    if (!settings) return false;

    const updatedModels = settings.models.map((m) =>
      m.id === updatedModel.id ? updatedModel : m
    );

    // Drawer-এর Merchant Active টগলটাও active সংখ্যা বদলাতে পারে, তাই একই
    // নিয়ম এখানেও — নাহলে Drawer হয়ে ক্যাটালগের গার্ড এড়িয়ে যাওয়ার পথ
    // থেকে যেত (টগলটা তো কেবল প্রস্তাব, সত্যি হয় Apply-তে)।
    if (!checkCatalog(updatedModels)) return false;

    const saved = await persistSettings(
      { ...settings, models: updatedModels },
      { silentSuccess: true }
    );

    if (saved) {
      toast.success(t("aiSettings.toasts.configUpdated", { name: updatedModel.name }));
    }
    return saved;
  };

  const confirmDeleteModel = async () => {
    if (!modelToDelete || !settings) return;

    const updatedModels = settings.models.filter((m) => m.id !== modelToDelete.id);

    // ⚠️ ডিলিটও নিয়ম ভাঙতে পারে — active সংখ্যা ৫-এর নিচে নামিয়ে দিতে পারে।
    //    প্রিসেটের মডেল ডিলিট করা ইচ্ছে করেই আটকানো হয় না (মডেলটা তো সত্যিই
    //    OpenRouter থেকে উঠে গেল); ওই অবস্থার জন্য `QuickSetupPresets`-এ
    //    "not in catalog" সতর্কবার্তা আগে থেকেই আছে।
    if (!checkCatalog(updatedModels)) return;

    setDeleting(true);
    // ⚠️ আগে এখানে আলাদা করে হাতে optimistic update + rollback লেখা ছিল —
    //    `persistSettings`-এর ঠিক যেটা করে। দুই কপি থাকলে একটা বদলালে
    //    আরেকটা পিছিয়ে পড়ে, তাই এখন একই পথ।
    const saved = await persistSettings(
      { ...settings, models: updatedModels },
      { silentSuccess: true, errorKey: "aiSettings.toasts.deleteError" }
    );
    setDeleting(false);

    if (!saved) return; // ব্যর্থতার কারণ `persistSettings` নিজেই দেখিয়েছে

    toast.success(
      t("aiSettings.toasts.deleteSuccess", {
        name: modelToDelete.name || t("aiSettings.deleteModal.modelFallback"),
      })
    );
    setModelToDelete(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">{t("aiSettings.loading", "Loading AI & Credit settings…")}</p>
      </div>
    );
  }

  // ⚠️ DB পড়তে ব্যর্থ হলে আগে পেজ চিরকাল "Loading…" দেখিয়ে বসে থাকত (আর
  //    শুধু একটা টোস্ট দেখা যেত, যেটা একবারে উবে যায়)। এখন স্পষ্ট এরর-স্ক্রিন
  //    আর Retry বাটন — admin আটকে থাকেন না, আর ভুল করে ফাঁকা পেজে Save
  //    চেপে ফেলার সুযোগও নেই।
  if (!settings) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div className="max-w-md space-y-1.5">
          <h4 className="text-base font-bold text-foreground">
            {t("aiSettings.loadErrorTitle")}
          </h4>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {loadError ?? t("aiSettings.loadError", "Could not load AI settings.")}
          </p>
        </div>
        <Button
          onClick={() => void fetchSettings("initial")}
          disabled={loading}
          className="gap-2 rounded-xl bg-brand-gradient text-primary-foreground hover:opacity-90"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          {t("aiSettings.retry")}
        </Button>
      </div>
    );
  }

  // Dynamically derive unique provider list from loaded models dataset
  const uniqueProviders = Array.from(
    new Set(settings.models.map((m) => m.provider))
  ).filter(Boolean);

  // Multi-Criteria Model Filtering
  const filteredModels = settings.models.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.provider.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesProvider =
      providerFilter === "all" || m.provider.toLowerCase() === providerFilter.toLowerCase();

    let matchesStatus = true;
    if (statusFilter === "active") matchesStatus = !m.isDeprecated;
    else if (statusFilter === "deprecated") matchesStatus = !!m.isDeprecated;
    else if (statusFilter === "merchant-on") matchesStatus = m.isMerchantActive;
    else if (statusFilter === "merchant-off") matchesStatus = !m.isMerchantActive;

    let matchesCredit = true;
    if (creditFilter === "1") matchesCredit = m.credits === 1;
    else if (creditFilter === "3") matchesCredit = m.credits === 3;
    else if (creditFilter === "5") matchesCredit = m.credits === 5;
    else if (creditFilter === "custom") matchesCredit = m.credits !== 1 && m.credits !== 3 && m.credits !== 5;

    return (
      matchesSearch &&
      matchesProvider &&
      matchesStatus &&
      matchesCredit &&
      matchesPriceRange(m, priceRange)
    );
  });

  // সাজানো হয় ফিল্টারের পরে — নাহলে বাদ পড়া মডেলগুলোও ক্রমে জায়গা নিত।
  const visibleModels = sortByPrice(filteredModels, priceSort);

  // Calculate Pagination Values
  const totalItems = visibleModels.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedModels = visibleModels.slice(startIndex, startIndex + pageSize);

  return (
    <div className="flex flex-col gap-6 w-full max-w-full pb-10">
      {/* ── 1. Full-Screen Blur Overlay Loading for "Validate Status" ── */}
      {validatingModels && (
        <div className="fixed inset-0 z-50 bg-background/75 backdrop-blur-md flex flex-col items-center justify-center gap-4 p-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-xl animate-pulse">
            <ShieldAlert className="h-8 w-8 animate-spin" />
          </div>
          <div className="space-y-1.5 max-w-md">
            <h4 className="text-lg font-bold tracking-tight text-foreground">
              {t("aiSettings.validatingTitle")}
            </h4>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t("aiSettings.validatingSub")}
            </p>
          </div>
        </div>
      )}

      {/* ── Top Header ── */}
      <AISettingsHeader
        validatingModels={validatingModels}
        fetchingOpenRouter={fetchingOpenRouter}
        saving={saving}
        refreshing={refreshing}
        dirty={isDirty}
        onValidateModels={handleValidateModels}
        onFetchOpenRouterModels={handleFetchOpenRouterModels}
        onReFetch={handleRefresh}
        onSave={handleSave}
      />

      {/* ── Top Card: Quick Setup Presets (Non-Pro Merchants) ── */}
      <QuickSetupPresets
        settings={settings}
        saving={saving}
        onSave={handleSavePresets}
      />

      {/* ── Simplified LLM Catalog Table & Pagination Section ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="w-full space-y-4"
      >
        {/* Toolbar with Multi-Criteria Filters */}
        <ModelCatalogToolbar
          totalItems={totalItems}
          usdToBdtRate={settings.usdToBdtRate}
          onUsdToBdtRateChange={handleUpdateUsdToBdtRate}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          providerFilter={providerFilter}
          onProviderFilterChange={setProviderFilter}
          uniqueProviders={uniqueProviders}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          creditFilter={creditFilter}
          onCreditFilterChange={setCreditFilter}
          priceSort={priceSort}
          onPriceSortChange={setPriceSort}
          priceRange={priceRange}
          onPriceRangeChange={setPriceRange}
        />

        {/* Catalog Table & Pagination Controls */}
        <div className="w-full border rounded-2xl bg-card shadow-xs overflow-hidden">
          <ModelCatalogTable
            paginatedModels={paginatedModels}
            settings={settings}
            onUpdateCreditCost={handleUpdateCreditCost}
            onToggleMerchantActive={handleToggleMerchantActive}
            onConfigureModel={(model) => {
              setSelectedModel(model);
              setIsSheetOpen(true);
            }}
            onDeleteModel={(model) => setModelToDelete(model)}
          />

          <ModelPagination
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            startIndex={startIndex}
            onPageChange={setCurrentPage}
          />
        </div>
      </motion.div>

      {/* ── Configure Model Drawer ── */}
      <ModelConfigSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        model={selectedModel}
        onSave={handleUpdateModelConfig}
        // Drawer-এর টগলকেও একই গার্ডের ভেতর দিয়ে যেতে হবে, নাহলে ওই পথটা
        // ক্যাটালগের নিয়ম এড়িয়ে যাওয়ার সুযোগ হয়ে যেত।
        onRequestMerchantActiveChange={(nextActive) =>
          selectedModel ? requestMerchantActiveChange(selectedModel, nextActive) : false
        }
      />

      {/* ── Delete Confirmation Modal ── */}
      <DeleteModelModal
        modelToDelete={modelToDelete}
        onClose={() => setModelToDelete(null)}
        onConfirm={confirmDeleteModel}
        deleting={deleting}
      />
    </div>
  );
}
