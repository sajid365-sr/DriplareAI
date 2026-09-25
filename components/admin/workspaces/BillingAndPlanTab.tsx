"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreateInvoiceDialog, type InvoiceUser } from "@/components/admin/billing/CreateInvoiceDialog";
import { getPlansForRegion, resolveLocalStr } from "@/lib/domain/plan-config";
import type { Region } from "@/lib/core/region";
import { type WorkspaceDetailData } from "./WorkspaceOverviewTab";

interface BillingAndPlanTabProps {
  data: WorkspaceDetailData;
  onRefresh: () => void;
}

/**
 * Workspace → Billing & Plan tab
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin একটি নির্দিষ্ট merchant-এর plan ও billing সামলানোর জায়গা।
 *
 * ⚠️ আগে এখানে একটি **stale hardcoded PLANS array** ছিল — "pro" ও "agency"
 * plan দেখাত যা `lib/domain/plan-config.ts`-এ নেই। Admin সেগুলো set করলে
 * `getPlan()` চুপচাপ starter-এ fallback করত। এখন plan তালিকা ও credit সংখ্যা
 * সরাসরি `plan-config.ts` থেকে আসে (region অনুযায়ী) — একটাই source of truth।
 *
 * Invoice তৈরিও এখন `/admin/billing`-এর সাথে **একই component** ব্যবহার করে,
 * যাতে দুই জায়গার behaviour কখনো আলাদা হয়ে না যায়।
 */
export function BillingAndPlanTab({ data, onRefresh }: BillingAndPlanTabProps) {
  const { t, i18n } = useTranslation("admin");
  const router = useRouter();
  const lang = i18n.language?.startsWith("bn") ? "bn" : "en";

  const [selectedPlan, setSelectedPlan] = useState(data.owner.plan.toLowerCase());
  const [planLoading, setPlanLoading] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  // ── Payment issues count (এই merchant-এর) ────────────────────────────────────
  const [issueCount, setIssueCount] = useState<number | null>(null);
  const [issuesLoading, setIssuesLoading] = useState(false);

  // Region কখনো `string` হিসেবে আসে (DB column), তাই normalize করা হয়
  const region: Region = data.owner.region === "global" ? "global" : "bd";
  const plans = useMemo(() => getPlansForRegion(region), [region]);

  /** `CreateInvoiceDialog`-এর প্রত্যাশিত shape-এ owner-কে রূপান্তর। */
  const invoiceUser: InvoiceUser = {
    userId: data.owner.userId,
    name: data.owner.name,
    email: data.owner.email,
    picture: data.owner.picture ?? null,
    creditsBalance: data.owner.creditsBalance,
    plan: data.owner.plan,
    region,
  };

  const fetchIssueCount = useCallback(async () => {
    setIssuesLoading(true);
    try {
      const res = await fetch(
        `/api/admin/billing?type=issues&userId=${encodeURIComponent(data.owner.userId)}`
      );
      if (!res.ok) throw new Error();
      const body = await res.json();
      setIssueCount(body.total ?? 0);
    } catch {
      // Card-টি optional — count না পেলে পুরো tab ভাঙা উচিত নয়
      setIssueCount(null);
    } finally {
      setIssuesLoading(false);
    }
  }, [data.owner.userId]);

  useEffect(() => {
    fetchIssueCount();
  }, [fetchIssueCount]);

  // ── Plan change ──────────────────────────────────────────────────────────────
  const handlePlanChange = async () => {
    if (selectedPlan === data.owner.plan.toLowerCase()) {
      toast.info(t("workspaces.billing.samePlan", "This plan is already active."));
      return;
    }

    setPlanLoading(true);
    try {
      const res = await fetch(`/api/admin/workspaces/${data.workspace.workspaceId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_plan", plan: selectedPlan }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || t("workspaces.billing.planError", "Failed to update plan"));

      toast.success(
        resData.message || t("workspaces.billing.planSuccess", { plan: selectedPlan })
      );
      onRefresh();
      fetchIssueCount();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("workspaces.billing.planError", "Failed to update plan")
      );
    } finally {
      setPlanLoading(false);
    }
  };

  /** এই merchant-এর issues-এর queue — এক click-এ deep-link। */
  const openIssuesQueue = () => {
    router.push(`/admin/billing?tab=issues&userId=${encodeURIComponent(data.owner.userId)}`);
  };

  const hasIssues = (issueCount ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* ── Subscription Plan Management ── */}
        <Card className="border-primary/10 bg-card/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("workspaces.billing.planTitle", "Subscription Plan Management")}
            </CardTitle>
            <CardDescription>
              {t("workspaces.billing.planDesc", "Modify subscriber tier and credit allocations")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/10 p-4">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("workspaces.billing.currentPlan", "Current Active Plan")}
                </p>
                <h4 className="mt-0.5 truncate text-lg font-bold capitalize text-primary">
                  {data.owner.plan}
                </h4>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t("workspaces.billing.balance", {
                    balance: data.owner.creditsBalance.toLocaleString(),
                    included: data.owner.includedCredits.toLocaleString(),
                    defaultValue: "{{balance}} / {{included}} credits",
                  })}
                </p>
              </div>
              <Badge className="shrink-0 bg-primary capitalize text-primary-foreground">
                {data.owner.plan}
              </Badge>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("workspaces.billing.selectPlan", "Select New Plan Tier")}
              </label>
              <Select value={selectedPlan} onValueChange={(value) => value !== null && setSelectedPlan(value)}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder={t("workspaces.billing.selectPlanPlaceholder", "Select plan tier")} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {plans.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      <span className="font-semibold">{resolveLocalStr(p.name, lang)}</span> —{" "}
                      {resolveLocalStr(p.priceLabel, lang)}
                      {p.includedCredits > 0
                        ? ` · ${p.includedCredits.toLocaleString()} credits`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handlePlanChange}
              disabled={planLoading || selectedPlan === data.owner.plan.toLowerCase()}
              className="w-full rounded-xl bg-brand-gradient font-medium text-primary-foreground"
            >
              {planLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("workspaces.billing.applying", "Updating plan…")}
                </>
              ) : (
                t("workspaces.billing.applyPlan", "Apply Plan Change")
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ── Invoicing (shared dialog with /admin/billing) ── */}
        <Card className="border-primary/10 bg-card/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <FileText className="h-4 w-4 text-primary" />
              {t("workspaces.billing.invoiceTitle", "Custom Manual Invoicing")}
            </CardTitle>
            <CardDescription>
              {t("workspaces.billing.invoiceDesc", "Issue a payable invoice the merchant pays themselves")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                {t("workspaces.billing.invoiceBullet1", "Choose credit top-up or a plan upgrade.")}
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                {t("workspaces.billing.invoiceBullet2", "The merchant gets an email with a secure payment link.")}
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                {t("workspaces.billing.invoiceBullet3", "Credits activate automatically once the gateway confirms.")}
              </li>
            </ul>

            <Button
              variant="outline"
              className="w-full rounded-xl border-primary/25 gap-2 text-primary hover:bg-primary/10"
              onClick={() => setInvoiceOpen(true)}
            >
              <FileText className="h-4 w-4" />
              {t("billing.invoice.trigger")}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Payment Issues (এই merchant-এর) ── */}
      <Card
        className={
          hasIssues
            ? "border-destructive/25 bg-destructive/5 backdrop-blur-xl"
            : "border-primary/10 bg-card/60 backdrop-blur-xl"
        }
      >
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <span
              className={
                hasIssues
                  ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive"
                  : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
              }
            >
              {hasIssues ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <ShieldAlert className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {t("workspaces.billing.issuesTitle", "Payment Issues")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {issuesLoading
                  ? t("workspaces.billing.issuesLoading", "Checking…")
                  : hasIssues
                    ? t("workspaces.billing.issuesFound", {
                        count: issueCount,
                        defaultValue: "{{count}} open issue(s) need attention",
                      })
                    : t("workspaces.billing.issuesNone", "No open payment issues for this merchant.")}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={fetchIssueCount}
              disabled={issuesLoading}
            >
              <RefreshCw className={issuesLoading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            </Button>
            <Button
              variant={hasIssues ? "default" : "outline"}
              size="sm"
              className="rounded-xl gap-1.5"
              onClick={openIssuesQueue}
            >
              {t("workspaces.billing.openQueue", "Open Queue")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <CreateInvoiceDialog
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
        onSuccess={() => {
          onRefresh();
          fetchIssueCount();
        }}
        presetUser={invoiceUser}
      />
    </div>
  );
}
