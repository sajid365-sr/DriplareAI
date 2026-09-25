"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  MessageSquareWarning,
  Paperclip,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FeedbackDetailDialog } from "@/components/admin/feedback/FeedbackDetailDialog";
import { feedbackStatusClass } from "@/components/feedback/status-styles";
import { cn } from "@/lib/utils";
import type { FeedbackStatus } from "@/lib/domain/feedback-schema";

/**
 * Admin feedback queue.
 * ─────────────────────────────────────────────────────────────────────────────
 * Same shape as the contacts queue, with two differences that matter: the rows
 * carry a merchant identity (so an admin knows who is waiting), and opening one
 * loads the full thread with the captured environment rather than a single
 * message.
 */

type AdminFeedbackRow = {
  id: string;
  subject: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  lastReplyAt: string | null;
  replyCount: number;
  pageUrl: string | null;
  merchant: { name: string; email: string };
  attachmentCount: number;
  messagePreview: string;
};

type FeedbackResponse = {
  items: AdminFeedbackRow[];
  pagination: { page: number; totalPages: number; total: number };
  stats: Record<FeedbackStatus, number> & { total: number };
};

const STATUS_OPTIONS = ["all", "open", "in_progress", "resolved", "closed"] as const;

export default function AdminFeedbackPage() {
  const { t } = useTranslation("admin");

  const [data, setData] = useState<FeedbackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (query) params.set("q", query);

      const response = await fetch(`/api/admin/feedback?${params}`);
      if (!response.ok) throw new Error("Failed to load");

      setData(await response.json());
    } catch {
      toast.error(t("feedback.loadError", "Could not load feedback."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, query, t]);

  useEffect(() => {
    void fetchFeedback();
  }, [fetchFeedback]);

  // The notification email links to `/admin/feedback?id=...`, so open that
  // ticket straight away. Read from `location` rather than `useSearchParams`
  // to avoid forcing a Suspense boundary around the whole page.
  useEffect(() => {
    const deepLinkId = new URLSearchParams(window.location.search).get("id");
    if (deepLinkId) setSelectedId(deepLinkId);
  }, []);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const statCards = [
    {
      key: "open",
      label: t("feedback.stats.open", "Open"),
      value: data?.stats.open ?? 0,
      icon: Inbox,
    },
    {
      key: "in_progress",
      label: t("feedback.stats.in_progress", "In Progress"),
      value: data?.stats.in_progress ?? 0,
      icon: Clock,
    },
    {
      key: "resolved",
      label: t("feedback.stats.resolved", "Resolved"),
      value: data?.stats.resolved ?? 0,
      icon: CheckCircle2,
    },
    {
      key: "total",
      label: t("feedback.stats.total", "Total"),
      value: data?.stats.total ?? 0,
      icon: MessageSquareWarning,
    },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("feedback.title", "Merchant Feedback")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "feedback.description",
              "Bug reports and issues sent from merchant dashboards, with the context needed to reproduce them."
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("feedback.searchPlaceholder", "Search subject or merchant")}
              className="w-[220px] rounded-xl pl-8 pr-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label={t("feedback.clearSearch", "Clear search")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
            <SelectTrigger className="w-[160px] rounded-xl">
              <SelectValue placeholder={t("feedback.filterStatus", "Status")} />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === "all"
                    ? t("feedback.status.all", "All")
                    : t(`feedback.status.${status}`, status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => void fetchFeedback()}
            className="rounded-xl"
            aria-label={t("feedback.refresh", "Refresh")}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </motion.div>

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ key, label, value, icon: Icon }, index) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-2xl border border-primary/10 bg-card/60 p-4 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Queue ─────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-primary/10 bg-card/40">
        {loading && !data ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.items.length ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {t("feedback.empty", "No feedback here yet.")}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {data.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-primary/5 md:px-6"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MessageSquareWarning className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground truncate">{item.subject}</span>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", feedbackStatusClass(item.status))}
                      >
                        {t(`feedback.status.${item.status}`, item.status)}
                      </Badge>
                      {item.replyCount > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {t("feedback.replies", {
                            count: item.replyCount,
                            defaultValue: `${item.replyCount} replies`,
                          })}
                        </Badge>
                      )}
                      {item.attachmentCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Paperclip className="h-3 w-3" />
                          {item.attachmentCount}
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {item.merchant.name} · {item.merchant.email}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground/80">
                      {item.messagePreview}
                    </p>
                  </div>

                  <time className="shrink-0 text-[11px] text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </time>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FeedbackDetailDialog
        feedbackId={selectedId}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={() => void fetchFeedback()}
      />
    </div>
  );
}
