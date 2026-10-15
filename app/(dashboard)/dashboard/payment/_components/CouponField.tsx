"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { BadgePercent, Check, Loader2, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { Region } from "@/lib/core/region";
import type { BillingCycle } from "@/lib/domain/billing-cycle";
import { formatPrice, type CouponReject } from "@/lib/domain/pricing-catalogue";

/**
 * কুপন কোডের ঘর (১৫.৭)
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ **এই ঘরটি কোনো ছাড় বসায় না — কিছুই না।** কোডটি কেবল ধরা থাকে, আর checkout-এ
 *    [`charge`](app/api/payments/uddoktapay/charge/route.ts)-এ **server-এ** আবার
 *    যাচাই ও হিসাব হয়। কারণ client-এ ছাড় বসানো মানে যে কেউ devtools খুলে
 *    `discountAmount` বদলে ফেলতে পারত; আর এখানকার দেখানো সংখ্যা কেবল
 *    **ভদ্রতার জন্য**, দামের দলিল নয়।
 *
 * ⚠️ কেন আলাদা endpoint ডাকা হয় (`/api/payments/coupon/preview`): কুপন-তালিকা
 *    কখনো client-এ পাঠানো হয় না (`toPublicCatalogue`), কারণ প্রতিটি merchant-কে
 *    সব কুপন কোড দেখানো মানে কোডগুলোই ফাঁস করা। তাই যাচাই server-এ, আর এখানে
 *    কেবল ফলাফল দেখানো হয়।
 *
 * ⚠️ `previewPackageId` **null** হতে পারে, এবং তখন ছাড় কিছুই দেখানো হয় না —
 *    কারণ "কত ছাড়" প্রশ্নের উত্তর নির্ভর করে **কোনটি কেনা হচ্ছে** তার উপর
 *    (`appliesTo` = plan / topup, আর plan-ভেদে আলাদা দাম)। একটি ঘর দিয়ে আমরা
 *    জানি না merchant উপরের কোন কার্ডে চাপ দেবেন। ভুল package ধরে হিসাব করে
 *    একটি **মিথ্যা দাম** দেখানোর চেয়ে "checkout-এ যাচাই হবে" বলা অনেক সৎ।
 */

type PreviewState =
  | { kind: "idle" }
  | { kind: "checking" }
  /** package জানা নেই — checkout ছাড়া ছাড়ের সংখ্যা বলা সম্ভব নয়। */
  | { kind: "unknown" }
  | { kind: "applied"; discountAmount: number; finalAmount: number; discountPercent: number }
  | { kind: "rejected"; reason: CouponReject }
  /** নেটওয়ার্ক/server সমস্যা — কোডটি খারাপ নয়, জানা যায়নি। */
  | { kind: "failed" };

/**
 * ⚠️ `Record<CouponReject, …>` — `switch` নয়। ইউনিয়নে একটি নতুন কারণ যোগ হলে
 *    এখানে একটি টাইপ-ত্রুটি জন্মাবে, অর্থাৎ অনুবাদহীন একটি কারণ পর্দায়
 *    `coupon.reason.xyz` নামের কাঁচা key দেখানোর সুযোগ থাকবে না।
 */
const REASON_KEY: Record<CouponReject, string> = {
  not_found: "coupon.reason.notFound",
  inactive: "coupon.reason.inactive",
  expired: "coupon.reason.expired",
  limit_reached: "coupon.reason.limitReached",
  not_applicable: "coupon.reason.notApplicable",
};

const DEBOUNCE_MS = 450;

export function CouponField({
  value,
  onChange,
  previewPackageId,
  cycle,
}: {
  value: string;
  onChange: (value: string) => void;
  /** যে package-এর জন্য ছাড় দেখানো হবে; `null` হলে যাচাই হবে checkout-এ। */
  previewPackageId: string | null;
  cycle: BillingCycle;
}) {
  const { t, i18n } = useTranslation("payment");
  const [state, setState] = useState<PreviewState>({ kind: "idle" });

  const trimmed = value.trim();

  useEffect(() => {
    // ফাঁকা ঘরে প্রশ্ন নেই।
    if (!trimmed) {
      setState({ kind: "idle" });
      return;
    }

    if (!previewPackageId) {
      setState({ kind: "unknown" });
      return;
    }

    // ⚠️ `cancelled` — দ্রুত টাইপ করলে পুরনো অনুরোধের উত্তর দেরিতে এসে নতুন
    //    উত্তরের উপর চড়ে বসতে পারত ("২০%" লেখা থাকত, অথচ সর্বশেষ কোডটি ছিল
    //    ভুল)। cleanup-এ পতাকা উঁচু করে দেরিতে-আসা উত্তর ফেলে দেওয়া হয়।
    let cancelled = false;
    setState({ kind: "checking" });

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/payments/coupon/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            package_id: previewPackageId,
            coupon_code: trimmed,
            cycle,
          }),
        });

        if (cancelled) return;

        if (!res.ok) {
          // gate-এর আটকানো (403) বা server সমস্যা — কোডটি সম্পর্কে কিছু জানা
          // গেল না, তাই কোডটিকে দোষ দেওয়া হয় না।
          setState(res.status === 403 ? { kind: "unknown" } : { kind: "failed" });
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        if (data.ok === true) {
          setState({
            kind: "applied",
            discountAmount: Number(data.discountAmount) || 0,
            finalAmount: Number(data.finalAmount) || 0,
            discountPercent: Number(data.discountPercent) || 0,
          });
        } else {
          setState({
            kind: "rejected",
            reason: (data.reason ?? "not_found") as CouponReject,
          });
        }
      } catch {
        if (!cancelled) setState({ kind: "failed" });
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, previewPackageId, cycle]);

  // ⚠️ region সবসময় `"bd"` — কারণ এই endpoint কেবল **BDT** দাম ফেরত দেয়
  //    (UddoktaPay BDT-only)। দর্শকের region দিয়ে ফরম্যাট করলে একজন Global
  //    region-এর merchant একটি টাকার অঙ্কের সামনে "$" দেখতেন।
  const region: Region = "bd";
  const lang = i18n.language;

  const isRejected = state.kind === "rejected";

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-2">
        <BadgePercent className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">
          {t("coupon.title", "Have a coupon code?")}
        </h3>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {t("coupon.desc", "Enter it here and we'll apply the discount at checkout.")}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <Input
          value={value}
          // ⚠️ বড় হাতের অক্ষরে normalize — কুপন কোড সবসময় UPPER_CASE, আর
          //    ছোট হাতের অক্ষরে টাইপ করা কোড চুপচাপ ব্যর্থ হওয়া উচিত নয়।
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder={t("coupon.placeholder", "e.g. EID25")}
          spellCheck={false}
          autoComplete="off"
          data-testid="coupon-input"
          className="max-w-xs font-mono tracking-wider uppercase"
          aria-invalid={isRejected}
          aria-describedby="coupon-status"
        />

        {/* সাফ করার বাটন — কেবল কিছু লেখা থাকলে। নইলে ঘরটি নিজে থেকে ফাঁকা
            মনে হলেও আসলে একটি লুকানো মান ধরে থাকত, আর পরের checkout-এ
            সেটিই যেত। */}
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={t("coupon.clear", "Clear")}
            data-testid="coupon-clear"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {state.kind === "checking" && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* ── ফলাফল ── */}
      <div id="coupon-status" aria-live="polite">
        <AnimatePresence mode="wait">
          {state.kind === "applied" && (
            <motion.p
              key="applied"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              data-testid="coupon-applied"
              className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary"
            >
              <Check className="w-3.5 h-3.5" />
              {t("coupon.applied", {
                percent: state.discountPercent,
                amount: formatPrice(state.discountAmount, region, lang),
                total: formatPrice(state.finalAmount, region, lang),
                defaultValue: "{{percent}}% off — you pay {{total}}",
              })}
            </motion.p>
          )}

          {state.kind === "rejected" && (
            <motion.p
              key="rejected"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              data-testid="coupon-rejected"
              className="mt-2 text-xs font-medium text-destructive"
            >
              {t(REASON_KEY[state.reason], "This coupon can't be used.")}
            </motion.p>
          )}

          {(state.kind === "unknown" || state.kind === "failed") && (
            <motion.p
              key={state.kind}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-2 text-xs text-muted-foreground"
            >
              {state.kind === "unknown"
                ? t(
                    "coupon.checkedAtCheckout",
                    "We'll verify this code when you check out."
                  )
                : t("coupon.checkFailed", "Couldn't check this code right now.")}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
