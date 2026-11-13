import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import {
  assertPublicWebsiteUrl,
  FIRECRAWL_API,
  getFirecrawlErrorMessage,
  isSameWebsiteDomain,
  MAX_WEBSITE_MAP_RESULTS,
  normalizeWebsiteUrl,
  parseWebsiteMapLinks,
  readFirecrawlJson,
} from "@/lib/ai/website-ingestion";
import { RETRYABLE_WEBSITE_PAGE_STATUSES } from "@/lib/ai/website-ingestion-constants";
import { getWebsiteSourceState, getWebsiteSourceStates } from "@/lib/ai/website-source-status";
import { db } from "@/lib/core/db";

class WebsitePageMutationConflictError extends Error {}

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

  const requestedSite = new URL(request.url).searchParams.get("siteUrl");
  let siteUrl: string | undefined;
  try {
    siteUrl = requestedSite ? normalizeWebsiteUrl(requestedSite).origin : undefined;
  } catch {
    return NextResponse.json({ error: "Enter a valid website URL." }, { status: 400 });
  }

  const roots = await db.websiteDiscoveredPage.findMany({
    where: { workspaceId, userId },
    distinct: ["siteUrl"],
    orderBy: { siteUrl: "asc" },
    select: { siteUrl: true },
  });
  const siteUrls = roots.map((root) => root.siteUrl);

  if (!siteUrl) {
    const latestPage = await db.websiteDiscoveredPage.findFirst({
      where: { workspaceId, userId },
      orderBy: { discoveredAt: "desc" },
      select: { siteUrl: true },
    });
    siteUrl = latestPage?.siteUrl;
  }

  if (!siteUrl) return NextResponse.json({ siteUrl: null, roots: siteUrls, pages: [] });

  let pages = await db.websiteDiscoveredPage.findMany({
    where: { workspaceId, userId, siteUrl },
    orderBy: { url: "asc" },
    take: MAX_WEBSITE_MAP_RESULTS,
    select: {
      url: true,
      title: true,
      description: true,
      status: true,
      lastError: true,
      crawledAt: true,
      sourceId: true,
    },
  });

  const sourceStates = await getWebsiteSourceStates(workspaceId, pages.map((page) => page.url));
  const importedUrls = pages
    .filter((page) => getWebsiteSourceState(sourceStates, page.url)?.imported)
    .map((page) => page.url);
  const incompleteSourceUrls = pages
    .filter((page) => {
      const sourceState = getWebsiteSourceState(sourceStates, page.url);
      return sourceState && !sourceState.imported && !sourceState.processing;
    })
    .map((page) => page.url);

  if (importedUrls.length > 0) {
    await db.websiteDiscoveredPage.updateMany({
      where: { workspaceId, userId, siteUrl, url: { in: importedUrls }, status: { not: "crawling" } },
      data: { status: "crawled", lastError: null, crawledAt: new Date() },
    });
  }
  if (incompleteSourceUrls.length > 0) {
    await db.websiteDiscoveredPage.updateMany({
      where: { workspaceId, userId, siteUrl, url: { in: incompleteSourceUrls }, jobId: null },
      data: {
        status: "failed",
        lastError: "This page was saved but could not be fully prepared. Select it to retry.",
      },
    });
  }

  if (importedUrls.length > 0 || incompleteSourceUrls.length > 0) {
    pages = await db.websiteDiscoveredPage.findMany({
      where: { workspaceId, userId, siteUrl },
      orderBy: { url: "asc" },
      take: MAX_WEBSITE_MAP_RESULTS,
      select: {
        url: true,
        title: true,
        description: true,
        status: true,
        lastError: true,
        crawledAt: true,
        sourceId: true,
      },
    });
  }
  return NextResponse.json({
    siteUrl,
    roots: siteUrls,
    pages: pages.map((page) => ({
      ...page,
      hasSource: Boolean(page.sourceId) || Boolean(getWebsiteSourceState(sourceStates, page.url)),
    })),
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
  const rootUrl = payload && typeof payload === "object" && "url" in payload
    ? (payload as { url?: unknown }).url
    : undefined;

  let root: URL;
  try {
    root = await assertPublicWebsiteUrl(rootUrl);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Enter a valid website URL." },
      { status: 400 }
    );
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error("[WEBSITE_DISCOVERY_CONFIG] Website discovery is not configured.");
    return NextResponse.json({ error: "Website discovery is temporarily unavailable. Please try again later." }, { status: 503 });
  }

  try {
    const response = await fetch(`${FIRECRAWL_API}/map`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: root.toString(),
        limit: MAX_WEBSITE_MAP_RESULTS,
        sitemap: "include",
        includeSubdomains: true,
        ignoreQueryParameters: true,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const result = await readFirecrawlJson(response);
    if (!response.ok) {
      const error = getFirecrawlErrorMessage(response.status);
      console.error("[WEBSITE_DISCOVERY_FIRECRAWL]", { status: response.status, error });
      return NextResponse.json({ error }, { status: response.status === 402 ? 402 : response.status === 429 ? 429 : 502 });
    }

    const links = parseWebsiteMapLinks(result, root);
    const urls = links.map((link) => link.url);
    const sourceStates = await getWebsiteSourceStates(workspaceId, urls);
    const now = new Date();

    if (links.length > 0) {
      await db.websiteDiscoveredPage.createMany({
        data: links.map((link) => {
          const sourceState = getWebsiteSourceState(sourceStates, link.url);
          return {
            workspaceId,
            userId,
            siteUrl: root.origin,
            url: link.url,
            title: link.title,
            description: link.description,
            status: sourceState?.imported ? "crawled" : sourceState && !sourceState.processing ? "failed" : "pending",
            sourceId: sourceState?.sourceId ?? null,
            lastError: sourceState && !sourceState.imported && !sourceState.processing
              ? "This page was saved but could not be fully prepared. Select it to retry."
              : null,
            crawledAt: sourceState?.imported ? now : null,
          };
        }),
        skipDuplicates: true,
      });

      const importedUrls = links
        .filter((link) => getWebsiteSourceState(sourceStates, link.url)?.imported)
        .map((link) => link.url);
      const incompleteSourceUrls = links
        .filter((link) => {
          const sourceState = getWebsiteSourceState(sourceStates, link.url);
          return sourceState && !sourceState.imported && !sourceState.processing;
        })
        .map((link) => link.url);
      if (importedUrls.length > 0) {
        await db.websiteDiscoveredPage.updateMany({
          where: {
            workspaceId,
            userId,
            url: { in: importedUrls },
            status: { in: [...RETRYABLE_WEBSITE_PAGE_STATUSES] },
          },
          data: { status: "crawled", lastError: null, crawledAt: now },
        });
      }
      if (incompleteSourceUrls.length > 0) {
        await db.websiteDiscoveredPage.updateMany({
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
      await db.websiteDiscoveredPage.updateMany({
        where: { workspaceId, userId, siteUrl: root.origin, url: { in: urls } },
        data: { discoveredAt: now },
      });
    }

    const pages = await db.websiteDiscoveredPage.findMany({
      where: { workspaceId, userId, siteUrl: root.origin },
      orderBy: { url: "asc" },
      take: MAX_WEBSITE_MAP_RESULTS,
      select: {
        url: true,
        title: true,
        description: true,
        status: true,
        lastError: true,
        crawledAt: true,
      },
    });
    return NextResponse.json({ siteUrl: root.origin, pages, total: pages.length, limit: MAX_WEBSITE_MAP_RESULTS });
  } catch (error) {
    console.error("[WEBSITE_DISCOVERY_POST]", error);
    return NextResponse.json({ error: "Could not discover this website's pages. Please try again." }, { status: 502 });
  }
}

export async function PATCH(
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
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = payload as { oldUrl?: unknown; url?: unknown };
  if (typeof body.oldUrl !== "string" || typeof body.url !== "string") {
    return NextResponse.json({ error: "A current URL and replacement URL are required." }, { status: 400 });
  }

  const page = await db.websiteDiscoveredPage.findFirst({
    where: { workspaceId, userId, url: body.oldUrl },
    select: { id: true, url: true, siteUrl: true, status: true, sourceId: true },
  });
  if (!page) return NextResponse.json({ error: "Website page not found." }, { status: 404 });
  if (page.status === "crawling") {
    return NextResponse.json({ error: "This page is being imported. Wait for it to finish before editing." }, { status: 409 });
  }
  const pageSourceState = await getWebsiteSourceStates(workspaceId, [page.url]);
  const sourceId = page.sourceId ?? getWebsiteSourceState(pageSourceState, page.url)?.sourceId ?? null;

  let replacement: URL;
  try {
    replacement = await assertPublicWebsiteUrl(body.url);
    if (!isSameWebsiteDomain(replacement, normalizeWebsiteUrl(page.siteUrl))) {
      return NextResponse.json({ error: "Choose a page URL from the same website." }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Enter a valid website page URL." },
      { status: 400 }
    );
  }
  const nextUrl = replacement.toString();
  if (nextUrl === page.url) return NextResponse.json({ error: "The URL has not changed." }, { status: 400 });

  const [duplicatePage, duplicateSource] = await Promise.all([
    db.websiteDiscoveredPage.findFirst({
      where: { workspaceId, url: nextUrl, id: { not: page.id } },
      select: { id: true },
    }),
    db.source.findFirst({
      where: {
        workspaceId,
        isGlobal: true,
        type: "website",
        name: nextUrl,
        ...(sourceId ? { sourceId: { not: sourceId } } : {}),
      },
      select: { sourceId: true },
    }),
  ]);
  if (duplicatePage || duplicateSource) {
    return NextResponse.json({ error: "This page URL is already saved for this business." }, { status: 409 });
  }

  try {
    const updated = await db.$transaction(async (transaction) => {
      let updatedSourceId: string | null = null;
      if (sourceId) {
        const sourceUpdate = await transaction.source.updateMany({
          where: { sourceId, workspaceId, isGlobal: true, type: "website" },
          data: { name: nextUrl, ingestionStatus: "processing" },
        });
        if (sourceUpdate.count > 0) updatedSourceId = sourceId;
      }
      const pageUpdate = await transaction.websiteDiscoveredPage.updateMany({
        where: { id: page.id, workspaceId, userId, status: { not: "crawling" } },
        data: {
          url: nextUrl,
          status: "pending",
          jobId: null,
          lastError: null,
          crawledAt: null,
          sourceId: updatedSourceId,
        },
      });
      if (pageUpdate.count === 0) {
        throw new WebsitePageMutationConflictError("This page is being imported. Wait for it to finish before editing.");
      }
      return transaction.websiteDiscoveredPage.findUniqueOrThrow({
        where: { id: page.id },
        select: { url: true, title: true, description: true, status: true, lastError: true, sourceId: true },
      });
    });
    return NextResponse.json({ page: { ...updated, hasSource: Boolean(updated.sourceId) } });
  } catch (error) {
    if (error instanceof WebsitePageMutationConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[WEBSITE_DISCOVERY_PATCH]", error);
    return NextResponse.json({ error: "Could not update this page URL. Please try again." }, { status: 500 });
  }
}

export async function DELETE(
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
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const rawUrls = (payload as { urls?: unknown }).urls;
  if (
    !Array.isArray(rawUrls)
    || rawUrls.length === 0
    || rawUrls.length > MAX_WEBSITE_MAP_RESULTS
    || rawUrls.some((url) => typeof url !== "string")
  ) {
    return NextResponse.json({ error: "Select one or more saved page URLs to delete." }, { status: 400 });
  }

  let urls: string[];
  try {
    urls = rawUrls.map((url) => normalizeWebsiteUrl(url).toString());
  } catch {
    return NextResponse.json({ error: "One or more page URLs are invalid." }, { status: 400 });
  }
  if (new Set(urls).size !== urls.length) {
    return NextResponse.json({ error: "The same page URL was selected more than once." }, { status: 400 });
  }

  const pages = await db.websiteDiscoveredPage.findMany({
    where: { workspaceId, userId, url: { in: urls } },
    select: { id: true, url: true, status: true, sourceId: true },
  });
  if (pages.length !== urls.length) {
    return NextResponse.json({ error: "Some selected pages are no longer available. Refresh the list and try again." }, { status: 409 });
  }
  if (pages.some((page) => page.status === "crawling")) {
    return NextResponse.json({ error: "Pages being imported cannot be deleted. Wait for the import to finish." }, { status: 409 });
  }

  const sourceStates = await getWebsiteSourceStates(workspaceId, urls);
  const sourceIds = [...new Set(pages.flatMap((page) => {
    const sourceId = page.sourceId ?? getWebsiteSourceState(sourceStates, page.url)?.sourceId;
    return sourceId ? [sourceId] : [];
  }))];
  const sources = sourceIds.length
    ? await db.source.findMany({
      where: { sourceId: { in: sourceIds }, workspaceId, isGlobal: true, type: "website" },
      select: { id: true },
    })
    : [];
  try {
    await db.$transaction(async (transaction) => {
      const pageDeletion = await transaction.websiteDiscoveredPage.deleteMany({
        where: {
          workspaceId,
          userId,
          id: { in: pages.map((page) => page.id) },
          status: { not: "crawling" },
        },
      });
      if (pageDeletion.count !== pages.length) {
        throw new WebsitePageMutationConflictError("Pages being imported cannot be deleted. Wait for the import to finish.");
      }
      if (sources.length > 0) {
        await transaction.source.deleteMany({
          where: { id: { in: sources.map((source) => source.id) }, workspaceId, isGlobal: true, type: "website" },
        });
      }
    });
    return NextResponse.json({ success: true, deletedCount: pages.length, deletedSources: sources.length });
  } catch (error) {
    if (error instanceof WebsitePageMutationConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[WEBSITE_DISCOVERY_DELETE]", error);
    return NextResponse.json({ error: "Could not delete the selected website pages. Please try again." }, { status: 500 });
  }
}
