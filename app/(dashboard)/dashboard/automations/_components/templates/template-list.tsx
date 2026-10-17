"use client";

import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { TemplateCard } from "./template-card";
import type { MessageTemplate } from "./types";

/**
 * The template grid.
 *
 * Two empty states again, and here the distinction carries real weight: an
 * empty workspace needs to be told what a template *is*, while an empty filter
 * means the search is wrong. The first copy explains the WhatsApp rule; the
 * second just offers a way back.
 */
export function TemplateList({
  templates,
  loading,
  busyId,
  filtered,
  onEdit,
  onArchive,
  onDelete,
}: {
  templates: MessageTemplate[];
  loading: boolean;
  busyId: string | null;
  filtered: boolean;
  onEdit: (template: MessageTemplate) => void;
  onArchive: (template: MessageTemplate) => void;
  onDelete: (template: MessageTemplate) => void;
}) {
  const { t } = useTranslation("automations");

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-border/60 p-10 text-center",
          "mx-auto w-full max-w-2xl"
        )}
      >
        <FileText className="mx-auto h-6 w-6 text-muted-foreground/60" />
        <p className="mt-2.5 text-sm font-semibold text-foreground">
          {filtered
            ? t("templates.emptyFiltered", "No templates match this search")
            : t("templates.empty", "No templates yet")}
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          {filtered
            ? t("templates.emptyFilteredHint", "Try a different word, or clear the filters.")
            : t(
                "templates.emptyHint",
                "Write a message once and reuse it in rules and broadcasts. On WhatsApp an approved template is the only way to message someone who has not written to you recently."
              )}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => (
        <TemplateCard
          key={template.templateId}
          template={template}
          busy={busyId === template.templateId}
          onEdit={() => onEdit(template)}
          onArchive={() => onArchive(template)}
          onDelete={() => onDelete(template)}
        />
      ))}
    </div>
  );
}
