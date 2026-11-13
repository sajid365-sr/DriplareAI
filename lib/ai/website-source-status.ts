import "server-only";

import { db } from "@/lib/core/db";
import { canonicalizeWebsitePageUrl, normalizeWebsiteUrl } from "@/lib/ai/website-ingestion";

export type WebsiteSourceState = {
  sourceId: string;
  imported: boolean;
  processing: boolean;
};

export function getWebsiteSourceState(
  states: Map<string, WebsiteSourceState>,
  url: string
): WebsiteSourceState | undefined {
  return states.get(canonicalizeWebsitePageUrl(url));
}

function getUrlVariants(value: string): string[] {
  const url = normalizeWebsiteUrl(value);
  const variants = new Set([url.toString()]);
  url.pathname = url.pathname.replace(/\/+$/, "");
  variants.add(url.toString());
  if (!url.pathname) {
    url.pathname = "/";
    variants.add(url.toString());
  }
  return [...variants];
}

export async function getWebsiteSourceStates(
  workspaceId: string,
  urls: string[]
): Promise<Map<string, WebsiteSourceState>> {
  if (urls.length === 0) return new Map();

  const variants = [...new Set(urls.flatMap(getUrlVariants))];
  const sources = await db.source.findMany({
    where: {
      workspaceId,
      isGlobal: true,
      type: "website",
      name: { in: variants },
    },
    select: { sourceId: true, name: true, ingestionStatus: true },
  });
  if (sources.length === 0) return new Map();

  const sourceIds = sources.map((source) => source.sourceId);
  const chunkCounts = await db.$queryRaw<Array<{
    sourceId: string;
    chunkCount: number;
    embeddedCount: number;
  }>>`
    SELECT
      "sourceId",
      COUNT(*)::int AS "chunkCount",
      COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS "embeddedCount"
    FROM "chatbot"."Chunk"
    WHERE "sourceId" = ANY(${sourceIds}::text[])
    GROUP BY "sourceId"
  `;
  const importedSourceIds = new Set(
    chunkCounts
      .filter(({ chunkCount, embeddedCount }) => chunkCount > 0 && chunkCount === embeddedCount)
      .map(({ sourceId }) => sourceId)
  );

  const states = new Map<string, WebsiteSourceState>();
  for (const source of sources) {
    const key = canonicalizeWebsitePageUrl(source.name);
    const processing = source.ingestionStatus === "processing";
    const imported = source.ingestionStatus === "ready" && importedSourceIds.has(source.sourceId);
    const current = states.get(key);
    if (!current || imported || (!current.imported && processing && !current.processing)) {
      states.set(key, { sourceId: source.sourceId, imported, processing });
    }
  }

  return states;
}
