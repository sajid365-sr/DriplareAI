"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AlertCircle, ArrowRight, Bot, Building2, Check, Circle, Plug, Rocket, RotateCw, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace-provider";
import { getWorkspaceSetupStepHref } from "@/lib/domain/workspace-setup-links";
import type { WorkspaceSetupStepKey } from "@/lib/domain/workspace-setup-progress";

type SetupGuideData = {
  steps: Array<{ key: WorkspaceSetupStepKey; complete: boolean }>;
  completed: number;
  total: number;
  firstAgentId: string | null;
  nextStep: WorkspaceSetupStepKey | null;
};

const STEP_ICONS = {
  business: Building2,
  agent: Bot,
  channel: Plug,
  test: FlaskConical,
  live: Rocket,
} satisfies Record<WorkspaceSetupStepKey, typeof Building2>;

export function WorkspaceSetupPage() {
  const { t } = useTranslation("workspace-setup");
  const { activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const [progress, setProgress] = useState<{ workspaceId: string; data: SetupGuideData } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const workspaceId = activeWorkspace?.workspaceId;
    if (!workspaceId) return;

    let cancelled = false;
    const loadProgress = async () => {
      try {
        const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/setup-guide`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Setup progress request failed (${response.status})`);
        const data = await response.json() as SetupGuideData;
        if (!cancelled) {
          setProgress({ workspaceId, data });
          setError(false);
        }
      } catch (loadError) {
        console.error("[WORKSPACE_SETUP_PAGE]", loadError);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadProgress();

    return () => { cancelled = true; };
  }, [activeWorkspace?.workspaceId, reloadKey]);

  const isCurrentWorkspaceLoaded = progress?.workspaceId === activeWorkspace?.workspaceId;
  const isLoading = workspaceLoading || (loading && Boolean(activeWorkspace)) || (Boolean(activeWorkspace) && !isCurrentWorkspaceLoaded && !error);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-5" aria-busy="true">
        <div className="h-28 animate-pulse rounded-2xl bg-muted" />
        {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-muted/70" />)}
      </div>
    );
  }

  if (error || !progress || !isCurrentWorkspaceLoaded) {
    return (
      <section className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 text-center">
        <AlertCircle className="mx-auto size-8 text-destructive" />
        <p className="mt-3 text-sm text-foreground">{t("loadError")}</p>
        <Button type="button" className="mt-4" onClick={() => { setError(false); setLoading(true); setReloadKey((key) => key + 1); }}>
          <RotateCw className="mr-2 size-4" />{t("retry")}
        </Button>
      </section>
    );
  }

  const { data } = progress;
  const nextHref = data.nextStep
    ? getWorkspaceSetupStepHref(data.nextStep, activeWorkspace?.category ?? "general", data.firstAgentId)
    : "/dashboard/overview";

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">{activeWorkspace?.name}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {data.completed === data.total ? t("allCompleteTitle") : t("title")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {data.completed === data.total ? t("allCompleteDescription") : t("description")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3">
            <span className="text-2xl font-bold tabular-nums text-primary">{data.completed}/{data.total}</span>
            <span className="max-w-28 text-xs leading-5 text-muted-foreground">{t("progress", data)}</span>
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand-gradient transition-[width] duration-300"
            style={{ width: `${data.total ? (data.completed / data.total) * 100 : 0}%` }}
          />
        </div>
        {data.nextStep && (
          <Button asChild className="mt-5">
            <Link href={nextHref}>{t("continue")}<ArrowRight className="ml-2 size-4" /></Link>
          </Button>
        )}
      </section>

      <ol className="space-y-3">
        {data.steps.map((step, index) => {
          const Icon = STEP_ICONS[step.key];
          const isNext = step.key === data.nextStep;
          const href = getWorkspaceSetupStepHref(step.key, activeWorkspace?.category ?? "general", data.firstAgentId);
          const statusLabel = step.complete ? t("completed") : isNext ? t("nextUp") : t("upcoming");

          return (
            <li key={step.key}>
              <Link
                href={href}
                className={`group flex items-start gap-4 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/35 sm:p-5 ${isNext ? "border-primary/35 shadow-sm" : "border-border/70"}`}
                data-testid={`setup-step-${step.key}`}
              >
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${step.complete ? "bg-primary/10 text-primary" : isNext ? "bg-brand-gradient text-white" : "bg-muted text-muted-foreground"}`}>
                  {step.complete ? <Check className="size-5" /> : <Icon className="size-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{index + 1}.</span>
                    <span className="font-semibold text-foreground">{t(`steps.${step.key}.title`)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${step.complete ? "bg-primary/10 text-primary" : isNext ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {statusLabel}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">{t(`steps.${step.key}.description`)}</span>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    {t(`steps.${step.key}.action`)}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </span>
                {!step.complete && <Circle className="mt-1 size-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />}
              </Link>
              {step.key === "business" && (
                <div className="ml-16 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <Link className="text-muted-foreground underline-offset-4 hover:text-primary hover:underline" href={activeWorkspace?.category.toLowerCase().includes("ecommerce") || activeWorkspace?.category.toLowerCase().includes("e-commerce") ? "/dashboard/products" : "/dashboard/records"}>
                    {t("steps.business.secondary")}
                  </Link>
                  <Link className="text-muted-foreground underline-offset-4 hover:text-primary hover:underline" href="/dashboard/knowledge-base?tab=company-ai-rules">
                    {t("steps.business.secondaryRules")}
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
