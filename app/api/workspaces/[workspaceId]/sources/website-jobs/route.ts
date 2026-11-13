import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import {
  assertPublicWebsiteUrl,
  FIRECRAWL_API,
  getCustomerSafeWebsiteError,
  getFirecrawlErrorMessage,
  normalizeWebsiteUrl,
  readFirecrawlJson,
  validateWebsitePageUrls,
} from "@/lib/ai/website-ingestion";
import { RETRYABLE_WEBSITE_PAGE_STATUSES } from "@/lib/ai/website-ingestion-constants";
import { getWebsiteSourceState, getWebsiteSourceStates } from "@/lib/ai/website-source-status";
import { db } from "@/lib/core/db";

class WebsitePageConflictError extends Error {}

function getErrorCode(status: number): number {
  return status === 402 ? 402 : status === 429 ? 429 : 502;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  const workspace = await db.workspace.findFirst({
    where: { workspaceId, userId },
    select: { workspaceId: true },
  });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const activeStatuses = ["starting", "scraping", "ingesting"];
  const pageSize = 10;
  const rawPage = Number(new URL(request.url).searchParams.get("page") ?? "0");
  const requestedPage = Number.isSafeInteger(rawPage) ? Math.max(0, rawPage) : 0;
  const now = new Date();
  await db.websiteIngestionJob.deleteMany({
    where: {
      workspaceId,
      userId,
      status: { notIn: activeStatuses },
      expiresAt: { lte: now },
    },
  });
  const select = {
    id: true,
    status: true,
    urls: true,
    totalPages: true,
    scrapedPages: true,
    processedPages: true,
    failedPages: true,
    error: true,
    createdAt: true,
  } as const;
  const total = await db.websiteIngestionJob.count({
    where: {
      workspaceId,
      userId,
      status: { notIn: activeStatuses },
      expiresAt: { gt: now },
    },
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages - 1);
  const [activeJobs, recentJobs] = await Promise.all([
    db.websiteIngestionJob.findMany({
      where: { workspaceId, userId, status: { in: activeStatuses } },
      orderBy: { createdAt: "desc" },
      select,
    }),
    db.websiteIngestionJob.findMany({
      where: {
        workspaceId,
        userId,
        status: { notIn: activeStatuses },
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
      skip: page * pageSize,
      take: pageSize,
      select,
    }),
  ]);
  const jobs = [...activeJobs, ...recentJobs].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  return NextResponse.json({
    jobs: jobs.map((job) => ({ ...job, error: getCustomerSafeWebsiteError(job.error) })),
    page,
    pageSize,
    total,
    totalPages,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  const workspace = await db.workspace.findFirst({
    where: { workspaceId, userId },
    select: { workspaceId: true },
  });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const rawUrls = payload && typeof payload === "object" && "urls" in payload
    ? (payload as { urls?: unknown }).urls
    : undefined;
  const rootUrl = payload && typeof payload === "object" && "rootUrl" in payload
    ? (payload as { rootUrl?: unknown }).rootUrl
    : undefined;
  const reimport = payload !== null
    && typeof payload === "object"
    && "reimport" in payload
    && (payload as { reimport?: unknown }).reimport === true;

  let urls: string[];
  try {
    urls = validateWebsitePageUrls(rawUrls, rootUrl);
    if (rootUrl !== undefined) await assertPublicWebsiteUrl(rootUrl);
    const checkedUrls = await Promise.all(urls.map((url) => assertPublicWebsiteUrl(url)));
    urls = checkedUrls.map((url) => url.toString());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Choose valid public page URLs." },
      { status: 400 }
    );
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error("[WEBSITE_INGESTION_CONFIG] Website processing is not configured.");
    return NextResponse.json({ error: "Website processing is temporarily unavailable. Please try again later." }, { status: 503 });
  }

  const jobId = randomUUID();
  const siteUrl = rootUrl === undefined
    ? new URL(urls[0]).origin
    : normalizeWebsiteUrl(rootUrl).origin;
  const sourceStates = await getWebsiteSourceStates(workspaceId, urls);
  let job: { id: string; status: string; totalPages: number; urls: unknown };

  try {
    job = await db.$transaction(async (transaction) => {
      await transaction.websiteDiscoveredPage.createMany({
        data: urls.map((url) => {
          const sourceState = getWebsiteSourceState(sourceStates, url);
          return {
            workspaceId,
            userId,
            siteUrl,
            url,
            title: "",
            description: "",
            status: sourceState?.imported ? "crawled" : sourceState && !sourceState.processing ? "failed" : "pending",
            sourceId: sourceState?.sourceId ?? null,
            lastError: sourceState && !sourceState.imported && !sourceState.processing
              ? "This page was saved but could not be fully prepared. Select it to retry."
              : null,
            crawledAt: sourceState?.imported ? new Date() : null,
          };
        }),
        skipDuplicates: true,
      });

      const importedUrls = urls.filter((url) => getWebsiteSourceState(sourceStates, url)?.imported);
      const incompleteSourceUrls = urls.filter((url) => {
        const sourceState = getWebsiteSourceState(sourceStates, url);
        return sourceState && !sourceState.imported && !sourceState.processing;
      });
      if (importedUrls.length > 0) {
        await transaction.websiteDiscoveredPage.updateMany({
          where: {
            workspaceId,
            userId,
            url: { in: importedUrls },
            status: { in: [...RETRYABLE_WEBSITE_PAGE_STATUSES] },
          },
          data: { status: "crawled", crawledAt: new Date(), lastError: null },
        });
      }
      if (incompleteSourceUrls.length > 0) {
        await transaction.websiteDiscoveredPage.updateMany({
          where: {
            workspaceId,
            userId,
            url: { in: incompleteSourceUrls },
            jobId: null,
            status: { in: ["pending", "failed", "crawled"] },
          },
          data: {
            status: "failed",
            lastError: "This page was saved but could not be fully prepared. Select it to retry.",
          },
        });
      }
      if (reimport) {
        await transaction.websiteDiscoveredPage.updateMany({
          where: { workspaceId, userId, url: { in: urls }, status: "crawled", jobId: null },
          data: { status: "pending" },
        });
      }

      const pages = await transaction.websiteDiscoveredPage.findMany({
        where: { workspaceId, userId, url: { in: urls } },
        select: { url: true, status: true },
      });
      if (
        pages.length !== urls.length
        || pages.some((page) => page.status === "crawling" || (!reimport && page.status === "crawled"))
      ) {
        throw new WebsitePageConflictError("Some selected pages are already imported or being processed.");
      }

      const claimed = await transaction.websiteDiscoveredPage.updateMany({
        where: { workspaceId, userId, url: { in: urls }, status: { in: [...RETRYABLE_WEBSITE_PAGE_STATUSES] } },
        data: { status: "crawling", jobId, lastError: null },
      });
      if (claimed.count !== urls.length) {
        throw new WebsitePageConflictError("Some selected pages changed status. Refresh the list and try again.");
      }

      return transaction.websiteIngestionJob.create({
        data: {
          id: jobId,
          workspaceId,
          userId,
          status: "starting",
          urls,
          totalPages: urls.length,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        select: { id: true, status: true, totalPages: true, urls: true },
      });
    });
  } catch (error) {
    if (error instanceof WebsitePageConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[WEBSITE_INGESTION_RESERVE_PAGES]", error);
    return NextResponse.json({ error: "Could not reserve the selected pages. Please refresh and try again." }, { status: 500 });
  }

  try {
    const response = await fetch(`${FIRECRAWL_API}/batch/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        urls,
        formats: ["markdown"],
        onlyMainContent: true,
        maxConcurrency: 2,
        ignoreInvalidURLs: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const result = await readFirecrawlJson(response);
    if (!response.ok) {
      const message = getFirecrawlErrorMessage(response.status);
      await db.websiteIngestionJob.update({
        where: { id: job.id },
        data: { status: "failed", error: message, completedAt: new Date() },
      });
      await db.websiteDiscoveredPage.updateMany({
        where: { workspaceId, userId, jobId, status: "crawling" },
        data: { status: "failed", lastError: message, jobId: null },
      });
      console.error("[WEBSITE_INGESTION_START_FIRECRAWL]", { status: response.status, error: message });
      return NextResponse.json({ error: message }, { status: getErrorCode(response.status) });
    }

    const firecrawlJobId = result && typeof result === "object" && "id" in result
      ? (result as { id?: unknown }).id
      : undefined;
    if (typeof firecrawlJobId !== "string" || !firecrawlJobId) {
      throw new Error("Firecrawl accepted the batch but did not return a job ID.");
    }

    const updatedJob = await db.websiteIngestionJob.update({
      where: { id: job.id },
      data: { firecrawlJobId, status: "scraping" },
      select: { id: true, status: true, totalPages: true, urls: true },
    });
    return NextResponse.json({ job: updatedJob }, { status: 202 });
  } catch (error) {
    console.error("[WEBSITE_INGESTION_START_POST]", error);
    const message = "Could not start website scraping. Please try again.";
    await db.websiteIngestionJob.updateMany({
      where: { id: jobId, status: "starting" },
      data: { status: "failed", error: message, completedAt: new Date() },
    });
    await db.websiteDiscoveredPage.updateMany({
      where: { workspaceId, userId, jobId, status: "crawling" },
      data: { status: "failed", lastError: message, jobId: null },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
