import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/core/db";
import { timingSafeEqualString } from "@/lib/core/timing-safe";
import { checkRateLimit, clientAddress, type RateLimitRule } from "@/lib/widget/rate-limit";

/**
 * POST /api/internal/integration-secrets
 *
 * Returns one integration's **decrypted** config to n8n.
 *
 * ── Why this endpoint exists ─────────────────────────────────────────────────
 * `Integration.config` is encrypted at rest (TASK-08), and only the app holds
 * `INTEGRATION_ENCRYPTION_KEY`. The channel adapters used to decrypt the row
 * themselves in a Code node — which needs both `require('crypto')` and that key
 * inside n8n. Neither can be supplied on a hosted Community instance: n8n's task
 * runner blocks built-in modules by default, and environment variables cannot be
 * added without container access. A Code node can never read an n8n credential,
 * so there was no second way to hand it the key.
 *
 * This route moves that one step to the side that already has the key. n8n calls
 * it with its existing `x-n8n-secret` header credential — no new secret, no new
 * environment variable on either side.
 *
 * ── Auth ─────────────────────────────────────────────────────────────────────
 * `x-n8n-secret` = `N8N_CALLBACK_SECRET`, the same shared secret every other
 * `/api/internal/*` route uses (`ai-quota`, `ai-usage`, `orders`). Constant-time
 * comparison, and the route **fails shut** when the secret is unset: a missing
 * env var turning into an open door that hands out page access tokens would be
 * far worse than a workflow that cannot start.
 *
 * ── What is never returned ───────────────────────────────────────────────────
 * Config for an integration that is not connected. A revoked channel keeps its
 * row, and its tokens must stop being usable the moment `connected` flips —
 * `Guard Active` stops the workflow on that same flag, but the response itself
 * withholds the secrets so a stale workflow copy cannot leak them either.
 *
 * The response is `no-store`, and nothing about the payload is logged.
 */

const bodySchema = z.object({
  /** `Integration.integrationId` — the cuid the adapter's SQL already selected. */
  integrationId: z.string().min(1).max(200),
});

/**
 * Best-effort ceiling per caller address.
 *
 * The shared secret is long and random, so guessing it is not the realistic
 * attack — a leaked secret is, and no request limit helps with that. This exists
 * so a misconfigured workflow retrying in a loop cannot hammer the database.
 *
 * The ceiling is deliberately loose: every adapter on one n8n instance calls
 * from the same address, so this bucket is shared across all channels and
 * merchants. A realistic chat platform answers several messages per second, and
 * dropping a customer's message because a busy hour passed 120/minute would be
 * far worse than the load. A retry loop, by contrast, produces thousands per
 * minute, which this still stops.
 */
const RATE_RULE: RateLimitRule = { limit: 600, windowMs: 60_000 };

/** Same header as every other `/api/internal/*` route. */
const SECRET_HEADER = "x-n8n-secret";

export async function POST(req: Request) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const expectedSecret = process.env.N8N_CALLBACK_SECRET;
  if (!expectedSecret) {
    console.error("[INTEGRATION_SECRETS] N8N_CALLBACK_SECRET is not set — endpoint closed");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (!timingSafeEqualString(req.headers.get(SECRET_HEADER), expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const verdict = checkRateLimit(`integration-secrets:${clientAddress(req.headers)}`, RATE_RULE);
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(verdict.retryAfterSeconds) } }
    );
  }

  // ── 2. Validate ────────────────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // ── 3. Read the integration ────────────────────────────────────────────────
  // The Prisma client carries `integrationEncryptionExtension`, so `config`
  // arrives already decrypted. This is the whole point of the route: the same
  // read the adapters could not perform on their side.
  const integration = await db.integration.findUnique({
    where: { integrationId: parsed.data.integrationId },
    select: {
      integrationId: true,
      chatbotId: true,
      connected: true,
      status: true,
      config: true,
    },
  });

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  const base = {
    integrationId: integration.integrationId,
    chatbotId: integration.chatbotId,
    connected: integration.connected,
    status: integration.status,
  };

  // ── 4. Answer ──────────────────────────────────────────────────────────────
  if (!integration.connected) {
    // No config at all — see the header. `Guard Active` reads `connected`.
    return noStore(NextResponse.json(base));
  }

  const config =
    integration.config !== null &&
    typeof integration.config === "object" &&
    !Array.isArray(integration.config)
      ? (integration.config as Record<string, unknown>)
      : {};

  // Flat on purpose: the adapters reference `$('Fetch Integration Secrets')
  // .item.json.pageAccessToken` and friends directly, exactly as they addressed
  // the decrypt node's output before. Keeping the shape means the HTTP Request
  // node can replace the old Code node without touching a single downstream
  // expression beyond the node name.
  return noStore(NextResponse.json({ ...base, ...config }));
}

/** Tokens must never sit in a proxy or browser cache. */
function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
