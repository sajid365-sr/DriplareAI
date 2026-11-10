"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
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

export function FloatingWorkspaceSetupProgress() {
  const pathname = usePathname();
  const { t } = useTranslation("workspace-setup");
  const { activeWorkspace } = useWorkspace();
  const [progress, setProgress] = useState<{ workspaceId: string; data: SetupGuideData } | null>(null);
  const workspaceId = activeWorkspace?.workspaceId;
  const [collapsedWorkspaceId, setCollapsedWorkspaceId] = useState<string | null>(null);
  const isCollapsed = Boolean(workspaceId) && collapsedWorkspaceId === workspaceId;

  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;
    fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/setup-guide`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Setup progress request failed (${response.status})`);
        return await response.json() as SetupGuideData;
      })
      .then((data) => {
        if (!cancelled) setProgress({ workspaceId, data });
      })
      .catch((error: unknown) => {
        console.error("[FLOATING_WORKSPACE_SETUP_PROGRESS]", error);
        if (!cancelled) setProgress(null);
      });

    return () => { cancelled = true; };
  }, [workspaceId, pathname]);

  const toggleCollapsed = () => {
    if (!workspaceId) return;
    setCollapsedWorkspaceId(isCollapsed ? null : workspaceId);
  };

  if (
    pathname === "/dashboard/setup" ||
    pathname?.startsWith("/dashboard/setup/") ||
    !progress ||
    progress.workspaceId !== activeWorkspace?.workspaceId ||
    progress.data.completed >= progress.data.total ||
    !progress.data.nextStep
  ) {
    return null;
  }

  const { data } = progress;
  const nextStep = data.nextStep;
  if (!nextStep) return null;
  const nextHref = getWorkspaceSetupStepHref(
    nextStep,
    activeWorkspace?.category ?? "general",
    data.firstAgentId
  );
  const nextTitle = t(`steps.${nextStep}.title`);

  return (
    <div className={`sticky top-0 z-20 -mx-4 -mt-4 mb-5 -translate-y-4 border-b border-border bg-background px-4 shadow-sm md:-mx-8 md:-mt-8 md:-translate-y-8 md:px-8 ${isCollapsed ? "py-1" : "py-2"}`}>
      {isCollapsed ? (
        <div className="mx-auto flex max-w-[1550px] justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 gap-2 px-3"
            aria-expanded={false}
            aria-controls="workspace-setup-progress-content"
            aria-label={t("expandProgress")}
            onClick={toggleCollapsed}
          >
            <span className="text-xs font-semibold">{t("floatingProgress", data)}</span>
            <ChevronDown className="size-4" />
          </Button>
        </div>
      ) : (
        <div id="workspace-setup-progress-content" className="mx-auto flex max-w-[1550px] flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              {data.completed > 0 ? <Check className="size-4" /> : <span className="text-xs font-bold">1</span>}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-semibold text-foreground">{t("floatingProgress", data)}</span>
                <span className="hidden truncate text-muted-foreground sm:inline">{t("floatingNext", { step: nextTitle })}</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand-gradient transition-[width] duration-300"
                  style={{ width: `${data.total ? (data.completed / data.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild size="sm" variant="outline" className="h-9 px-4">
              <Link href="/dashboard/setup">{t("backToSetup")}</Link>
            </Button>
            <Link
              href={nextHref}
              aria-label={`${t("openStep")}: ${nextTitle}`}
              className={buttonVariants({ size: "sm", className: "h-9 gap-2 whitespace-nowrap px-4" })}
            >
              <span>{t(`steps.${nextStep}.action`)}</span>
              <ArrowRight className="size-4 shrink-0" />
            </Link>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-9 shrink-0"
              aria-expanded={true}
              aria-controls="workspace-setup-progress-content"
              aria-label={t("collapseProgress")}
              title={t("collapseProgress")}
              onClick={toggleCollapsed}
            >
              <ChevronUp className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
