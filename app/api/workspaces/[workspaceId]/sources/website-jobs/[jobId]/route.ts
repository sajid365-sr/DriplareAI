import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { createSourceWithEmbeddings } from "@/lib/ai/source-ingestion";
import {
  FIRECRAWL_API,
  formatWebsiteMarkdown,
  getCustomerSafeWebsiteError,
  MAX_WEBSITE_PAGES_PER_BATCH,
  getFirecrawlErrorMessage,
  isSameWebsiteDomain,
  normalizeWebsiteUrl,
  readFirecrawlJson,
} from "@/lib/ai/website-ingestion";
import { getWebsiteSourceState, getWebsiteSourceStates } from "@/lib/ai/website-source-status";
import { db } from "@/lib/core/db";

export const maxDuration = 60;

type ScrapedPage = {
  markdown?: unknown;
  content?: unknown;
  metadata?: unknown;
  url?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function getPages(payload: unknown): ScrapedPage[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];
  return payload.data.filter(isRecord) as ScrapedPage[];
}

function getProcessedUrls(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((url): url is string => typeof url === "string") : [];
}

function getJobResponse(job: {
  id: string;
  status: string;
  urls: unknown;
  scrapedPages: number;
  totalPages: number;
  processedPages: number;
  failedPages: number;
  error: string | null;
  createdAt: Date;
}) {
  return {
    id: job.id,
    status: job.status,
    urls: Array.isArray(job.urls) ? job.urls : [],
    scrapedPages: job.scrapedPages,
    totalPages: job.totalPages,
    processedPages: job.processedPages,
    failedPages: job.failedPages,
    error: getCustomerSafeWebsiteError(job.error),
    createdAt: job.createdAt,
  };
}

async function fetchBatchStatus(firecrawlJobId: string, apiKey: string): Promise<unknown> {
  const response = await fetch(`${FIRECRAWL_API}/batch/scrape/${encodeURIComponent(firecrawlJobId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const result = await readFirecrawlJson(response);
  if (!response.ok) {
    throw new Error(getFirecrawlErrorMessage(response.status));
  }
  return result;
}

async function fetchRemainingPages(next: unknown, firecrawlJobId: string, apiKey: string, pages: ScrapedPage[]) {
  let nextUrl = getString(next);
  while (nextUrl && pages.length < MAX_WEBSITE_PAGES_PER_BATCH) {
    const parsedNext = new URL(nextUrl);
    if (
      parsedNext.protocol !== "https:"
      || parsedNext.hostname !== "api.firecrawl.dev"
      || parsedNext.pathname !== `/v2/batch/scrape/${firecrawlJobId}`
    ) {
      throw new Error("Firecrawl returned an unexpected result page URL.");
    }

    const response = await fetch(parsedNext, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const result = await readFirecrawlJson(response);
    if (!response.ok) {
      throw new Error(`Firecrawl returned HTTP ${response.status} while loading scrape results.`);
    }
    pages.push(...getPages(result));
    nextUrl = isRecord(result) ? getString(result.next) : null;
  }
  return pages;
}

async function loadCurrentJob(jobId: string, workspaceId: string, userId: string) {
  return db.websiteIngestionJob.findFirst({
    where: { id: jobId, workspaceId, userId },
    select: {
      id: true,
      workspaceId: true,
      userId: true,
      firecrawlJobId: true,
      status: true,
      urls: true,
      processedUrls: true,
      scrapedPages: true,
      totalPages: true,
      processedPages: true,
      failedPages: true,
      creditsUsed: true,
      error: true,
      lockedUntil: true,
      expiresAt: true,
      createdAt: true,
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId, jobId } = await params;
  const workspace = await db.workspace.findFirst({
    where: { workspaceId, userId },
    select: { workspaceId: true },
  });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  let job = await loadCurrentJob(jobId, workspaceId, userId);
  if (!job) return NextResponse.json({ error: "Website import job not found." }, { status: 404 });

  if (["completed", "partial", "failed", "cancelled"].includes(job.status)) {
    return NextResponse.json({ job: getJobResponse(job) });
  }
  if (job.expiresAt <= new Date()) {
    job = await db.websiteIngestionJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: "This website import expired before it could finish. Start a new import.",
        completedAt: new Date(),
        lockedUntil: null,
      },
      select: {
        id: true,
        workspaceId: true,
        userId: true,
        firecrawlJobId: true,
        status: true,
        urls: true,
        processedUrls: true,
        scrapedPages: true,
        totalPages: true,
        processedPages: true,
        failedPages: true,
        creditsUsed: true,
        error: true,
        lockedUntil: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    await db.websiteDiscoveredPage.updateMany({
      where: { workspaceId, userId, jobId: job.id, status: "crawling" },
      data: { status: "failed", lastError: "This website import expired before it could finish.", jobId: null },
    });
    return NextResponse.json({ job: getJobResponse(job) });
  }

  const now = new Date();
  if (job.status === "starting" || !job.firecrawlJobId) {
    return NextResponse.json({ job: getJobResponse(job) });
  }
  if (job.status === "ingesting" && job.lockedUntil && job.lockedUntil > now) {
    return NextResponse.json({ job: getJobResponse(job) });
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error("[WEBSITE_INGESTION_CONFIG] Website processing is not configured.");
    return NextResponse.json({ error: "Website processing is temporarily unavailable. Please try again later." }, { status: 503 });
  }

  let firecrawlStatus: unknown;
  try {
    firecrawlStatus = await fetchBatchStatus(job.firecrawlJobId, apiKey);
  } catch (error) {
    console.error("[WEBSITE_INGESTION_STATUS_FIRECRAWL]", error);
    return NextResponse.json({ error: "Could not check website import progress. Please retry shortly." }, { status: 502 });
  }

  const externalStatus = isRecord(firecrawlStatus) ? getString(firecrawlStatus.status) : null;
  const externalTotal = job.totalPages;
  const externalCompleted = Math.min(
    isRecord(firecrawlStatus) ? getNumber(firecrawlStatus.completed, job.scrapedPages) : job.scrapedPages,
    externalTotal
  );
  const creditsUsed = isRecord(firecrawlStatus) ? getNumber(firecrawlStatus.creditsUsed, job.creditsUsed) : job.creditsUsed;

  if (externalStatus === "failed" || externalStatus === "cancelled") {
    const failed = await db.websiteIngestionJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: "These pages could not be processed. Check that they are publicly accessible and try again.",
        totalPages: externalTotal,
        scrapedPages: externalCompleted,
        failedPages: Math.max(externalTotal - externalCompleted, 0),
        creditsUsed,
        completedAt: new Date(),
        lockedUntil: null,
      },
      select: {
        id: true,
        status: true,
        urls: true,
        scrapedPages: true,
        totalPages: true,
        processedPages: true,
        failedPages: true,
        creditsUsed: true,
        error: true,
        createdAt: true,
      },
    });
    await db.websiteDiscoveredPage.updateMany({
      where: { workspaceId, userId, jobId: job.id, status: "crawling" },
      data: {
        status: "failed",
        lastError: "These pages could not be processed. Check that they are publicly accessible and try again.",
        jobId: null,
      },
    });
    return NextResponse.json({ job: getJobResponse(failed) });
  }

  if (externalStatus !== "completed") {
    const updated = await db.websiteIngestionJob.update({
      where: { id: job.id },
      data: {
        status: "scraping",
        totalPages: externalTotal,
        scrapedPages: externalCompleted,
        creditsUsed,
      },
      select: {
        id: true,
        status: true,
        urls: true,
        scrapedPages: true,
        totalPages: true,
        processedPages: true,
        failedPages: true,
        creditsUsed: true,
        error: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ job: getJobResponse(updated) });
  }

  const lockExpiry = new Date(Date.now() + 65_000);
  const claimed = job.status === "ingesting"
    ? await db.websiteIngestionJob.updateMany({
      where: { id: job.id, status: "ingesting", OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] },
      data: { lockedUntil: lockExpiry, error: null },
    })
    : await db.websiteIngestionJob.updateMany({
      where: { id: job.id, status: "scraping" },
      data: {
        status: "ingesting",
        lockedUntil: lockExpiry,
        error: null,
        totalPages: externalTotal,
        scrapedPages: externalCompleted,
        creditsUsed,
      },
    });
  if (claimed.count === 0) {
    const current = await loadCurrentJob(job.id, workspaceId, userId);
    return current
      ? NextResponse.json({ job: getJobResponse(current) })
      : NextResponse.json({ error: "Website import job not found." }, { status: 404 });
  }

  const requestedUrls = Array.isArray(job.urls) ? job.urls.filter((url): url is string => typeof url === "string") : [];
  const processedUrls = new Set(getProcessedUrls(job.processedUrls));
  const sourceStates = await getWebsiteSourceStates(workspaceId, requestedUrls);
  try {
    const pages = await fetchRemainingPages(
      isRecord(firecrawlStatus) ? firecrawlStatus.next : undefined,
      job.firecrawlJobId,
      apiKey,
      getPages(firecrawlStatus)
    );
    const requestedUrlSet = new Set(requestedUrls.map((url) => normalizeWebsiteUrl(url).toString()));
    const rootUrl = requestedUrls.length ? normalizeWebsiteUrl(requestedUrls[0]) : null;

    for (const page of pages) {
      const currentJob = await db.websiteIngestionJob.findFirst({
        where: { id: job.id, workspaceId, userId },
        select: { status: true },
      });
      if (!currentJob || currentJob.status !== "ingesting") {
        const current = await loadCurrentJob(job.id, workspaceId, userId);
        return current
          ? NextResponse.json({ job: getJobResponse(current) })
          : NextResponse.json({ error: "Website import job not found." }, { status: 404 });
      }

      const metadata = isRecord(page.metadata) ? page.metadata : {};
      const rawUrl = getString(metadata.sourceURL) ?? getString(metadata.url) ?? getString(page.url);
      if (!rawUrl) continue;

      let sourceUrl: URL;
      try {
        sourceUrl = normalizeWebsiteUrl(rawUrl);
      } catch {
        continue;
      }
      const canonicalUrl = sourceUrl.toString();
      if (
        !rootUrl
        || !requestedUrlSet.has(canonicalUrl)
        || !isSameWebsiteDomain(sourceUrl, rootUrl)
        || processedUrls.has(canonicalUrl)
      ) {
        continue;
      }

      const rawContent = getString(page.markdown) ?? getString(page.content);
      if (!rawContent) continue;
      if (formatWebsiteMarkdown(rawContent).length < 40) continue;

      const stableSuffix = createHash("sha256").update(`${workspaceId}:${canonicalUrl}`).digest("hex").slice(0, 32);
      const sourceId = getWebsiteSourceState(sourceStates, canonicalUrl)?.sourceId ?? `src_${stableSuffix}`;
      await createSourceWithEmbeddings({
        sourceId,
        workspaceId,
        isGlobal: true,
        type: "website",
        name: canonicalUrl,
        content: rawContent,
      });
      await db.websiteDiscoveredPage.updateMany({
        where: { workspaceId, userId, url: canonicalUrl, jobId: job.id },
        data: { status: "crawled", sourceId, crawledAt: new Date(), lastError: null, jobId: null },
      });
      processedUrls.add(canonicalUrl);
      await db.websiteIngestionJob.update({
        where: { id: job.id },
        data: {
          processedUrls: [...processedUrls],
          processedPages: processedUrls.size,
          creditsUsed,
          error: null,
        },
      });
    }

    const failedPages = Math.max(externalTotal - processedUrls.size, 0);
    const failedUrls = requestedUrls.filter((url) => !processedUrls.has(url));
    if (failedUrls.length > 0) {
      await db.websiteDiscoveredPage.updateMany({
        where: { workspaceId, userId, url: { in: failedUrls }, jobId: job.id, status: "crawling" },
        data: {
          status: "failed",
          lastError: "This page could not be added. Check that it is publicly accessible and try again.",
          jobId: null,
        },
      });
    }
    const finalStatus = failedPages === 0 ? "completed" : processedUrls.size > 0 ? "partial" : "failed";
    await db.websiteIngestionJob.updateMany({
      where: { id: job.id, status: "ingesting" },
      data: {
        status: finalStatus,
        processedUrls: [...processedUrls],
        processedPages: processedUrls.size,
        failedPages,
        creditsUsed,
        error: failedPages > 0 ? `${failedPages} page(s) could not be added.` : null,
        completedAt: new Date(),
        lockedUntil: null,
      },
    });
    const finalJob = await loadCurrentJob(job.id, workspaceId, userId);
    if (!finalJob) return NextResponse.json({ error: "Website import job not found." }, { status: 404 });
    return NextResponse.json({ job: getJobResponse(finalJob) });
  } catch (error) {
    console.error("[WEBSITE_INGESTION_PROCESS]", error);
    const failedPages = Math.max(requestedUrls.length - processedUrls.size, 0);
    const failureStatus = processedUrls.size > 0 ? "partial" : "failed";
    await db.websiteIngestionJob.updateMany({
      where: { id: job.id, status: "ingesting" },
      data: {
        status: failureStatus,
        processedUrls: [...processedUrls],
        processedPages: processedUrls.size,
        failedPages,
        error: "Could not save all scraped pages. Select failed pages and try again.",
        completedAt: new Date(),
        lockedUntil: null,
      },
    });
    await db.websiteDiscoveredPage.updateMany({
      where: { workspaceId, userId, jobId: job.id, status: "crawling" },
      data: {
        status: "failed",
        lastError: "This page could not be saved. Select it and try again.",
        jobId: null,
      },
    });
    const failed = await loadCurrentJob(job.id, workspaceId, userId);
    return failed
      ? NextResponse.json({ job: getJobResponse(failed) })
      : NextResponse.json({ error: "Website import job not found." }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId, jobId } = await params;
  const workspace = await db.workspace.findFirst({
    where: { workspaceId, userId },
    select: { workspaceId: true },
  });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const job = await loadCurrentJob(jobId, workspaceId, userId);
  if (!job) return NextResponse.json({ error: "Website import job not found." }, { status: 404 });
  if (["completed", "partial", "failed", "cancelled"].includes(job.status)) {
    return NextResponse.json({ job: getJobResponse(job) });
  }

  const cancelled = await db.$transaction(async (transaction) => {
    const result = await transaction.websiteIngestionJob.updateMany({
      where: {
        id: job.id,
        workspaceId,
        userId,
        status: { in: ["starting", "scraping", "ingesting"] },
      },
      data: {
        status: "cancelled",
        error: null,
        completedAt: new Date(),
        lockedUntil: null,
      },
    });
    if (result.count > 0) {
      await transaction.websiteDiscoveredPage.updateMany({
        where: { workspaceId, userId, jobId: job.id, status: "crawling" },
        data: { status: "pending", jobId: null, lastError: null },
      });
    }
    return result.count;
  });

  const updatedJob = await loadCurrentJob(job.id, workspaceId, userId);
  if (!updatedJob) return NextResponse.json({ error: "Website import job not found." }, { status: 404 });
  if (cancelled === 0 && !["completed", "partial", "failed", "cancelled"].includes(updatedJob.status)) {
    return NextResponse.json({ error: "The website import could not be cancelled. Please try again." }, { status: 409 });
  }
  return NextResponse.json({ job: getJobResponse(updatedJob) });
}
