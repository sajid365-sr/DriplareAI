"use client";

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowRight, Copy, MoreVertical, Pencil, Play, Trash2, Workflow } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { relativeTime } from "./format";
import { iconFor } from "./icons";
import { actionIcon, actionLabel, triggerDetail, triggerIcon, triggerLabel } from "./summarize";
import { STATUS_CLASSES, statusMeta, type Automation } from "./types";

interface AutomationCardProps {
  automation: Automation;
  /** `null` for a workspace-wide rule, which applies to every agent. */
  agentName: string | null;
  busy: boolean;
  onEdit: (automation: Automation) => void;
  onTest: (automation: Automation) => void;
  onDuplicate: (automation: Automation) => void;
  onToggle: (automation: Automation) => void;
  onDelete: (automation: Automation) => void;
}

/** How many actions the card spells out before collapsing into "+N more". */
const VISIBLE_ACTIONS = 2;

export function AutomationCard({
  automation,
  agentName,
  busy,
  onEdit,
  onTest,
  onDuplicate,
  onToggle,
  onDelete,
}: AutomationCardProps) {
  const { t, i18n } = useTranslation("automations");
  const isBn = i18n.language === "bn";

  const meta = statusMeta(automation.status);
  const TriggerIcon = iconFor(triggerIcon(automation.trigger));
  const detail = triggerDetail(automation.trigger, isBn);
  const isActive = automation.status === "active";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      data-testid={`automation-card-${automation.automationId}`}
      className={cn(
        "group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-xs transition-colors",
        "hover:border-primary/30",
        busy && "pointer-events-none opacity-60"
      )}
    >
      {/* ── Title row ─────────────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-sm font-bold text-foreground">{automation.name}</h3>
            {automation.kind === "flow" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                <Workflow className="h-2.5 w-2.5" />
                {t("card.advanced", "Advanced")}
              </span>
            )}
          </div>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="font-medium">
              {agentName ?? t("card.workspaceWide", "All agents")}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">#{automation.priority}</span>
            <span aria-hidden="true">·</span>
            {automation.runs.runsTotal > 0 ? (
              <span>
                {t("card.runsTotal", "{{count}} runs", { count: automation.runs.runsTotal })}
                {automation.lastRunAt ? ` · ${t("card.lastRun", "Last run {{when}}", {
                  when: relativeTime(automation.lastRunAt, isBn),
                })}` : ""}
              </span>
            ) : (
              <span>{t("card.neverRun", "Never run")}</span>
            )}
          </p>
        </div>

        {/* Status pill + kebab */}
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              STATUS_CLASSES[meta.tone]
            )}
          >
            {t(meta.labelKey, automation.status)}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("menu.edit", "Actions")}
                  data-testid={`automation-menu-${automation.automationId}`}
                />
              }
            >
              <MoreVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onEdit(automation)}>
                <Pencil />
                {t("menu.edit", "Edit")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onTest(automation)}>
                <Play />
                {t("menu.test", "Test this rule")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(automation)}>
                <Copy />
                {t("menu.duplicate", "Duplicate")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(automation)}>
                <Trash2 />
                {t("menu.delete", "Delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Trigger → Actions ─────────────────────────────────────────────── */}
      <div className="space-y-2 rounded-xl border border-border/50 bg-muted/25 p-2.5">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <TriggerIcon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold leading-tight text-foreground">
              {triggerLabel(t, automation.trigger)}
            </p>
            {detail && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</p>
            )}
            {automation.conditions.length > 0 && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {automation.matchMode === "any"
                  ? t("builder.matchAny", "Any condition")
                  : t("builder.matchAll", "All conditions")}
                {" · "}
                {automation.conditions.length}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 pl-1 text-[11px] font-medium text-muted-foreground">
          <ArrowRight className="h-3 w-3" />
          {t("card.then", "then")}
        </div>

        {automation.actions.length === 0 ? (
          <p className="pl-8 text-[11px] italic text-muted-foreground">
            {t("card.noActions", "No actions yet")}
          </p>
        ) : (
          <ul className="space-y-1 pl-8">
            {automation.actions.slice(0, VISIBLE_ACTIONS).map((action, index) => {
              const ActionIcon = iconFor(actionIcon(action));
              return (
                <li key={index} className="flex items-center gap-1.5">
                  <ActionIcon className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate text-xs text-foreground">
                    {actionLabel(t, action)}
                  </span>
                </li>
              );
            })}
            {automation.actions.length > VISIBLE_ACTIONS && (
              <li className="pl-[18px] text-[11px] text-muted-foreground">
                {t("card.andMore", "+{{count}} more", {
                  count: automation.actions.length - VISIBLE_ACTIONS,
                })}
              </li>
            )}
          </ul>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="mt-auto flex items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
          <Switch
            checked={isActive}
            onCheckedChange={() => onToggle(automation)}
            disabled={busy}
            aria-label={isActive ? t("menu.disable", "Disable") : t("menu.enable", "Enable")}
            data-testid={`automation-toggle-${automation.automationId}`}
          />
          {isActive ? t("status.active", "Active") : t("status.paused", "Paused")}
        </label>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(automation)}
          className="text-primary hover:bg-primary/5"
          data-testid={`automation-edit-${automation.automationId}`}
        >
          <Pencil />
          {t("menu.edit", "Edit")}
        </Button>
      </footer>
    </motion.article>
  );
}
