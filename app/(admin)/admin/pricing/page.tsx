"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeCatalogue, type PricingCatalogue } from "@/lib/domain/pricing-catalogue";

import { CouponEditor } from "./_components/CouponEditor";
import { DiscountEditor, PlanPriceEditor } from "./_components/PlanPriceEditor";
import { PricingHeader } from "./_components/PricingHeader";
import { TopUpPriceEditor } from "./_components/TopUpPriceEditor";
import { resolveProblem } from "./_components/problem-message";
import {
  draftFromCatalogue,
  draftToPayload,
  emptyDraft,
  EDITABLE_REGIONS,
  validateDraft,
  type CouponDraft,
  type PricingDraft,
} from "./_components/types";

/**
 * `/admin/pricing` — ডাইনামিক প্রাইসিং (১৫.৭)
 * ─────────────────────────────────────────────────────────────────────────────
 * ── ⚠️ কেন DB পড়তে ব্যর্থ হলে **ফর্মই দেখানো হয় না** ────────────────────────
 * Save পুরো বিন্যাসটি **প্রতিস্থাপন** করে। অর্থাৎ যে admin পর্দা লোড না করেই
 * Save চাপেন, তিনি সব দাম মুছে দিয়ে কোডের ডিফল্ট বসিয়ে দেন। তাই ব্যর্থ পড়ায়
 * ফর্ম দেখানো বন্ধ করা হয় এবং একটি পুনঃচেষ্টার পথ দেওয়া হয় — পর্দার যে
 * গার্ডটি লিখতে হয় না, সেটিই সবচেয়ে কার্যকর গার্ড।
 * (`/api/admin/pricing` GET-ও এই কারণেই ডিফল্ট নয়, ৫০০ দেয়।)
 *
 * ── ⚠️ অসেভ করা পরিবর্তনের হিসাব ─────────────────────────────────────────────
 * `savedSnapshot` হলো শেষ সেভ-হওয়া (বা DB থেকে পড়া) খসড়ার JSON। ReFetch চাপলে
 * পুরনো মান এসে পর্দার টাইপ করা কাজ মুছে দিত — তাই ফারাক থাকলে আগে জিজ্ঞেস করা
 * হয়। `ai-settings` পর্দার ঠিক একই নীতি।
 */
export default function AdminPricingPage() {
  const { t } = useTranslation("admin");

  const [draft, setDraft] = useState<PricingDraft>(emptyDraft);
  const [redemptions, setRedemptions] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);

  /**
   * ⚠️ `state` নয়, `ref` — একসাথে দুই অপারেশন চলা আটকাতে।
   * কারণ গার্ডটি **সিঙ্ক্রোনাসভাবে** হতে হবে: ক্লিক-হ্যান্ডলার যখন চলে তখন
   * `saving` state এখনো পুরনো রেন্ডারের মান ধরে রাখে, তাই দ্রুত দুইবার চাপলে
   * দুটোই চলে যেত — আর দুটোই **পুরো** বিন্যাস লেখে।
   */
  const busyRef = useRef(false);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (busyRef.current) return;
      busyRef.current = true;

      if (mode === "initial") setLoading(true);
      else setRefreshing(true);

      try {
        const res = await fetch("/api/admin/pricing");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const body = await res.json();
        // ⚠️ `normalizeCatalogue` এখানেও — কারণ server-এর উত্তরের উপর অন্ধ
        //    বিশ্বাস করে সরাসরি `draftFromCatalogue`-এ ঢুকলে একটি অস্বাভাবিক
        //    মান (যেমন `"2499"` string) পর্দায় অদ্ভুত কিছু বসিয়ে দিত।
        const catalogue: PricingCatalogue = normalizeCatalogue(body.catalogue);
        const nextDraft = draftFromCatalogue(catalogue);

        setDraft(nextDraft);
        setSavedSnapshot(JSON.stringify(nextDraft));
        setRedemptions((body.redemptions ?? {}) as Record<string, number>);
        setLoadError(false);
      } catch (error) {
        console.error("[ADMIN_PRICING_LOAD]", error);
        // ⚠️ এখানে `toast` **নয়**, একটি পূর্ণ-পর্দার অবস্থা: একটি টোস্ট কয়েক
        //    সেকেন্ডে মিলিয়ে যায়, অথচ সমস্যাটি তখনো আছে — আর তারপর পর্দায়
        //    একটি খালি ফর্ম থেকে যায় যা admin নির্দোষ ভেবে ভরে ফেলতেন।
        setLoadError(true);
      } finally {
        busyRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    load("initial");
  }, [load]);

  const dirty = savedSnapshot !== null && JSON.stringify(draft) !== savedSnapshot;

  const handleReFetch = () => {
    // ⚠️ অসেভ করা কাজ থাকলে থামানো হয় — কারণ ReFetch পর্দা DB-র মান দিয়ে
    //    প্রতিস্থাপন করে, আর admin-এর টাইপ করা দুই ডজন দাম নিঃশব্দে উবে যাওয়া
    //    সবচেয়ে খারাপ ধরনের ক্ষতি।
    if (dirty && !window.confirm(t("pricing.unsavedConfirm"))) return;
    load("refresh");
  };

  const handleSave = async () => {
    if (busyRef.current) return;

    const problems = validateDraft(draft);
    if (problems.length > 0) {
      // প্রথম সমস্যাটিই বলা হয়, সবগুলো একসাথে নয়: একটি টোস্টে ৫টি বাক্য
      // পড়া যায় না, আর প্রথমটি ঠিক করলে দ্বিতীয়টি প্রায়ই বদলে যায়।
      toast.error(resolveProblem(t, problems[0]));
      return;
    }

    busyRef.current = true;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToPayload(draft)),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        // ⚠️ Zod-এর `details` থাকলে সেটিই দেখানো হয়। কারণ server-এর যাচাই
        //    client-এর চেয়ে কঠিন, আর "Validation failed" লেখা একটি বার্তা
        //    admin-কে বলত না **কোন ঘরটি** ভুল।
        const details = body?.details;
        const firstFieldError =
          details?.fieldErrors && typeof details.fieldErrors === "object"
            ? // Zod-এর `flatten()` একটি কাঁচা path-ভিত্তিক মান ফেরত দেয়;
              // প্রথম উপলব্ধ বার্তাটিই এখানে সবচেয়ে সহায়ক।
              (Object.values(details.fieldErrors)[0] as string[] | undefined)?.[0]
            : undefined;
        throw new Error(firstFieldError ?? t("pricing.saveError"));
      }

      // server যা সংরক্ষিত করেছে **তাই** পর্দায় ফেরত বসানো হয় — কারণ
      // `savePricingCatalogue` normalize করা মান লেখে, admin যা পাঠিয়েছেন
      // তা নয়। নইলে পর্দায় এমন একটি মান থাকত যা DB-তে নেই।
      const saved: PricingCatalogue = normalizeCatalogue(body.catalogue);
      const nextDraft = draftFromCatalogue(saved);
      setDraft(nextDraft);
      setSavedSnapshot(JSON.stringify(nextDraft));
      toast.success(t("pricing.saved"));
    } catch (error) {
      console.error("[ADMIN_PRICING_SAVE]", error);
      const message = error instanceof Error ? error.message : t("pricing.saveError");
      toast.error(message);
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  // ── Patch helpers ──────────────────────────────────────────────────────────

  const setPlanPrice = (
    region: "bd" | "global",
    planKey: string,
    cycle: "monthly" | "yearly",
    value: string
  ) =>
    setDraft((prev) => ({
      ...prev,
      plans: {
        ...prev.plans,
        [region]: {
          ...prev.plans[region],
          [planKey]: { ...prev.plans[region][planKey], [cycle]: value },
        },
      },
    }));

  const setPlanHidden = (region: "bd" | "global", planKey: string, hidden: boolean) =>
    setDraft((prev) => ({
      ...prev,
      plans: {
        ...prev.plans,
        [region]: {
          ...prev.plans[region],
          [planKey]: { ...prev.plans[region][planKey], hidden },
        },
      },
    }));

  const setDiscount = (
    region: "bd" | "global",
    field: "discountPercent" | "annualDiscountPercent",
    value: string
  ) => setDraft((prev) => ({ ...prev, [field]: { ...prev[field], [region]: value } }));

  const setTopUp = (packageId: string, value: string) =>
    setDraft((prev) => ({ ...prev, topUps: { ...prev.topUps, [packageId]: value } }));

  const setCoupon = (index: number, patch: Partial<CouponDraft>) =>
    setDraft((prev) => ({
      ...prev,
      coupons: prev.coupons.map((coupon, i) => (i === index ? { ...coupon, ...patch } : coupon)),
    }));

  const addCoupon = () =>
    setDraft((prev) => ({
      ...prev,
      coupons: [
        ...prev.coupons,
        {
          code: "",
          mode: "percent" as const,
          value: "",
          appliesTo: "both" as const,
          maxRedemptions: "",
          expiresAt: "",
          isActive: true,
        },
      ],
    }));

  const removeCoupon = (index: number) =>
    setDraft((prev) => ({
      ...prev,
      coupons: prev.coupons.filter((_, i) => i !== index),
    }));

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("pricing.loadErrorTitle")}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {t("pricing.loadError")}
          </p>
        </div>
        <Button onClick={() => load("initial")} className="rounded-xl">
          {t("pricing.retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <PricingHeader
        saving={saving}
        refreshing={refreshing}
        dirty={dirty}
        onReFetch={handleReFetch}
        onSave={handleSave}
      />

      {/* ── ছাড় (region-ভেদে) ── */}
      <div className="grid gap-5 lg:grid-cols-2">
        {EDITABLE_REGIONS.map((region) => (
          <DiscountEditor
            key={region}
            region={region}
            discountPercent={draft.discountPercent[region]}
            annualDiscountPercent={draft.annualDiscountPercent[region]}
            onDiscountChange={(value) => setDiscount(region, "discountPercent", value)}
            onAnnualChange={(value) =>
              setDiscount(region, "annualDiscountPercent", value)
            }
          />
        ))}
      </div>

      {/* ── plan-এর দাম ── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">{t("pricing.plan.title")}</CardTitle>
          <CardDescription>{t("pricing.plan.desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {EDITABLE_REGIONS.map((region) => (
            <PlanPriceEditor
              key={region}
              region={region}
              rows={draft.plans[region]}
              onPriceChange={(planKey, cycle, value) =>
                setPlanPrice(region, planKey, cycle, value)
              }
              onHiddenChange={(planKey, hidden) => setPlanHidden(region, planKey, hidden)}
            />
          ))}
        </CardContent>
      </Card>

      {/* ── top-up pack ── */}
      <TopUpPriceEditor rows={draft.topUps} onChange={setTopUp} />

      {/* ── কুপন ── */}
      <CouponEditor
        coupons={draft.coupons}
        redemptions={redemptions}
        onChange={setCoupon}
        onAdd={addCoupon}
        onRemove={removeCoupon}
      />
    </div>
  );
}
