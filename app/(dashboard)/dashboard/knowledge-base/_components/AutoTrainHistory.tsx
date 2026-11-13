"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Archive, ChevronDown, ChevronUp, ExternalLink, FileText, Loader2, MessageSquareText, RotateCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type RunSource = {
  agentName: string;
  sourceName: string;
  platform: string;
  mode?: string;
  count?: number;
  fromDate?: string;
  toDate?: string;
};

type LearningRun = {
  id: string;
  status: string;
  sources: unknown;
  totalConversations: number;
  processedConversations: number;
  transcriptCount: number;
  answerDraftCount: number;
  contentDraftCount: number;
  failedSources: number;
  truncatedSources: number;
  inputTruncated: boolean;
  error: string | null;
  detailsExpiresAt: string | null;
  approvedAnswerCount: number;
  approvedContentCount: number;
  failedItems: number;
  applyStatus: string;
  savedItems: unknown;
  createdAt: string;
  completedAt: string | null;
  appliedAt: string | null;
  details?: unknown;
};

type DraftCard = {
  type: "answer" | "content";
  title: string;
  content: string;
  reviewStatus: "approved" | "not_selected" | "pending_review" | "unknown";
  evidence?: { platform: string; label: string; quote: string; agentName?: string };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

function readSources(value: unknown): RunSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    return [{
      agentName: typeof entry.agentName === "string" ? entry.agentName : "AI Agent",
      sourceName: typeof entry.sourceName === "string" ? entry.sourceName : String(entry.platform ?? "Source"),
      platform: typeof entry.platform === "string" ? entry.platform : "unknown",
      ...(typeof entry.mode === "string" ? { mode: entry.mode } : {}),
      ...(typeof entry.count === "number" ? { count: entry.count } : {}),
      ...(typeof entry.fromDate === "string" ? { fromDate: entry.fromDate } : {}),
      ...(typeof entry.toDate === "string" ? { toDate: entry.toDate } : {}),
    }];
  });
}

function readDrafts(value: unknown): DraftCard[] {
  if (!isRecord(value) || !isRecord(value.drafts)) return [];
  const drafts = value.drafts;
  const answers: DraftCard[] = [];
  if (Array.isArray(drafts.faqs)) {
    for (const draft of drafts.faqs) {
      if (!isRecord(draft) || typeof draft.question !== "string" || typeof draft.answer !== "string") continue;
      answers.push({
        type: "answer",
        title: draft.question,
        content: draft.answer,
        reviewStatus: readReviewStatus(draft.reviewStatus),
        evidence: readEvidence(draft.evidence),
      });
    }
  }
  if (Array.isArray(drafts.sampleReplies)) {
    for (const draft of drafts.sampleReplies) {
      if (!isRecord(draft) || typeof draft.customerMessage !== "string" || typeof draft.reply !== "string") continue;
      answers.push({
        type: "answer",
        title: draft.customerMessage,
        content: draft.reply,
        reviewStatus: readReviewStatus(draft.reviewStatus),
        evidence: readEvidence(draft.evidence),
      });
    }
  }
  if (Array.isArray(drafts.content)) {
    for (const draft of drafts.content) {
      if (!isRecord(draft) || typeof draft.title !== "string" || typeof draft.content !== "string") continue;
      answers.push({
        type: "content",
        title: draft.title,
        content: draft.content,
        reviewStatus: readReviewStatus(draft.reviewStatus),
        evidence: readEvidence(draft.evidence),
      });
    }
  }
  return answers;
}

function readReviewStatus(value: unknown): DraftCard["reviewStatus"] {
  return value === "approved" || value === "not_selected" || value === "unknown" ? value : "pending_review";
}

function readEvidence(value: unknown): DraftCard["evidence"] {
  if (!isRecord(value) || typeof value.platform !== "string" || typeof value.label !== "string" || typeof value.quote !== "string") return undefined;
  return {
    platform: value.platform,
    label: value.label,
    quote: value.quote,
    ...(typeof value.agentName === "string" ? { agentName: value.agentName } : {}),
  };
}

function readRun(value: unknown): LearningRun | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.status !== "string") return null;
  const number = (key: string) => typeof value[key] === "number" ? value[key] as number : 0;
  return {
    id: value.id,
    status: value.status,
    sources: value.sources,
    totalConversations: number("totalConversations"),
    processedConversations: number("processedConversations"),
    transcriptCount: number("transcriptCount"),
    answerDraftCount: number("answerDraftCount"),
    contentDraftCount: number("contentDraftCount"),
    failedSources: number("failedSources"),
    truncatedSources: number("truncatedSources"),
    inputTruncated: value.inputTruncated === true,
    error: typeof value.error === "string" ? value.error : null,
    detailsExpiresAt: typeof value.detailsExpiresAt === "string" ? value.detailsExpiresAt : null,
    approvedAnswerCount: number("approvedAnswerCount"),
    approvedContentCount: number("approvedContentCount"),
    failedItems: number("failedItems"),
    applyStatus: typeof value.applyStatus === "string" ? value.applyStatus : "not_applied",
    savedItems: value.savedItems,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
    completedAt: typeof value.completedAt === "string" ? value.completedAt : null,
    appliedAt: typeof value.appliedAt === "string" ? value.appliedAt : null,
    ...(value.details !== undefined ? { details: value.details } : {}),
  };
}

async function readApiResponse(response: Response): Promise<unknown> {
  const body = await response.text();
  if (!body) return null;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

function readApiError(payload: unknown, fallback: string): string {
  return isRecord(payload) && typeof payload.code === "string" ? payload.code : fallback;
}

export function AutoTrainHistory({ workspaceId, refreshKey }: { workspaceId: string; refreshKey: number }) {
  const { t, i18n } = useTranslation("knowledge-base");
  const [runs, setRuns] = useState<LearningRun[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, LearningRun>>({});
  const [detailsLoading, setDetailsLoading] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const loadRuns = useCallback(async (append = false, cursor?: string, silent = false) => {
    if (!workspaceId) return;
    if (append) setLoadingMore(true);
    else if (!silent) {
      setLoading(true);
      setLoadError(false);
    }
    try {
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/auto-train/history${query}`, { cache: "no-store" });
      const payload = await readApiResponse(response);
      if (!response.ok) throw new Error(readApiError(payload, "history_load_failed"));
      if (!isRecord(payload) || !Array.isArray(payload.runs)) throw new Error("history_invalid_response");
      const page = payload.runs.map(readRun).filter((run): run is LearningRun => run !== null);
      setRuns((previous) => append ? [...previous, ...page] : page);
      setNextCursor(typeof payload.nextCursor === "string" ? payload.nextCursor : null);
    } catch (error) {
      console.error("[AUTO_TRAIN_HISTORY_LOAD]", error);
      if (!append && !silent) setLoadError(true);
      if (!silent) {
        const code = error instanceof Error ? error.message : "history_load_failed";
        toast.error(t(`autoTrain.history.errors.${code}`, { defaultValue: t("autoTrain.history.loadError") }));
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [workspaceId, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load learning history when the workspace changes.
    void loadRuns();
  }, [loadRuns, refreshKey]);

  useEffect(() => {
    if (!runs.some((run) => ["queued", "running"].includes(run.status))) return;
    const timer = setInterval(() => void loadRuns(false, undefined, true), 4_000);
    return () => clearInterval(timer);
  }, [loadRuns, runs]);

  const toggleDetails = async (run: LearningRun) => {
    if (expandedRunId === run.id) {
      setExpandedRunId(null);
      return;
    }
    setExpandedRunId(run.id);
    if (details[run.id]) return;
    setDetailsLoading(run.id);
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/auto-train/history/${encodeURIComponent(run.id)}`,
        { cache: "no-store" }
      );
      const payload = await readApiResponse(response);
      if (!response.ok) throw new Error(readApiError(payload, "history_load_failed"));
      if (!isRecord(payload)) throw new Error("history_invalid_response");
      const detail = readRun(payload.run);
      if (!detail) throw new Error("details_failed");
      setDetails((previous) => ({ ...previous, [run.id]: detail }));
    } catch (error) {
      console.error("[AUTO_TRAIN_HISTORY_DETAIL]", error);
      const code = error instanceof Error ? error.message : "history_load_failed";
      toast.error(t(`autoTrain.history.errors.${code}`, { defaultValue: t("autoTrain.history.detailError") }));
      setExpandedRunId(null);
    } finally {
      setDetailsLoading(null);
    }
  };

  const formatDate = (value: string | null) => value
    ? new Intl.DateTimeFormat(i18n.language.startsWith("bn") ? "bn-BD" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : t("autoTrain.history.pending");

  const historyHref = (destination: "answers" | "sources") =>
    `/dashboard/knowledge-base?tab=${destination}`;

  return (
    <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <RotateCw className="size-4" />
        </span>
        <div>
          <h3 className="font-semibold text-foreground">{t("autoTrain.history.title")}</h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{t("autoTrain.history.description")}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />{t("autoTrain.history.loading")}
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">{t("autoTrain.history.loadError")}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadRuns()} className="mt-3">{t("common.retry")}</Button>
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center">
          <Sparkles className="mx-auto mb-2 size-6 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">{t("autoTrain.history.empty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const sources = readSources(run.sources);
            const detail = details[run.id];
            const drafts = detail ? readDrafts(detail.details) : [];
            const savedItems = Array.isArray(run.savedItems)
              ? run.savedItems.filter((item): item is { id: string; destination: "answers" | "sources" } =>
                isRecord(item) && typeof item.id === "string" && (item.destination === "answers" || item.destination === "sources"))
              : [];
            const expanded = expandedRunId === run.id;
            const expired = Boolean(run.completedAt && !run.detailsExpiresAt);
            return (
              <article key={run.id} className="overflow-hidden rounded-xl border border-border/70">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{formatDate(run.createdAt)}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        run.status === "failed" ? "bg-destructive/10 text-destructive"
                          : run.status === "completed" ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}>
                        {t(`autoTrain.history.status.${run.status}`, run.status)}
                      </span>
                      {run.applyStatus !== "not_applied" && (
                        <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-xs text-secondary-foreground">
                          {t(`autoTrain.history.applyStatus.${run.applyStatus}`, run.applyStatus)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("autoTrain.history.conversationCount", {
                        processed: run.processedConversations,
                        total: run.totalConversations,
                        chats: run.transcriptCount,
                      })}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{t("autoTrain.history.draftCounts", { answers: run.answerDraftCount, content: run.contentDraftCount })}</span>
                      {(run.approvedAnswerCount + run.approvedContentCount > 0) && (
                        <span>{t("autoTrain.history.approvedCounts", { answers: run.approvedAnswerCount, content: run.approvedContentCount })}</span>
                      )}
                      {run.failedSources > 0 && <span className="text-destructive">{t("autoTrain.history.failedSources", { count: run.failedSources })}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {sources.map((source, index) => (
                        <span key={`${source.platform}:${source.sourceName}:${index}`} className="rounded-md bg-muted/70 px-2 py-1 text-xs text-muted-foreground">
                          {source.sourceName} · {source.agentName} · {source.platform}
                        </span>
                      ))}
                    </div>
                    {run.error && <p className="text-xs text-destructive">{run.error}</p>}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => void toggleDetails(run)} className="shrink-0 gap-2">
                    {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    {t("autoTrain.history.details")}
                  </Button>
                </div>

                {expanded && (
                  <div className="space-y-4 border-t border-border/70 bg-muted/20 p-4">
                    {detailsLoading === run.id ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />{t("autoTrain.history.loadingDetails")}
                      </div>
                    ) : ["queued", "running", "paused"].includes(run.status) ? (
                      <p className="text-sm text-muted-foreground">{t("autoTrain.history.detailsPending")}</p>
                    ) : expired || detail?.details == null ? (
                      <p className="text-sm text-muted-foreground">
                        {expired ? t("autoTrain.history.detailsExpired") : t("autoTrain.history.detailsUnavailable")}
                      </p>
                    ) : drafts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("autoTrain.history.noDrafts")}</p>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {t("autoTrain.history.detailsRetention", { date: formatDate(run.detailsExpiresAt) })}
                        </p>
                        <div className="space-y-3">
                          {drafts.map((draft, index) => (
                            <div key={`${draft.type}:${index}`} className="rounded-lg border border-border/60 bg-card p-3">
                              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                  {draft.type === "answer" ? <MessageSquareText className="size-3.5" /> : <FileText className="size-3.5" />}
                                  {t(`autoTrain.history.draftType.${draft.type}`)}
                                </span>
                                <span className="rounded-full bg-muted px-2 py-0.5">
                                  {t(`autoTrain.history.draftStatus.${draft.reviewStatus}`)}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap text-sm font-medium text-foreground">{draft.title}</p>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">{draft.content}</p>
                              {draft.evidence && (
                                <blockquote className="mt-3 border-l-2 border-primary/40 pl-3 text-xs leading-5 text-muted-foreground">
                                  <span className="font-medium">{draft.evidence.label} · {draft.evidence.platform}</span>
                                  {draft.evidence.agentName && <span> · {draft.evidence.agentName}</span>}
                                  <p className="mt-1">{draft.evidence.quote}</p>
                                </blockquote>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {(run.approvedAnswerCount > 0 || run.approvedContentCount > 0) && (
                      <div className="flex flex-wrap gap-2">
                        {run.approvedAnswerCount > 0 && (
                          <Link href={historyHref("answers")} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted">
                            <MessageSquareText className="size-3.5" />
                            {t("autoTrain.history.openAnswers", { count: run.approvedAnswerCount })}
                            <ExternalLink className="size-3" />
                          </Link>
                        )}
                        {run.approvedContentCount > 0 && (
                          <Link href={historyHref("sources")} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted">
                            <Archive className="size-3.5" />
                            {t("autoTrain.history.openSources", { count: run.approvedContentCount })}
                            <ExternalLink className="size-3" />
                          </Link>
                        )}
                        {savedItems.length > 0 && (
                          <span className="sr-only">{t("autoTrain.history.savedItemCount", { count: savedItems.length })}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
          {nextCursor && (
            <div className="text-center">
              <Button type="button" variant="outline" size="sm" disabled={loadingMore} onClick={() => void loadRuns(true, nextCursor)}>
                {loadingMore && <Loader2 className="size-4 animate-spin" />}
                {t("autoTrain.history.loadMore")}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
