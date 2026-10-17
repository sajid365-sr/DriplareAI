"use client";

import type { LucideIcon } from "lucide-react";

/**
 * Page header for the Automations sub-pages (Broadcasts, Templates, Activity).
 *
 * The rules list has its own header because it carries the primary call to
 * action; these three only need a title, a one-line explanation, and sometimes
 * one button. Sharing the shell keeps them from drifting into three different
 * icon sizes and heading levels.
 */
export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {action}
    </header>
  );
}
