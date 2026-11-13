import { describe, expect, it } from "vitest";

import {
  assertPublicWebsiteUrl,
  canonicalizeWebsitePageUrl,
  getCustomerSafeWebsiteError,
  isSameWebsiteDomain,
  formatWebsiteMarkdown,
  normalizeWebsiteUrl,
  parseWebsiteMapLinks,
  validateWebsitePageUrls,
} from "./website-ingestion";
import { isWebsitePageSelectable } from "./website-ingestion-constants";

describe("website ingestion URL rules", () => {
  it("cleans scraped markdown while preserving headings, paragraphs, and lists", () => {
    expect(formatWebsiteMarkdown(
      "## About us\r\n\r\nRead [our story](https://example.com/story).\r\n\r\n- First item\r\n- Second item\r\n\r\n![Logo](https://example.com/logo.png)"
    )).toBe("## About us\n\nRead our story.\n\n- First item\n- Second item");
  });

  it("only allows not-yet-imported or failed pages to be selected", () => {
    expect(isWebsitePageSelectable("pending")).toBe(true);
    expect(isWebsitePageSelectable("failed")).toBe(true);
    expect(isWebsitePageSelectable("crawling")).toBe(false);
    expect(isWebsitePageSelectable("crawled")).toBe(false);
  });

  it("keeps internal scraping provider details out of customer-facing errors", () => {
    expect(getCustomerSafeWebsiteError("Firecrawl credits are unavailable."))
      .toBe("Website processing is temporarily unavailable. Please try again later.");
    expect(getCustomerSafeWebsiteError("This page could not be added."))
      .toBe("This page could not be added.");
    expect(getCustomerSafeWebsiteError(null)).toBeNull();
  });

  it("normalizes public HTTP URLs and removes fragments", () => {
    expect(normalizeWebsiteUrl(" https://Example.com/about#team ").toString())
      .toBe("https://example.com/about");
  });

  it("matches website page URLs with or without a trailing slash", () => {
    expect(canonicalizeWebsitePageUrl("https://example.com/"))
      .toBe("https://example.com");
    expect(canonicalizeWebsitePageUrl("https://example.com/about/"))
      .toBe("https://example.com/about");
  });

  it("rejects unsupported protocols and embedded credentials", () => {
    expect(() => normalizeWebsiteUrl("file:///etc/passwd")).toThrow("Only HTTP and HTTPS");
    expect(() => normalizeWebsiteUrl("https://user:pass@example.com")).toThrow("without login credentials");
  });

  it("blocks private IPs and local hostnames", async () => {
    await expect(assertPublicWebsiteUrl("http://127.0.0.1")).rejects.toThrow("Private or local");
    await expect(assertPublicWebsiteUrl("http://10.1.2.3")).rejects.toThrow("Private or local");
    await expect(assertPublicWebsiteUrl("http://service.local")).rejects.toThrow("Private or local");
  });

  it("allows only same-site and subdomain page URLs in one batch", () => {
    expect(validateWebsitePageUrls([
      "https://shop.example.com/about",
      "https://docs.example.com/help",
    ], "https://example.com")).toEqual([
      "https://shop.example.com/about",
      "https://docs.example.com/help",
    ]);

    expect(() => validateWebsitePageUrls([
      "https://example.com/about",
      "https://other.example.net/page",
    ])).toThrow("same website");
  });

  it("rejects repeated URLs and batches above the five-page cap", () => {
    expect(() => validateWebsitePageUrls([
      "https://example.com/page",
      "https://example.com/page",
    ])).toThrow("more than once");
    expect(() => validateWebsitePageUrls(Array.from({ length: 6 }, (_, index) =>
      `https://example.com/page-${index}`
    ))).toThrow("no more than 5");
  });

  it("filters discovered links to the requested site's domain and deduplicates them", () => {
    const root = new URL("https://www.example.com");
    const links = parseWebsiteMapLinks({
      links: [
        { url: "https://example.com/about", title: "About" },
        { url: "https://docs.example.com/help", title: "Help" },
        { url: "https://outside.test/private", title: "Outside" },
        { url: "javascript:alert(1)", title: "Invalid" },
        "https://example.com/about",
      ],
    }, root);

    expect(links.map((link) => link.url)).toEqual([
      "https://example.com/about",
      "https://docs.example.com/help",
    ]);
  });

  it("recognizes subdomains but not lookalike domains", () => {
    const root = new URL("https://example.com");
    expect(isSameWebsiteDomain(new URL("https://docs.example.com"), root)).toBe(true);
    expect(isSameWebsiteDomain(new URL("https://example.com.attacker.test"), root)).toBe(false);
  });
});
