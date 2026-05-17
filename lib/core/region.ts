/**
 * Region detection & configuration for Driplare.
 *
 * Bangladesh (bd)  → Bangla default, BDT, Uddoktapay
 * Global  (global) → English only,  USD, Stripe
 *
 * Region is detected via IP geo headers in middleware and
 * persisted in a cookie so both server and client can read it.
 */

export type Region = "bd" | "global";

export const REGION_COOKIE = "driplare_region";

export interface RegionConfig {
  defaultLang: string;
  allowLangSwitch: boolean;
  currency: "BDT" | "USD";
  currencySymbol: string;
  paymentGateway: "uddoktapay" | "stripe";
}

export const REGION_CONFIGS: Record<Region, RegionConfig> = {
  bd: {
    defaultLang: "bn",
    allowLangSwitch: true,
    currency: "BDT",
    currencySymbol: "৳",
    paymentGateway: "uddoktapay",
  },
  global: {
    defaultLang: "en",
    allowLangSwitch: false,
    currency: "USD",
    currencySymbol: "$",
    paymentGateway: "stripe",
  },
};

/** Read region from document cookie (client-side). */
export function getRegionFromCookie(): Region {
  if (typeof document === "undefined") return "bd"; // SSR fallback
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${REGION_COOKIE}=([^;]*)`)
  );
  const value = match?.[1];
  return value === "global" ? "global" : "bd";
}

/** Get full config for a region. */
export function getRegionConfig(region?: Region): RegionConfig {
  return REGION_CONFIGS[region ?? "bd"];
}

/**
 * Detect country code from request headers.
 * Supports Vercel, Cloudflare, and common reverse-proxy headers.
 * Returns ISO-3166 two-letter code or null.
 */
export function detectCountryFromHeaders(
  headers: Headers
): string | null {
  // Vercel Edge
  const vercel = headers.get("x-vercel-ip-country");
  if (vercel) return vercel;

  // Cloudflare (useful when behind CF on Hostinger VPS)
  const cf = headers.get("cf-ipcountry");
  if (cf) return cf;

  // Generic forwarded country (some proxies)
  const generic = headers.get("x-country-code");
  if (generic) return generic;

  return null;
}
