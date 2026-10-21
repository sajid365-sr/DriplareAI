"use client";

import { useTranslation } from "react-i18next";
import {
  MessageCircle,
  Send,
  ExternalLink,
  Package,
  Trash2,
  Edit2,
  Clock,
  Tag,
} from "lucide-react";

export interface CommentAutomationRule {
  id: string;
  chatbotId: string;
  postId: string;
  postUrl?: string | null;
  postTitle?: string | null;
  postImageUrl?: string | null;
  productIds: string[];
  publicReplyText?: string | null;
  autoDmText: string;
  keywords: string[];
  enableFollowUp: boolean;
  followUpDelayMin: number;
  followUpDmText?: string | null;
  isActive: boolean;
  totalComments: number;
  totalDmsSent: number;
  totalFollowUps: number;
  linkedProducts?: Array<{
    productId: string;
    name: string;
    price?: number | null;
    imageUrl?: string | null;
  }>;
}

interface CommentAutomationCardProps {
  rule: CommentAutomationRule;
  onToggleActive: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (rule: CommentAutomationRule) => void;
}

export function CommentAutomationCard({
  rule,
  onToggleActive,
  onDelete,
  onEdit,
}: CommentAutomationCardProps) {
  const { t } = useTranslation("automations");

  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${
        rule.isActive
          ? "border-border/80 bg-card hover:border-violet-500/40"
          : "border-border/40 bg-card/50 opacity-75"
      }`}
    >
      <div className="space-y-3.5">
        {/* Header: Post ID & Status Toggle */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[11px] font-mono font-bold text-violet-600 dark:text-violet-400">
                Post #{rule.postId}
              </span>

              {rule.postUrl && (
                <a
                  href={rule.postUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Open</span>
                </a>
              )}
            </div>

            {rule.postTitle && (
              <p className="line-clamp-1 text-xs font-medium text-foreground">
                {rule.postTitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Active Toggle Switch */}
            <button
              type="button"
              onClick={() => onToggleActive(rule.id, !rule.isActive)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                rule.isActive ? "bg-violet-600" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  rule.isActive ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Linked Catalog Products Chips */}
        {rule.linkedProducts && rule.linkedProducts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {rule.linkedProducts.map((p) => (
              <span
                key={p.productId}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background/70 px-2 py-1 text-[11px] font-semibold text-foreground shadow-2xs"
              >
                <Package className="h-3 w-3 text-violet-500" />
                <span className="truncate max-w-[120px]">{p.name}</span>
                {p.price && (
                  <span className="text-muted-foreground">৳{p.price.toLocaleString()}</span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Keywords */}
        {rule.keywords.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="font-semibold">Keywords:</span>
            <div className="flex flex-wrap gap-1">
              {rule.keywords.map((kw, i) => (
                <span
                  key={`${kw}-${i}`}
                  className="rounded-sm bg-muted/60 px-1.5 py-0.2 font-mono text-[10px]"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Reply Previews */}
        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
          {rule.publicReplyText && (
            <div className="flex items-start gap-2">
              <MessageCircle className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="font-semibold text-foreground text-[11px] block mb-0.5">
                  Public Comment Reply:
                </span>
                <p className="text-muted-foreground italic line-clamp-2">
                  &ldquo;{rule.publicReplyText}&rdquo;
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2">
            <Send className="h-3.5 w-3.5 text-violet-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-semibold text-foreground text-[11px] block mb-0.5">
                Private Auto-DM:
              </span>
              <p className="text-muted-foreground italic line-clamp-2">
                &ldquo;{rule.autoDmText}&rdquo;
              </p>
            </div>
          </div>

          {rule.enableFollowUp && (
            <div className="flex items-center gap-1.5 border-t border-border/40 pt-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              <Clock className="h-3 w-3 shrink-0" />
              <span>
                Follow-up after {rule.followUpDelayMin} minutes if no customer reply
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Metrics & Actions */}
      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            {t("commentAutomation.totalComments", { count: rule.totalComments })}
          </span>
          <span className="flex items-center gap-1">
            <Send className="h-3 w-3" />
            {t("commentAutomation.totalDms", { count: rule.totalDmsSent })}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onEdit(rule)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Edit rule"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(rule.id)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
            title={t("commentAutomation.deleteRule", "Delete Rule")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
