"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronLeft, ChevronRight, Globe, Loader2, Pencil, RefreshCw, Search, Trash2, X } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/use-confirm";
import { isWebsitePageSelectable, MAX_WEBSITE_PAGES_PER_BATCH } from "@/lib/ai/website-ingestion-constants";

interface WebsiteTabProps {
  chatbotId?: string;
  workspaceId?: string;
  onSuccess: () => void;
  workspacePanel?: WorkspaceWebsitePanel;
}

type WebsiteMode = "discover" | "manual";
type WorkspaceWebsitePanel = "pages" | "history";

type WebsiteLink = {
  url: string;
  title: string;
  description: string;
  status: string;
  lastError: string | null;
  hasSource: boolean;
};

type WebsiteJob = {
  id: string;
  status: string;
  urls: string[];
  scrapedPages: number;
  totalPages: number;
  processedPages: number;
  failedPages: number;
  error: string | null;
};

const PAGE_SIZE = 25;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseJob(value: unknown): WebsiteJob | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.status !== "string") return null;
  const number = (candidate: unknown) =>
    typeof candidate === "number" && Number.isFinite(candidate) ? candidate : 0;
  return {
    id: value.id,
    status: value.status,
    urls: Array.isArray(value.urls) ? value.urls.filter((url): url is string => typeof url === "string") : [],
    scrapedPages: number(value.scrapedPages),
    totalPages: number(value.totalPages),
    processedPages: number(value.processedPages),
    failedPages: number(value.failedPages),
    error: typeof value.error === "string" ? value.error : null,
  };
}

function pageStatusClass(status: string): string {
  if (status === "crawled") return "border-success/30 bg-success/10 text-success";
  if (status === "failed") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (status === "crawling") return "border-warning/30 bg-warning/10 text-warning";
  return "border-border bg-muted text-muted-foreground";
}

function jobStatusClass(status: string): string {
  if (status === "completed") return "border-success/30 bg-success/10 text-success";
  if (status === "partial" || status === "failed") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (status === "cancelled") return "border-border bg-muted text-muted-foreground";
  return "border-warning/30 bg-warning/10 text-warning";
}

async function getError(response: Response, fallback: string): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

export function WebsiteTab({ chatbotId, workspaceId, onSuccess, workspacePanel = "pages" }: WebsiteTabProps) {
  if (workspaceId) {
    return <WorkspaceWebsiteTab workspaceId={workspaceId} onSuccess={onSuccess} panel={workspacePanel} />;
  }
  return <LegacyWebsiteTab chatbotId={chatbotId} onSuccess={onSuccess} />;
}

function LegacyWebsiteTab({ chatbotId, onSuccess }: Omit<WebsiteTabProps, "workspaceId">) {
  const { t } = useTranslation("knowledge-base");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const addUrl = async () => {
    if (!url.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/sources/website`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        throw new Error(await getError(res, t("contentTraining.website.legacy.fetchError")));
      }

      setUrl("");
      toast.success(t("contentTraining.website.legacy.success"));
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("contentTraining.website.legacy.fetchError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-4"
    >
      <Label className="text-xs font-semibold uppercase text-muted-foreground">{t("contentTraining.website.legacy.urlLabel")}</Label>
      <div className="relative">
        <Globe className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("contentTraining.website.rootUrlPlaceholder")}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void addUrl()}
          className="h-11 rounded-xl bg-secondary/10 pl-10"
          data-testid="src-url-input"
        />
      </div>
      <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 text-xs leading-relaxed text-primary/80">
        {t("contentTraining.website.legacy.hint")}
      </div>
      <Button onClick={addUrl} disabled={busy || !url.trim()} className="rounded-full" data-testid="src-url-add">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("contentTraining.website.legacy.addButton")}
      </Button>
    </motion.div>
  );
}

function WorkspaceWebsiteTab({
  workspaceId,
  onSuccess,
  panel,
}: {
  workspaceId: string;
  onSuccess: () => void;
  panel: WorkspaceWebsitePanel;
}) {
  const { t } = useTranslation("knowledge-base");
  const confirm = useConfirm((state) => state.confirm);
  const [mode, setMode] = useState<WebsiteMode>("discover");
  const [rootUrl, setRootUrl] = useState("");
  const [selectedSiteUrl, setSelectedSiteUrl] = useState("");
  const [siteRoots, setSiteRoots] = useState<string[]>([]);
  const [manualUrls, setManualUrls] = useState("");
  const [links, setLinks] = useState<WebsiteLink[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [editingUrl, setEditingUrl] = useState<string | null>(null);
  const [editUrlDraft, setEditUrlDraft] = useState("");
  const [jobs, setJobs] = useState<WebsiteJob[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyPageCount, setHistoryPageCount] = useState(1);
  const [discovering, setDiscovering] = useState(false);
  const [refreshingPages, setRefreshingPages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const statusRef = useRef(new Map<string, string>());
  const pollingRef = useRef(false);
  const basePath = `/api/workspaces/${workspaceId}/sources`;

  const refreshInventory = useCallback(async (site = "") => {
    const query = site ? `?siteUrl=${encodeURIComponent(site)}` : "";
    const response = await fetch(`${basePath}/website-discovery${query}`, { cache: "no-store" });
    if (!response.ok) throw new Error(await getError(response, t("contentTraining.website.discoveryError")));
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.pages)) return [];
    if (Array.isArray(payload.roots)) {
      setSiteRoots(payload.roots.filter((root): root is string => typeof root === "string"));
    }
    const savedPages = payload.pages.filter((link): link is WebsiteLink =>
      isRecord(link)
      && typeof link.url === "string"
      && typeof link.status === "string"
    ).map((link) => ({
      url: link.url,
      title: typeof link.title === "string" ? link.title : "",
      description: typeof link.description === "string" ? link.description : "",
      status: link.status,
      lastError: typeof link.lastError === "string" ? link.lastError : null,
      hasSource: link.hasSource === true,
    }));
    setLinks(savedPages);
    setSelectedUrls((current) => current.filter((url) =>
      savedPages.some((saved) => saved.url === url && saved.status !== "crawling")
    ));
    if (typeof payload.siteUrl === "string") {
      const savedSiteUrl = payload.siteUrl;
      setSelectedSiteUrl(savedSiteUrl);
      window.localStorage.setItem(`website-inventory-site-${workspaceId}`, savedSiteUrl);
    }
    return savedPages;
  }, [basePath, t, workspaceId]);

  const refreshJobs = useCallback(async (requestedPage = 0) => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    let finishedNewJob = false;
    try {
      const response = await fetch(`${basePath}/website-jobs?page=${requestedPage}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload: unknown = await response.json();
      if (!isRecord(payload) || !Array.isArray(payload.jobs)) return;

      const listedJobs = payload.jobs.map(parseJob).filter((job): job is WebsiteJob => job !== null);
      const nextHistoryPageCount = typeof payload.totalPages === "number" && Number.isFinite(payload.totalPages)
        ? Math.max(1, Math.floor(payload.totalPages))
        : 1;
      setHistoryPageCount(nextHistoryPageCount);
      if (requestedPage >= nextHistoryPageCount) setHistoryPage(nextHistoryPageCount - 1);
      const totalHistoryJobs = typeof payload.total === "number" && Number.isFinite(payload.total)
        ? Math.max(0, Math.floor(payload.total))
        : 0;
      const activeJobs = listedJobs.filter((job) => ["starting", "scraping", "ingesting"].includes(job.status));
      const refreshedJobs = await Promise.all(activeJobs.map(async (job) => {
        try {
          const jobResponse = await fetch(`${basePath}/website-jobs/${job.id}`, { cache: "no-store" });
          if (!jobResponse.ok) {
            return { ...job, error: await getError(jobResponse, t("contentTraining.website.progressError")) };
          }
          const result: unknown = await jobResponse.json();
          return isRecord(result) ? parseJob(result.job) ?? job : job;
        } catch {
          return job;
        }
      }));

      const refreshedById = new Map(refreshedJobs.map((job) => [job.id, job]));
      const nextJobs = listedJobs.map((job) => refreshedById.get(job.id) ?? job);
      const nextStatuses = new Map(nextJobs.map((job) => [job.id, job.status]));
      const newlyFinishedJobs = nextJobs.filter((job) =>
        ["completed", "partial"].includes(job.status)
        && statusRef.current.has(job.id)
        && statusRef.current.get(job.id) !== job.status
      );
      finishedNewJob = newlyFinishedJobs.length > 0;
      if (finishedNewJob) {
        setHistoryPageCount(Math.max(1, Math.ceil((totalHistoryJobs + newlyFinishedJobs.length) / 10)));
      }
      statusRef.current = nextStatuses;
      setJobs(nextJobs);
      if (activeJobs.length > 0 || finishedNewJob) await refreshInventory(selectedSiteUrl);
      if (finishedNewJob) onSuccess();
    } catch (error) {
      console.error("[WEBSITE_IMPORT_JOBS_LOAD]", error);
    } finally {
      pollingRef.current = false;
    }
  }, [basePath, onSuccess, refreshInventory, selectedSiteUrl, t]);

  const hasActiveJobs = jobs.some((job) => ["starting", "scraping", "ingesting"].includes(job.status));

  useEffect(() => {
    const savedSite = window.localStorage.getItem(`website-inventory-site-${workspaceId}`) ?? "";
    const initial = window.setTimeout(() => {
      void refreshInventory(savedSite).catch((error) => console.error("[WEBSITE_INVENTORY_LOAD]", error));
    }, 0);
    return () => {
      window.clearTimeout(initial);
    };
  }, [refreshInventory, refreshJobs, workspaceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshJobs(historyPage), 0);
    return () => window.clearTimeout(timer);
  }, [historyPage, refreshJobs]);

  useEffect(() => {
    if (!hasActiveJobs) return;
    const timer = window.setInterval(() => void refreshJobs(historyPage), 4000);
    return () => window.clearInterval(timer);
  }, [hasActiveJobs, historyPage, refreshJobs]);

  const filteredLinks = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return links.filter((link) => {
      const matchesSearch = !needle || `${link.title} ${link.url} ${link.description}`.toLowerCase().includes(needle);
      return matchesSearch && (statusFilter === "all" || link.status === statusFilter);
    });
  }, [links, search, statusFilter]);
  const pageCount = Math.ceil(filteredLinks.length / PAGE_SIZE);
  const visibleLinks = filteredLinks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const visibleAvailableUrls = visibleLinks
    .filter((link) => link.status !== "crawling")
    .map((link) => link.url);
  const allVisibleAvailableSelected = visibleAvailableUrls.length > 0
    && visibleAvailableUrls.every((url) => selectedUrls.includes(url));
  const urlsToSubmit = mode === "discover"
    ? selectedUrls.filter((url) => {
      const link = links.find((entry) => entry.url === url);
      return link && isWebsitePageSelectable(link.status);
    })
    : manualUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);

  const discoverPages = async (refresh = false, targetUrl = rootUrl.trim()) => {
    if (!targetUrl) return;
    setDiscovering(true);
    setRefreshingPages(refresh);
    try {
      if (!refresh) {
        const savedPages = await refreshInventory(targetUrl);
        if (savedPages.length > 0) {
          setSearch("");
          setStatusFilter("all");
          setPage(0);
          toast.success(t("contentTraining.website.savedPagesLoaded"));
          return;
        }
      }

      const response = await fetch(`${basePath}/website-discovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });
      if (!response.ok) throw new Error(await getError(response, t("contentTraining.website.discoveryError")));
      const payload: unknown = await response.json();
      const discovered = isRecord(payload) && Array.isArray(payload.pages)
        ? payload.pages.filter((link): link is WebsiteLink =>
          isRecord(link) && typeof link.url === "string" && typeof link.status === "string"
        ).map((link) => ({
          url: link.url,
          title: typeof link.title === "string" ? link.title : "",
          description: typeof link.description === "string" ? link.description : "",
          status: link.status,
          lastError: typeof link.lastError === "string" ? link.lastError : null,
          hasSource: link.status === "crawled" || link.hasSource === true,
        }))
        : [];
      setLinks(discovered);
      setSelectedUrls([]);
      setSearch("");
      setStatusFilter("all");
      setPage(0);
      const discoveredRoot = isRecord(payload) && typeof payload.siteUrl === "string"
        ? payload.siteUrl
        : targetUrl;
      setSelectedSiteUrl(discoveredRoot);
      setSiteRoots((current) => Array.from(new Set([...current, discoveredRoot])).sort());
      window.localStorage.setItem(`website-inventory-site-${workspaceId}`, discoveredRoot);
      if (discovered.length === 0) toast.info(t("contentTraining.website.noPages"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("contentTraining.website.discoveryError"));
    } finally {
      setDiscovering(false);
      setRefreshingPages(false);
    }
  };

  const toggleSelection = (url: string) => {
    setSelectedUrls((current) => {
      if (current.includes(url)) return current.filter((entry) => entry !== url);
      const link = links.find((entry) => entry.url === url);
      if (!link || link.status === "crawling") return current;
      return [...current, url];
    });
  };

  const startImport = async (targetUrls = urlsToSubmit, clearSelection = true, reimport = false) => {
    if (targetUrls.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch(`${basePath}/website-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: targetUrls,
          ...(mode === "discover" && rootUrl.trim() ? { rootUrl } : {}),
          ...(reimport ? { reimport: true } : {}),
        }),
      });
      if (!response.ok) throw new Error(await getError(response, t("contentTraining.website.startError")));
      const payload: unknown = await response.json();
      const job = isRecord(payload) ? parseJob(payload.job) : null;
      if (!job) throw new Error(t("contentTraining.website.startError"));
      statusRef.current.set(job.id, job.status);
      if (clearSelection) {
        setSelectedUrls([]);
        setManualUrls("");
      } else {
        setSelectedUrls((current) => current.filter((url) => !targetUrls.includes(url)));
      }
      void refreshInventory(selectedSiteUrl);
      void refreshJobs(historyPage);
      toast.success(t("contentTraining.website.jobStarted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("contentTraining.website.startError"));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelImport = async (jobId: string) => {
    if (cancellingJobId) return;
    setCancellingJobId(jobId);
    try {
      const response = await fetch(`${basePath}/website-jobs/${jobId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await getError(response, t("contentTraining.website.cancelError")));
      const result: unknown = await response.json();
      const job = isRecord(result) ? parseJob(result.job) : null;
      if (!job) throw new Error(t("contentTraining.website.cancelError"));
      statusRef.current.set(job.id, job.status);
      toast.success(t("contentTraining.website.cancelled"));
      await Promise.all([refreshJobs(historyPage), refreshInventory(selectedSiteUrl)]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("contentTraining.website.cancelError"));
    } finally {
      setCancellingJobId(null);
    }
  };

  const savePageUrl = async (oldUrl: string) => {
    const nextUrl = editUrlDraft.trim();
    if (!nextUrl || nextUrl === oldUrl) {
      setEditingUrl(null);
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${basePath}/website-discovery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldUrl, url: nextUrl }),
      });
      if (!response.ok) throw new Error(await getError(response, t("contentTraining.website.updatePageError")));
      const hadSource = links.find((link) => link.url === oldUrl)?.hasSource === true;
      setEditingUrl(null);
      setSelectedUrls((current) => current.filter((url) => url !== oldUrl));
      await refreshInventory(selectedSiteUrl);
      toast.success(t(
        hadSource
          ? "contentTraining.website.pageUrlUpdated"
          : "contentTraining.website.pageUrlAdded"
      ));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("contentTraining.website.updatePageError"));
    } finally {
      setSubmitting(false);
    }
  };

  const deletePages = (urls: string[]) => {
    if (urls.length === 0) return;
    const removesImportedSources = links.some((link) => urls.includes(link.url) && link.hasSource);
    confirm(
      t("contentTraining.website.deletePagesTitle"),
      removesImportedSources
        ? t("contentTraining.website.deleteImportedPagesConfirm", { count: urls.length })
        : t("contentTraining.website.deletePagesConfirm", { count: urls.length }),
      () => {
        void (async () => {
          try {
            const response = await fetch(`${basePath}/website-discovery`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ urls }),
            });
            if (!response.ok) throw new Error(await getError(response, t("contentTraining.website.deletePagesError")));
            setSelectedUrls((current) => current.filter((url) => !urls.includes(url)));
            await refreshInventory(selectedSiteUrl);
            toast.success(t("contentTraining.website.pagesDeleted", { count: urls.length }));
          } catch (error) {
            toast.error(error instanceof Error ? error.message : t("contentTraining.website.deletePagesError"));
          }
        })();
      }
    );
  };

  const toggleVisibleSelection = () => {
    setSelectedUrls((current) => allVisibleAvailableSelected
      ? current.filter((url) => !visibleAvailableUrls.includes(url))
      : [...new Set([...current, ...visibleAvailableUrls])]);
  };

  const statusLabel = (status: string) => {
    const key = `contentTraining.website.status.${status}`;
    return t(key, { defaultValue: t("contentTraining.website.status.scraping") });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-5"
    >
      {panel === "pages" ? (
      <>
      <div
        className="grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-secondary/5 p-1"
        role="tablist"
        aria-label={t("contentTraining.website.pageEntryMethods")}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const nextMode = mode === "discover" ? "manual" : "discover";
          setMode(nextMode);
          event.currentTarget.querySelector<HTMLButtonElement>(`[data-website-mode="${nextMode}"]`)?.focus();
        }}
      >
        {(["discover", "manual"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            id={`website-mode-tab-${option}`}
            aria-controls="website-mode-panel"
            aria-selected={mode === option}
            tabIndex={mode === option ? 0 : -1}
            data-website-mode={option}
            onClick={() => setMode(option)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === option
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-transparent text-muted-foreground hover:bg-primary/10 hover:text-primary"
            }`}
          >
            {t(`contentTraining.website.mode.${option}`)}
          </button>
        ))}
      </div>

      {mode === "discover" ? (
        <div
          id="website-mode-panel"
          role="tabpanel"
          aria-labelledby={`website-mode-tab-${mode}`}
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-[minmax(13rem,16rem)_minmax(0,1fr)] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="website-root-filter">{t("contentTraining.website.filterByRoot", { defaultValue: "Filter pages by website" })}</Label>
              <select
                id="website-root-filter"
                value={siteRoots.includes(selectedSiteUrl) ? selectedSiteUrl : ""}
                onChange={(event) => {
                  const selectedRoot = event.target.value;
                  setSelectedSiteUrl(selectedRoot);
                  setSelectedUrls([]);
                  setPage(0);
                  void refreshInventory(selectedRoot).catch((error) =>
                    toast.error(error instanceof Error ? error.message : t("contentTraining.website.discoveryError"))
                  );
                }}
                disabled={siteRoots.length === 0}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              >
                <option value="">{t("contentTraining.website.allRootsPlaceholder", { defaultValue: "Choose a saved website" })}</option>
                {siteRoots.map((site) => <option key={site} value={site}>{site}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="website-root-url">{t("contentTraining.website.rootUrl")}</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="website-root-url"
                  placeholder={t("contentTraining.website.rootUrlPlaceholder")}
                  value={rootUrl}
                  onChange={(event) => setRootUrl(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void discoverPages()}
                  className="h-11 min-w-0 flex-1 rounded-xl bg-secondary/10"
                />
                <Button onClick={() => void discoverPages()} disabled={discovering || !rootUrl.trim()} className="w-full rounded-xl sm:w-auto">
                  {t("contentTraining.website.discover")}
                </Button>
                {(selectedSiteUrl || rootUrl.trim()) && (
                  <Button
                    type="button"
                    variant="outline"
                    title={t("contentTraining.website.refreshPagesHint")}
                    onClick={() => void discoverPages(true, selectedSiteUrl || rootUrl.trim())}
                    disabled={discovering}
                    className="w-full rounded-xl sm:w-auto"
                  >
                    {refreshingPages
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : null}
                    {t("contentTraining.website.refreshPages")}
                  </Button>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{t("contentTraining.website.discoveryHint")}</p>

          {links.length > 0 && (
            <div className="space-y-3 rounded-xl border border-border/60 bg-card p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-foreground">
                  {t("contentTraining.website.discoveredCount", { count: links.length })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("contentTraining.website.selectedCount", {
                    selected: urlsToSubmit.length,
                    max: MAX_WEBSITE_PAGES_PER_BATCH,
                  })}
                </p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label={t("contentTraining.website.searchPages")}
                  placeholder={t("contentTraining.website.searchPages")}
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(0);
                  }}
                  className="h-10 rounded-lg pl-9"
                />
              </div>
              <select
                aria-label={t("contentTraining.website.filterByStatus")}
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(0);
                }}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground sm:w-56"
              >
                {["all", "pending", "crawling", "crawled", "failed"].map((status) => (
                  <option key={status} value={status}>
                    {t(`contentTraining.website.pageStatusFilter.${status}`)}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border/60 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={toggleVisibleSelection}
                  disabled={visibleAvailableUrls.length === 0}
                >
                  <Check className="mr-2 h-4 w-4" />
                  {t(allVisibleAvailableSelected
                    ? "contentTraining.website.clearVisibleSelection"
                    : "contentTraining.website.selectVisiblePages")}
                </Button>
                <div className="flex items-center gap-2">
                  {selectedUrls.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {t("contentTraining.website.selectedForManagement", { count: selectedUrls.length })}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={selectedUrls.length === 0 || submitting}
                    onClick={() => deletePages(selectedUrls)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("contentTraining.website.deleteSelected")}
                  </Button>
                </div>
              </div>
              <div className="max-h-[55vh] space-y-1 overflow-y-auto">
                {visibleLinks.map((link) => {
                  const selected = selectedUrls.includes(link.url);
                  return (
                    <div key={link.url} className="flex flex-wrap items-start gap-2 rounded-lg px-2 py-2 hover:bg-secondary/20">
                      <button
                        type="button"
                        disabled={link.status === "crawling"}
                        aria-pressed={selected}
                        aria-label={selected
                          ? t("contentTraining.website.deselectPage", { url: link.url })
                          : t("contentTraining.website.selectPage", { url: link.url })}
                        onClick={() => toggleSelection(link.url)}
                        className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-background text-primary transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {selected && <Check className="h-3.5 w-3.5" />}
                      </button>
                      {editingUrl === link.url ? (
                        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
                          <Input
                            type="url"
                            aria-label={t("contentTraining.website.editPageUrl")}
                            value={editUrlDraft}
                            onChange={(event) => setEditUrlDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") void savePageUrl(link.url);
                              if (event.key === "Escape") setEditingUrl(null);
                            }}
                            className="h-9 min-w-0 flex-1"
                          />
                          <Button type="button" size="sm" disabled={submitting || !editUrlDraft.trim()} onClick={() => void savePageUrl(link.url)}>
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("contentTraining.website.savePageUrl")}
                          </Button>
                          <Button type="button" size="sm" variant="ghost" disabled={submitting} onClick={() => setEditingUrl(null)}>
                            {t("contentTraining.website.cancelEdit")}
                          </Button>
                        </div>
                      ) : (
                      <>
                      <div className="min-w-0 flex-1">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {link.title || link.url}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{link.url}</span>
                          {link.description && <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{link.description}</span>}
                          {link.lastError && <span className="mt-1 block text-xs text-destructive">{link.lastError}</span>}
                        </span>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${pageStatusClass(link.status)}`}>
                        {t(`contentTraining.website.pageStatus.${link.status}`, { defaultValue: link.status })}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        {(link.hasSource || isWebsitePageSelectable(link.status)) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={submitting || link.status === "crawling"}
                            onClick={() => void startImport([link.url], false, link.hasSource)}
                            className="h-8 px-2 text-xs"
                          >
                            {submitting
                              ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                            {t(link.hasSource
                              ? "contentTraining.website.reimportPage"
                              : link.status === "failed"
                                ? "contentTraining.website.retryPage"
                                : "contentTraining.website.importPage")}
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("contentTraining.website.editPageUrl")}
                          title={t("contentTraining.website.editPageUrl")}
                          disabled={submitting || link.status === "crawling"}
                          onClick={() => {
                            setEditingUrl(link.url);
                            setEditUrlDraft(link.url);
                          }}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("contentTraining.website.deletePage")}
                          title={t("contentTraining.website.deletePage")}
                          disabled={submitting || link.status === "crawling"}
                          onClick={() => deletePages([link.url])}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      </>
                      )}
                    </div>
                  );
                })}
                {visibleLinks.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">{t("contentTraining.website.noSearchResults")}</p>
                )}
              </div>
              {pageCount > 1 && (
                <div className="flex items-center justify-between border-t border-border/60 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}>
                    <ChevronLeft className="mr-1 h-4 w-4" />{t("contentTraining.website.previous")}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {t("contentTraining.website.pageOf", { page: page + 1, total: pageCount })}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={page + 1 >= pageCount}>
                    {t("contentTraining.website.next")}<ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          id="website-mode-panel"
          role="tabpanel"
          aria-labelledby={`website-mode-tab-${mode}`}
          className="space-y-3"
        >
          <Label htmlFor="website-manual-urls">{t("contentTraining.website.manualUrls")}</Label>
          <textarea
            id="website-manual-urls"
            value={manualUrls}
            onChange={(event) => setManualUrls(event.target.value)}
            placeholder={t("contentTraining.website.manualUrlsPlaceholder")}
            className="min-h-36 w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("contentTraining.website.manualHint", { count: MAX_WEBSITE_PAGES_PER_BATCH })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("contentTraining.website.manualCount", { count: urlsToSubmit.length, max: MAX_WEBSITE_PAGES_PER_BATCH })}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-primary/10 bg-primary/5 p-3 text-xs leading-relaxed text-primary/80">
        {t("contentTraining.website.processingHint")}
      </div>

      <Button
        onClick={() => void startImport()}
        disabled={submitting || urlsToSubmit.length === 0 || urlsToSubmit.length > MAX_WEBSITE_PAGES_PER_BATCH}
        className="w-full rounded-xl"
      >
        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
        {submitting
          ? t("contentTraining.website.starting")
          : t("contentTraining.website.startImport", { count: urlsToSubmit.length })}
      </Button>
      </>
      ) : (
        <>
          <p className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            {t("contentTraining.website.historyRetention")}
          </p>
          <WorkspaceImportHistory
            jobs={jobs}
            cancellingJobId={cancellingJobId}
            onCancel={cancelImport}
            statusLabel={statusLabel}
            page={historyPage}
            pageCount={historyPageCount}
            onPageChange={setHistoryPage}
          />
        </>
      )}
    </motion.div>
  );
}

function WorkspaceImportHistory({
  jobs,
  cancellingJobId,
  onCancel,
  statusLabel,
  page,
  pageCount,
  onPageChange,
}: {
  jobs: WebsiteJob[];
  cancellingJobId: string | null;
  onCancel: (jobId: string) => Promise<void>;
  statusLabel: (status: string) => string;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation("knowledge-base");

  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        {t("contentTraining.website.noImportHistory")}
      </div>
    );
  }

  const activeJobs = jobs.filter((job) => ["starting", "scraping", "ingesting"].includes(job.status));
  const completedJobs = jobs.filter((job) => !["starting", "scraping", "ingesting"].includes(job.status));

  return (
    <section aria-label={t("contentTraining.website.importHistory")} className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{t("contentTraining.website.importHistory")}</h3>
      {activeJobs.map((job) => {
        return (
          <WebsiteImportJobCard
            key={job.id}
            job={job}
            cancellingJobId={cancellingJobId}
            onCancel={onCancel}
            statusLabel={statusLabel}
          />
        );
      })}
      {completedJobs.map((job) => {
        return (
          <WebsiteImportJobCard
            key={job.id}
            job={job}
            cancellingJobId={cancellingJobId}
            onCancel={onCancel}
            statusLabel={statusLabel}
          />
        );
      })}
      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-border/60 pt-2">
          <Button variant="ghost" size="sm" onClick={() => onPageChange(Math.max(0, page - 1))} disabled={page === 0}>
            <ChevronLeft className="mr-1 h-4 w-4" />{t("contentTraining.website.previous")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t("contentTraining.website.pageOf", { page: page + 1, total: pageCount })}
          </span>
          <Button variant="ghost" size="sm" onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))} disabled={page + 1 >= pageCount}>
            {t("contentTraining.website.next")}<ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </section>
  );
}

function WebsiteImportJobCard({
  job,
  cancellingJobId,
  onCancel,
  statusLabel,
}: {
  job: WebsiteJob;
  cancellingJobId: string | null;
  onCancel: (jobId: string) => Promise<void>;
  statusLabel: (status: string) => string;
}) {
  const { t } = useTranslation("knowledge-base");
  const progressCount = job.status === "scraping" ? job.scrapedPages : job.processedPages;
  const progress = job.totalPages > 0 ? Math.min((progressCount / job.totalPages) * 100, 100) : 0;
  const active = ["starting", "scraping", "ingesting"].includes(job.status);
  return (
    <div key={job.id} className="space-y-2 rounded-xl border border-border/60 bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground">{job.urls[0]}</p>
          <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${jobStatusClass(job.status)}`}>
            {statusLabel(job.status)}
          </span>
        </div>
        {active && (
          <div className="flex shrink-0 items-center gap-1">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("contentTraining.website.cancelImport")}
              title={t("contentTraining.website.cancelImport")}
              disabled={cancellingJobId !== null}
              onClick={() => void onCancel(job.id)}
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
            >
              {cancellingJobId === job.id
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <X className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>
      {active && (
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{t("contentTraining.website.jobProgress", { processed: progressCount, total: job.totalPages })}</span>
        {job.failedPages > 0 && <span>{t("contentTraining.website.failedPages", { count: job.failedPages })}</span>}
      </div>
      {job.error && <p className="text-xs text-destructive">{job.error}</p>}
    </div>
  );
}
