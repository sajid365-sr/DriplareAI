import { describe, expect, it } from "vitest";

import {
  DEFAULT_WIDGET_BRAND,
  buildWidgetApiPath,
  buildWidgetEmbedCode,
  buildWidgetScriptPath,
  isSafeHost,
  parseWidgetKey,
  resolveRequestOrigin,
  sanitizeBrandColor,
} from "./widget-key";

/** A cuid, which is what `Integration.integrationId` actually holds. */
const KEY = "clx9f2k3b0000abcd1234efgh";

describe("parseWidgetKey", () => {
  it("accepts a bare key", () => {
    expect(parseWidgetKey(KEY)).toBe(KEY);
  });

  it("accepts the .js spelling the embed code uses", () => {
    // Both spellings must resolve, or a merchant who trims the extension while
    // pasting gets a widget that silently does nothing.
    expect(parseWidgetKey(`${KEY}.js`)).toBe(KEY);
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseWidgetKey(`  ${KEY}  `)).toBe(KEY);
  });

  it.each([
    ["../../etc/passwd", "path traversal"],
    ["", "empty segment"],
    ["short", "below the length floor"],
    ["a".repeat(65), "above the length ceiling"],
    ["clx9f2k3b0000abcd1234efgH", "uppercase is not a cuid"],
    ["clx9f2k3b0000abcd-1234efg", "hyphen is not a cuid character"],
    ["clx9f2k3b0000abcd1234efg%00", "percent encoding"],
  ])("rejects %p (%s)", (input) => {
    expect(parseWidgetKey(input)).toBeNull();
  });

  it("strips only the suffix, never a character of the key", () => {
    // A key that merely contains ".js" must survive intact.
    expect(parseWidgetKey("clxjs0000abcd1234efgh")).toBe("clxjs0000abcd1234efgh");
  });
});

describe("path builders", () => {
  it("builds the script path the matcher will see", () => {
    expect(buildWidgetScriptPath(KEY)).toBe(`/widget/${KEY}.js`);
  });

  it("builds the api path the widget posts to", () => {
    expect(buildWidgetApiPath(KEY)).toBe(`/api/widget/${KEY}`);
  });

  it("accepts a script path back as a key", () => {
    // Round-tripping is the property that keeps the embed tag and the route in
    // agreement; a change to either constant alone would break it.
    const path = buildWidgetScriptPath(KEY);
    expect(parseWidgetKey(path.slice("/widget/".length))).toBe(KEY);
  });
});

describe("buildWidgetEmbedCode", () => {
  it("points at the origin it was given", () => {
    expect(buildWidgetEmbedCode("https://app.driplare.com", KEY)).toBe(
      `<script src="https://app.driplare.com/widget/${KEY}.js" async></script>`
    );
  });

  it("does not double the slash when the origin ends in one", () => {
    expect(buildWidgetEmbedCode("https://app.driplare.com/", KEY)).toContain(
      `com/widget/${KEY}.js`
    );
  });

  it("keeps the tag loadable without blocking the host page", () => {
    // The merchant's own site performance is not ours to spend.
    expect(buildWidgetEmbedCode("https://app.driplare.com", KEY)).toContain("async");
  });
});

describe("isSafeHost", () => {
  it.each([
    "app.driplare.com",
    "driplare-ai.vercel.app",
    "localhost:3000",
    "192.168.1.10",
    "192.168.1.10:8080",
    "[::1]:3000",
  ])("accepts %s", (host) => {
    expect(isSafeHost(host)).toBe(true);
  });

  it.each([
    "evil.com/x",
    "evil.com?x=1",
    "evil.com#frag",
    "evil.com\\@good.com",
    "a b.com",
    "",
    "<script>",
  ])("refuses %p — the value is written into the served script", (host) => {
    expect(isSafeHost(host)).toBe(false);
  });
});

describe("resolveRequestOrigin", () => {
  it("prefers the forwarded host over the proxy's own", () => {
    // Behind Vercel the app sees the proxy's host; the browser saw the
    // merchant's domain. Taking the wrong one bakes an unreachable address into
    // the widget's API base.
    const headers = new Headers({
      host: "internal-abc123:3000",
      "x-forwarded-host": "app.driplare.com",
      "x-forwarded-proto": "https",
    });

    expect(resolveRequestOrigin(headers)).toBe("https://app.driplare.com");
  });

  it("takes the first entry of a comma-separated chain", () => {
    const headers = new Headers({
      "x-forwarded-host": "app.driplare.com, edge.internal",
      "x-forwarded-proto": "https, http",
    });

    expect(resolveRequestOrigin(headers)).toBe("https://app.driplare.com");
  });

  it("refuses a host carrying a path", () => {
    const headers = new Headers({ host: "evil.com/x", "x-forwarded-proto": "https" });

    expect(resolveRequestOrigin(headers)).toBeNull();
  });

  it("returns null when no host is present", () => {
    expect(resolveRequestOrigin(new Headers())).toBeNull();
  });

  it("defaults to https away from localhost", () => {
    expect(resolveRequestOrigin(new Headers({ host: "app.driplare.com" }))).toBe(
      "https://app.driplare.com"
    );
  });

  it("defaults to http on a local host, where https is not served", () => {
    expect(resolveRequestOrigin(new Headers({ host: "localhost:3000" }))).toBe(
      "http://localhost:3000"
    );
  });

  it("ignores a proto header that is neither http nor https", () => {
    // The value is interpolated into a URL, so an unexpected scheme is dropped
    // rather than trusted.
    const headers = new Headers({ host: "app.driplare.com", "x-forwarded-proto": "javascript" });

    expect(resolveRequestOrigin(headers)).toBe("https://app.driplare.com");
  });
});

describe("sanitizeBrandColor", () => {
  it.each(["#6d28d9", "#FFF", "#a1b2c3"])("accepts the hex literal %s", (color) => {
    expect(sanitizeBrandColor(color)).toBe(color);
  });

  it("trims before validating", () => {
    expect(sanitizeBrandColor("  #6d28d9  ")).toBe("#6d28d9");
  });

  it.each([
    ["red", "a named colour is not a hex literal"],
    ["#12345", "not 3 or 6 digits"],
    ["#6d28d9; } body { display: none } .x {", "the value lands inside a <style> block"],
    ["", "empty"],
    [null, "not a string"],
    [42, "not a string"],
  ])("falls back for %p (%s)", (input, _why) => {
    // This is not cosmetic: the value is written into CSS inside a shadow root,
    // so a non-hex value is markup injection into a page we do not own.
    expect(sanitizeBrandColor(input)).toBe(DEFAULT_WIDGET_BRAND);
  });

  it("falls back to the same violet the dashboard uses", () => {
    // `Chatbot.avatarColor`'s own default, so a widget with no colour of its own
    // still matches the product it was configured in.
    expect(DEFAULT_WIDGET_BRAND).toBe("#6d28d9");
  });
});
