"use client";

import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Archive, ArchiveRestore, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { WaTemplateStatus } from "@/lib/automations/schema";

import { WA_STATUS_STYLES, readButtons, type MessageTemplate } from "./types";

/**
 * One template in the list.
 *
 * The WhatsApp approval badge is the most important thing on this card when the
 * template is headed for WhatsApp, and noise when it is not — a Messenger-only
 * template has no approval to wait for. So the badge only appears for `whatsapp`
 * and `all`.
 */
export function TemplateCard({
  template,
  busy,
  onEdit,
  onArchive,
  onDelete,
}: {
  template: MessageTemplate;
  busy: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("automations");

  const buttons = readButtons(template.buttons);
  const waStatus = normalizeWaStatus(template.waStatus);
  const showsApproval = template.channel === "whatsapp" || template.channel === "all";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col rounded-xl border border-border/60 bg-card p-4",
        template.archived && "opacity-60"
      )}
      data-testid={`template-${template.templateId}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-foreground">{template.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Chip>{t(`templates.channel.${template.channel}`, template.channel)}</Chip>
            <Chip>{t(`templates.category.${template.category}`, template.category)}</Chip>
            <Chip>{template.language === "bn" ? "বাংলা" : "English"}</Chip>
            {template.archived && (
              <Chip className="border-border text-muted-foreground">
                {t("templates.archived", "Archived")}
              </Chip>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                aria-label={t("templates.actions", "Template actions")}
                className="shrink-0 text-muted-foreground"
              />
            }
          >
            <MoreVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil />
              {t("menu.edit", "Edit")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive}>
              {template.archived ? <ArchiveRestore /> : <Archive />}
              {template.archived
                ? t("templates.unarchive", "Restore")
                : t("templates.archive", "Archive")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 />
              {t("menu.delete", "Delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* The body is what the customer actually reads, so it gets the space. */}
      <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
        {template.body}
      </p>

      {buttons.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {buttons.map((button, index) => (
            <span
              key={`${button.label}-${index}`}
              className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-foreground"
            >
              {button.label}
            </span>
          ))}
        </div>
      )}

      <footer className="mt-auto flex items-center justify-between gap-2 pt-3">
        {showsApproval ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              WA_STATUS_STYLES[waStatus].className
            )}
            data-testid={`wa-status-${template.templateId}`}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", WA_STATUS_STYLES[waStatus].dot)} />
            {t(`templates.waStatus.${waStatus}`, waStatus)}
          </span>
        ) : (
          <span />
        )}

        <Button variant="ghost" size="sm" onClick={onEdit} className="text-muted-foreground">
          <Pencil />
          {t("menu.edit", "Edit")}
        </Button>
      </footer>

      {/* A rejection reason is only useful next to the template it belongs to. */}
      {waStatus === "rejected" && template.waRejectedReason && (
        <p className="mt-2 rounded-lg border border-destructive/25 bg-destructive/5 p-2 text-[11px] text-destructive">
          {template.waRejectedReason}
        </p>
      )}
    </motion.article>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}

/** The column is a plain string; anything unrecognised reads as "not submitted". */
function normalizeWaStatus(value: string): WaTemplateStatus {
  return value === "pending" || value === "approved" || value === "rejected"
    ? value
    : "not_submitted";
}
