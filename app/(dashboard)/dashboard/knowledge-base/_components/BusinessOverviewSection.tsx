"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, BookOpen, Check, Circle, FileText, Loader2, Package, Plug, Settings2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import type { Workspace } from "@/lib/core/workspace";

type BusinessOverview = {
  profile: Record<string, unknown>;
  counts: {
    products: number;
    activeOffers: number;
    totalOffers: number;
    orders: number;
    records: number;
    forms: number;
    sharedKnowledge: number;
    businessRules: number;
    agents: number;
    connectedChannels: number;
  };
  courier: { configured: boolean; providers: string[] };
};

type BusinessOverviewSectionProps = { workspace: Workspace | null };

export function BusinessOverviewSection({ workspace }: BusinessOverviewSectionProps) {
  const { t } = useTranslation("knowledge-base");
  const [overview, setOverview] = useState<BusinessOverview | null>(null);
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(null);
  const loading = Boolean(workspace?.workspaceId) && loadedWorkspaceId !== workspace?.workspaceId;

  useEffect(() => {
    let cancelled = false;
    if (!workspace?.workspaceId) {
      return;
    }

    fetch(`/api/workspaces/${encodeURIComponent(workspace.workspaceId)}/business-data`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || t("overview.loadError", "Could not load business overview"));
        if (!cancelled) setOverview(result as BusinessOverview);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setOverview(null);
        toast.error(error instanceof Error ? error.message : t("overview.loadError", "Could not load business overview"));
      })
      .finally(() => { if (!cancelled) setLoadedWorkspaceId(workspace.workspaceId); });

    return () => { cancelled = true; };
  }, [workspace?.workspaceId, t]);

  const isEcommerce = /e-?commerce/i.test(workspace?.category ?? "");
  const profile = overview?.profile ?? {};
  const hasProfile = Object.values(profile).some((value) => typeof value === "string" && value.trim().length > 0);
  const deliveryPolicy = profile.deliveryPolicy && typeof profile.deliveryPolicy === "object" && !Array.isArray(profile.deliveryPolicy)
    ? profile.deliveryPolicy as { zones?: unknown[] }
    : {};
  const hasDeliveryPolicy = Array.isArray(deliveryPolicy.zones) && deliveryPolicy.zones.length > 0;
  const counts = overview?.counts;
  const steps = [
    { key: "profile", icon: FileText, complete: hasProfile, href: "/dashboard/knowledge-base?tab=business-data#business-profile" },
    { key: "catalog", icon: Package, complete: isEcommerce ? (counts?.products ?? 0) > 0 : (counts?.forms ?? 0) > 0, href: isEcommerce ? "/dashboard/products" : "/dashboard/records" },
    { key: "operations", icon: Settings2, complete: (counts?.businessRules ?? 0) > 0 || Boolean(overview?.courier.configured) || hasDeliveryPolicy, href: isEcommerce ? "/dashboard/knowledge-base?tab=business-data#business-profile" : "/dashboard/knowledge-base?tab=company-ai-rules" },
    { key: "knowledge", icon: BookOpen, complete: (counts?.sharedKnowledge ?? 0) > 0, href: "/dashboard/knowledge-base?tab=faqs" },
    { key: "agents", icon: UsersRound, complete: (counts?.agents ?? 0) > 0, href: "/dashboard/aiagents" },
    { key: "channels", icon: Plug, complete: (counts?.connectedChannels ?? 0) > 0, href: "/dashboard/platforms" },
  ];
  const completed = steps.filter((step) => step.complete).length;
  const metrics = isEcommerce
    ? [
        { key: "products", value: counts?.products ?? 0 },
        { key: "offers", value: counts?.activeOffers ?? 0 },
        { key: "orders", value: counts?.orders ?? 0 },
        { key: "records", value: counts?.records ?? 0 },
      ]
    : [
        { key: "forms", value: counts?.forms ?? 0 },
        { key: "records", value: counts?.records ?? 0 },
        { key: "sharedKnowledge", value: counts?.sharedKnowledge ?? 0 },
        { key: "agents", value: counts?.agents ?? 0 },
      ];

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">{t("overview.title", "Business overview")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("overview.description", "See what is ready for your AI Agents and continue setup where you left off.")}</p>
          </div>
          <span className="rounded-full border border-primary/20 bg-background px-3 py-1.5 text-xs font-semibold text-primary">
            {t("overview.progress", { completed, total: steps.length, defaultValue: "{{completed}} of {{total}} areas ready" })}
          </span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`${completed} of ${steps.length} business setup areas ready`}>
          <div className="h-full rounded-full bg-brand-gradient transition-[width] duration-300" style={{ width: `${(completed / steps.length) * 100}%` }} />
        </div>
      </section>

      {!workspace?.workspaceId ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{t("overview.noBusiness", "Select a business to view its setup.")}</p>
      ) : loading ? (
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {steps.map(({ key, icon: Icon, complete, href }) => (
              <Link key={key} href={href} className="group flex min-h-28 items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${complete ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{t(`overview.steps.${key}.title`)}</span>
                    {complete ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {key === "catalog" && isEcommerce ? t("overview.steps.catalog.ecommerce", { count: counts?.products ?? 0 }) : t(`overview.steps.${key}.description`)}
                  </span>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">{t("overview.open", "Open") }<ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
                </span>
              </Link>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t("overview.dataSummary", "Business data summary")}>
            {metrics.map(({ key, value }) => (
              <div key={key} className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{t(`overview.metrics.${key}`)}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">{t("overview.setupGuideHint", "For the step-by-step checklist, use Setup Guide in the sidebar. Progress updates from saved business data.")}</p>
        </>
      )}
    </div>
  );
}
