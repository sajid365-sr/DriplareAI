import "server-only";

import OpenAI from "openai";

import { AIError } from "@/lib/ai/ai-error";

/**
 * The one OpenRouter client for the whole platform.
 *
 * ⚠️ Deliberately **lazy**, unlike the eager client in `lib/ai/embeddings.ts`.
 *    `new OpenAI({ apiKey: undefined })` throws while the module is being
 *    imported, so a missing key crashes the route at import time with an
 *    OpenAI-internal message instead of failing the one call that needed it. A
 *    plain 503 "not configured" is far easier to act on than a module-load
 *    stack trace, and it keeps every other feature on the route working.
 */

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

let cachedClient: OpenAI | null = null;

export function getOpenRouterClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AIError("not_configured", "OPENROUTER_API_KEY is not set");
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({
      baseURL: OPENROUTER_BASE_URL,
      apiKey,
      // ⚠️ The SDK retries 429/5xx twice on its own by default. Left enabled it
      //    would stack underneath `lib/domain/ai-retry.ts`, so the real delay
      //    would be several times the budget the caller was promised — and the
      //    call could be killed by the platform timeout with the reason lost.
      //    Retry policy belongs to the gateway, in one place, where it is
      //    measured and logged.
      maxRetries: 0,
    });
  }

  return cachedClient;
}

/** Test seam: lets a test inject a client without touching the environment. */
export function __setOpenRouterClientForTests(client: OpenAI | null) {
  cachedClient = client;
}
