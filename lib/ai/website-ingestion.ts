import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { MAX_WEBSITE_MAP_RESULTS, MAX_WEBSITE_PAGES_PER_BATCH } from "@/lib/ai/website-ingestion-constants";

export { MAX_WEBSITE_MAP_RESULTS, MAX_WEBSITE_PAGES_PER_BATCH };
export const FIRECRAWL_API = "https://api.firecrawl.dev/v2";

export type WebsiteMapLink = {
  url: string;
  title: string;
  description: string;
};

function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [first, second] = address.split(".").map(Number);
    return first === 0
      || first === 10
      || first === 127
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || (first === 192 && second === 0)
      || (first === 192 && second === 2)
      || (first === 100 && second >= 64 && second <= 127)
      || (first === 198 && (second === 18 || second === 19))
      || (first === 198 && second === 51)
      || (first === 203 && second === 0)
      || first === 255
      || first >= 224;
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    return normalized === "::"
      || normalized === "::1"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || /^fe[89ab]/.test(normalized)
      || normalized.startsWith("ff")
      || normalized.startsWith("::ffff:");
  }

  return false;
}

export function normalizeWebsiteUrl(value: unknown): URL {
  if (typeof value !== "string" || value.length > 2048) {
    throw new Error("Enter a valid website URL.");
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid website URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS website URLs are supported.");
  }
  if (!url.hostname || url.username || url.password) {
    throw new Error("Enter a public website URL without login credentials.");
  }

  url.hash = "";
  return url;
}

export function canonicalizeWebsitePageUrl(value: string): string {
  const url = normalizeWebsiteUrl(value);
  const pathname = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${pathname}${url.search}`;
}

export function formatWebsiteMarkdown(markdown: string, maxChars = 50_000): string {
  const lines = markdown
    .replace(/\r\n?/g, "\n")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\((?:<)?[^)\s>]+(?:>)?(?:\s+["'][^"']*["'])?\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim());

  const formatted: string[] = [];
  for (const line of lines) {
    if (!line) {
      if (formatted.length > 0 && formatted[formatted.length - 1] !== "") formatted.push("");
      continue;
    }

    formatted.push(line);
  }

  return formatted.join("\n").trim().slice(0, maxChars);
}

export async function assertPublicWebsiteUrl(value: unknown): Promise<URL> {
  const url = normalizeWebsiteUrl(value);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Private or local website addresses are not supported.");
  }

  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw new Error("Private or local website addresses are not supported.");
    }
    return url;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("The website address could not be resolved.");
  }

  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new Error("Private or local website addresses are not supported.");
  }

  return url;
}

function normalizeDomain(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function isSameWebsiteDomain(candidate: URL, root: URL): boolean {
  const candidateHost = normalizeDomain(candidate.hostname);
  const rootHost = normalizeDomain(root.hostname);
  return candidateHost === rootHost || candidateHost.endsWith(`.${rootHost}`);
}

export function validateWebsitePageUrls(value: unknown, rootValue?: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Choose at least one website page.");
  }
  if (value.length > MAX_WEBSITE_PAGES_PER_BATCH) {
    throw new Error(`Select no more than ${MAX_WEBSITE_PAGES_PER_BATCH} pages per batch.`);
  }

  const urls = value.map((entry) => normalizeWebsiteUrl(entry).toString());
  const uniqueUrls = new Set(urls);
  if (uniqueUrls.size !== urls.length) {
    throw new Error("The same page URL was added more than once.");
  }

  const root = rootValue === undefined ? new URL(urls[0]) : normalizeWebsiteUrl(rootValue);
  if (urls.some((value) => !isSameWebsiteDomain(new URL(value), root))) {
    throw new Error("Choose page URLs from the same website.");
  }

  return urls;
}

export function parseWebsiteMapLinks(payload: unknown, root: URL): WebsiteMapLink[] {
  if (!payload || typeof payload !== "object" || !("links" in payload)) return [];
  const links = (payload as { links?: unknown }).links;
  if (!Array.isArray(links)) return [];

  const seen = new Set<string>();
  const normalized: WebsiteMapLink[] = [];

  for (const entry of links) {
    const rawUrl = typeof entry === "string"
      ? entry
      : entry && typeof entry === "object" && "url" in entry
        ? (entry as { url?: unknown }).url
        : undefined;
    if (typeof rawUrl !== "string") continue;

    let url: URL;
    try {
      url = normalizeWebsiteUrl(rawUrl);
    } catch {
      continue;
    }
    const normalizedUrl = url.toString();
    if (!isSameWebsiteDomain(url, root) || seen.has(normalizedUrl)) continue;
    seen.add(normalizedUrl);

    const metadata = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    normalized.push({
      url: normalizedUrl,
      title: typeof metadata.title === "string" ? metadata.title.slice(0, 300) : "",
      description: typeof metadata.description === "string" ? metadata.description.slice(0, 500) : "",
    });
  }

  return normalized.slice(0, MAX_WEBSITE_MAP_RESULTS);
}

export function getFirecrawlErrorMessage(status: number): string {
  if (status === 429) return "Too many website requests. Wait a little and try again.";
  return "Website processing is temporarily unavailable. Please try again later.";
}

export function getCustomerSafeWebsiteError(error: string | null): string | null {
  if (!error) return null;
  return /firecrawl|credits?|firecrawl_api_key|quota/i.test(error)
    ? "Website processing is temporarily unavailable. Please try again later."
    : error;
}

export async function readFirecrawlJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Firecrawl returned an invalid response (HTTP ${response.status}).`);
  }
}
