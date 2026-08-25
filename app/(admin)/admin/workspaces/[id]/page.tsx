"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Building2, RefreshCw, ShieldCheck, AlertTriangle, AlertOctagon, Coins, CreditCard, BarChart3, Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { WorkspaceOverviewTab, type WorkspaceDetailData } from "@/components/admin/workspaces/WorkspaceOverviewTab";
import { BillingAndPlanTab } from "@/components/admin/workspaces/BillingAndPlanTab";
import { CreditLedgerTab } from "@/components/admin/workspaces/CreditLedgerTab";
import { CostAnalyticsTab } from "@/components/admin/workspaces/CostAnalyticsTab";

export default function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useTranslation("admin");

  const [data, setData] = useState<WorkspaceDetailData & {
    financials: any;
    modelBreakdown: any[];
    channelBreakdown: any[];
    creditTransactions: any[];
    usageLogs: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaceDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/workspaces/${id}`);
      if (!res.ok) throw new Error("Workspace not found");

      const resData = await res.json();
      setData(resData);
    } catch (err: any) {
      toast.error(err.message || "Failed to load workspace details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchWorkspaceDetail();
  }, [fetchWorkspaceDetail]);

  if (loading && !data) {
    return (
      <div className="flex h-96 flex-col items-center justify-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">{t("workspaces.detail.loading", "Loading workspace telemetry...")}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-96 flex-col items-center justify-center space-y-4 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground/40" />
        <h2 className="text-xl font-bold">{t("workspaces.detail.notFoundTitle", "Workspace Not Found")}</h2>
        <p className="text-sm text-muted-foreground">{t("workspaces.detail.notFoundDesc", "The requested workspace ID could not be retrieved.")}</p>
        <Button asChild variant="outline" className="rounded-xl">
          <Link href="/admin/workspaces">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to Workspaces
          </Link>
        </Button>
      </div>
    );
  }

  const status = data.workspace.status || "active";

  return (
    <div className="space-y-6">
      {/* Back Link & Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <Link
          href="/admin/workspaces"
          className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          {t("workspaces.detail.back", "Back to Workspaces List")}
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 ring-2 ring-primary/20">
              <AvatarImage src={data.workspace.logoUrl || data.owner.picture || undefined} />
              <AvatarFallback className="bg-brand-gradient text-white text-base font-bold">
                {data.workspace.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {data.workspace.name}
                </h1>
                <Badge
                  className={cn(
                    "capitalize text-xs font-semibold gap-1",
                    status === "active" && "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
                    status === "warning" && "bg-amber-500/15 text-amber-500 border-amber-500/30",
                    status === "suspended" && "bg-rose-500/15 text-rose-500 border-rose-500/30"
                  )}
                >
                  {status === "active" && <ShieldCheck className="h-3 w-3" />}
                  {status === "warning" && <AlertTriangle className="h-3 w-3" />}
                  {status === "suspended" && <AlertOctagon className="h-3 w-3" />}
                  {status}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Owner: <span className="font-semibold text-foreground">{data.owner.name}</span> ({data.owner.email}) • Plan: <span className="uppercase font-semibold text-primary">{data.owner.plan}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchWorkspaceDetail} className="rounded-xl">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Tabs Navigation */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="w-full justify-start rounded-2xl border border-primary/10 bg-card/60 p-1.5 backdrop-blur-xl">
          <TabsTrigger value="overview" className="rounded-xl px-4 text-xs font-semibold gap-2">
            <Building2 className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="billing" className="rounded-xl px-4 text-xs font-semibold gap-2">
            <CreditCard className="h-3.5 w-3.5" />
            Billing & Plan
          </TabsTrigger>
          <TabsTrigger value="ledger" className="rounded-xl px-4 text-xs font-semibold gap-2">
            <Coins className="h-3.5 w-3.5" />
            Credit Ledger
          </TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-xl px-4 text-xs font-semibold gap-2">
            <BarChart3 className="h-3.5 w-3.5" />
            Cost Analytics & Unit Economics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <WorkspaceOverviewTab data={data} onRefresh={fetchWorkspaceDetail} />
        </TabsContent>

        <TabsContent value="billing">
          <BillingAndPlanTab data={data} onRefresh={fetchWorkspaceDetail} />
        </TabsContent>

        <TabsContent value="ledger">
          <CreditLedgerTab data={data} creditTransactions={data.creditTransactions || []} onRefresh={fetchWorkspaceDetail} />
        </TabsContent>

        <TabsContent value="analytics">
          <CostAnalyticsTab
            data={data}
            financials={data.financials}
            modelBreakdown={data.modelBreakdown || []}
            channelBreakdown={data.channelBreakdown || []}
            usageLogs={data.usageLogs || []}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
