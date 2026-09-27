"use client";

/**
 * Auto-captured technical context.
 * ─────────────────────────────────────────────────────────────────────────────
 * A bug report without the environment it happened in usually costs an admin a
 * round trip. These fields are collected for free at submit time.
 *
 * Privacy: the URL is reduced to its pathname. Query strings routinely carry
 * tokens, workspace ids and email addresses, and none of that belongs in a
 * support ticket.
 */

export type ClientContext = {
  browser: string;
  os: string;
  viewport: string;
  screen: string;
  locale: string;
  theme: string;
  appVersion: string;
};

/** Reads the current theme from the `class` that `next-themes` toggles on <html>. */
function readTheme(): string {
  if (typeof document === "undefined") return "unknown";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Minimal UA parsing — enough to tell an admin which engine to reproduce in. */
function parseBrowser(ua: string): string {
  const checks: [string, RegExp][] = [
    ["Edge", /Edg\/([\d.]+)/],
    ["Opera", /OPR\/([\d.]+)/],
    ["Chrome", /Chrome\/([\d.]+)/],
    ["Firefox", /Firefox\/([\d.]+)/],
    ["Safari", /Version\/([\d.]+).*Safari/],
  ];

  for (const [name, pattern] of checks) {
    const match = ua.match(pattern);
    if (match) return `${name} ${match[1].split(".")[0]}`;
  }

  return "Unknown browser";
}

function parseOs(ua: string): string {
  if (/Windows NT 10/.test(ua)) return "Windows 10/11";
  if (/Windows/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown OS";
}

/** Collects everything the feedback form attaches automatically. */
export function collectClientContext(): ClientContext {
  if (typeof window === "undefined") {
    return {
      browser: "unknown",
      os: "unknown",
      viewport: "unknown",
      screen: "unknown",
      locale: "unknown",
      theme: "unknown",
      appVersion: "unknown",
    };
  }

  const ua = navigator.userAgent;

  return {
    browser: parseBrowser(ua),
    os: parseOs(ua),
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    screen: `${window.screen.width}×${window.screen.height}`,
    locale: navigator.language,
    theme: readTheme(),
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
  };
}

/** The current page, stripped of its query string and hash. */
export function currentPagePath(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname;
}
