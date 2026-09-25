"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useRegion } from "@/components/region-provider";
import {
  getPlansForRegion,
  type PlanConfig,
} from "@/lib/domain/plan-config";
import DowngradeWarningModal, {
  type DowngradePreviewData,
} from "@/components/modals/downgrade-warning-modal";

import { ScheduledDowngradeBanner } from "./_components/ScheduledDowngradeBanner";
import { CurrentPlanBadge } from "./_components/CurrentPlanBadge";
import { PricingCards } from "./_components/PricingCards";
import { TopUpCards } from "./_components/TopUpCards";
import { PLAN_HIERARCHY, PLAN_ICONS } from "./_components/constants";

interface UsageData {
  plan?: string;
  scheduledDowngradePlan?: string | null;
  scheduledDowngradeAt?: string | null;
}

export default function Payment() {
  const { t } = useTranslation("payment");
  const { region, config: regionConfig } = useRegion();

  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isCancellingDowngrade, setIsCancellingDowngrade] = useState(false);
  const [isApplyingDowngrade, setIsApplyingDowngrade] = useState(false);

  // Downgrade modal state
  const [isDowngradeModalOpen, setIsDowngradeModalOpen] = useState(false);
  const [downgradePreview, setDowngradePreview] = useState<DowngradePreviewData | null>(null);
  const [loadingDowngradePlan, setLoadingDowngradePlan] = useState<string | null>(null);

  const currentPlan = usage?.plan || "starter";
  const plans = getPlansForRegion(region);

  // Global region-এ payment gateway নেই — pricing দেখা যায়, কেনা যায় না।
  const paymentAvailable = regionConfig.paymentGateway !== null;

  // ── Load usage data ──
  const loadUsage = useCallback(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((data) => setUsage(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  // ── Upgrade flow ──
  const checkout = async (plan: PlanConfig) => {
    if (plan.contact) {
      toast.info(t("contactSales"));
      return;
    }
    if (!paymentAvailable) {
      toast.info(t("paymentUnavailable"));
      return;
    }
    if (plan.key === "starter") {
      toast.info(t("currentPlanBadge"));
      return;
    }
    setLoadingPlan(plan.key);
    try {
      const origin_url = window.location.origin;
      const r = await fetch("/api/payments/uddoktapay/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package_id: `${plan.key}_bdt`, origin_url }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Checkout failed");
      if (data.url) window.location.assign(data.url);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Checkout failed";
      toast.error(message);
    } finally {
      setLoadingPlan(null);
    }
  };

  // ── Top-up checkout flow ──
  const buyTopUp = async (packageId: string) => {
    if (!paymentAvailable) {
      toast.info(t("paymentUnavailable"));
      return;
    }
    setLoadingPlan(packageId);
    try {
      const origin_url = window.location.origin;
      const r = await fetch("/api/payments/uddoktapay/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package_id: packageId, origin_url }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Checkout failed");
      if (data.url) window.location.assign(data.url);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Checkout failed";
      toast.error(message);
    } finally {
      setLoadingPlan(null);
    }
  };

  // ── Open downgrade modal with preview ──
  const handleDowngradeClick = async (targetPlan: string) => {
    setLoadingDowngradePlan(targetPlan);
    try {
      const res = await fetch(`/api/payments/manage?plan=${targetPlan}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get preview");

      setDowngradePreview(data.preview);
      setIsDowngradeModalOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load preview";
      toast.error(msg);
    } finally {
      setLoadingDowngradePlan(null);
    }
  };

  // ── Cancel scheduled downgrade ──
  const handleCancelDowngrade = async () => {
    setIsCancellingDowngrade(true);
    try {
      const res = await fetch("/api/payments/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_downgrade" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t("scheduledDowngrade.cancelSuccess"));
      loadUsage();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("scheduledDowngrade.cancelError");
      toast.error(msg);
    } finally {
      setIsCancellingDowngrade(false);
    }
  };

  // ── Apply downgrade immediately ──
  const handleApplyImmediately = async () => {
    const confirmMsg = t(
      "scheduledDowngrade.applyConfirm",
      "Are you sure you want to apply this downgrade immediately? Excess chatbots and integrations will be paused right away."
    );
    if (!window.confirm(confirmMsg)) return;

    setIsApplyingDowngrade(true);
    try {
      const res = await fetch("/api/payments/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply_now" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t("scheduledDowngrade.applySuccess"));
      loadUsage();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("scheduledDowngrade.applyError");
      toast.error(msg);
    } finally {
      setIsApplyingDowngrade(false);
    }
  };

  // ── Determine if a plan can be downgraded to ──
  const canDowngradeTo = (planKey: string) => {
    const currentIdx = PLAN_HIERARCHY.indexOf(currentPlan);
    const targetIdx = PLAN_HIERARCHY.indexOf(planKey);
    return targetIdx < currentIdx && planKey !== "starter";
  };

  const canCancelToStarter = currentPlan !== "starter";

  return (
    <div className="space-y-6 max-w-6xl">
      <CurrentPlanBadge
        currentPlan={currentPlan}
        canCancelToStarter={canCancelToStarter}
        handleDowngradeClick={handleDowngradeClick}
        loadingDowngradePlan={loadingDowngradePlan}
        loadingPlan={loadingPlan}
        planIcon={PLAN_ICONS[currentPlan as keyof typeof PLAN_ICONS] || PLAN_ICONS.starter}
      />

      {usage?.scheduledDowngradePlan && usage?.scheduledDowngradeAt && (
        <ScheduledDowngradeBanner
          plan={usage.scheduledDowngradePlan}
          scheduledAt={usage.scheduledDowngradeAt}
          onCancelDowngrade={handleCancelDowngrade}
          onApplyImmediately={handleApplyImmediately}
          isCancelling={isCancellingDowngrade}
          isApplying={isApplyingDowngrade}
        />
      )}

      {/* Global region: gateway নেই — স্পষ্টভাবে জানিয়ে দেওয়া হয় */}
      {paymentAvailable ? (
        <div className="text-xs text-muted-foreground">{t("poweredByUddoktapay")}</div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {t("paymentUnavailable")}
        </div>
      )}

      <PricingCards
        plans={plans}
        currentPlan={currentPlan}
        usage={usage}
        loadingPlan={loadingPlan}
        loadingDowngradePlan={loadingDowngradePlan}
        canDowngradeTo={canDowngradeTo}
        checkout={checkout}
        handleDowngradeClick={handleDowngradeClick}
        paymentAvailable={paymentAvailable}
      />

      {/* Top-up সব pack BDT-তে — gateway না থাকলে দেখানোর কিছু নেই */}
      {paymentAvailable && (
        <TopUpCards
          currentPlan={currentPlan}
          loadingPackage={loadingPlan}
          onBuy={buyTopUp}
        />
      )}

      {paymentAvailable && (
        <div className="text-xs text-muted-foreground">{t("testModeNote")}</div>
      )}

      <DowngradeWarningModal
        isOpen={isDowngradeModalOpen}
        preview={downgradePreview}
        onClose={() => {
          setIsDowngradeModalOpen(false);
          setDowngradePreview(null);
        }}
        onSuccess={loadUsage}
      />
    </div>
  );
}
