"use client";

import type { TFunction } from "i18next";

/**
 * Picks the message a merchant should read for a failed AI call.
 *
 * The routes answer with `{ error, code }`, where `code` is one of the gateway's
 * stable identifiers (`quota_exceeded`, `rate_limited`, …). The code is what
 * gets translated, so the same failure reads naturally in Bengali and English
 * without the server having to guess which language the merchant is using.
 *
 * Order of preference:
 *   ১. the translated message for `code`
 *   ২. the server's English `error` text — an unmapped or unknown code
 *   ৩. the caller's own generic fallback
 */
export function aiErrorMessage(data: unknown, t: TFunction, fallback: string): string {
  const body = (data ?? {}) as { code?: unknown; error?: unknown };

  if (typeof body.code === "string" && body.code) {
    // `defaultValue: ""` makes a missing translation fall through to the server
    // text instead of rendering the raw key in front of the merchant.
    const translated = t(`aiErrors:${body.code}`, { defaultValue: "" });
    if (typeof translated === "string" && translated) return translated;
  }

  if (typeof body.error === "string" && body.error) return body.error;

  return fallback;
}
