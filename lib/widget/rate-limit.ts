/**
 * Rate limiting for the public widget endpoint.
 *
 * ## Why this exists
 *
 * Every other chat entry point in the product is behind Clerk, so the caller is
 * a known, accountable merchant. `POST /api/widget/<key>` is the first route a
 * stranger can call, and each accepted call spends a real merchant's credits on
 * a real LLM completion. Without a ceiling, one script with a `for` loop can
 * drain a merchant's balance overnight — and the merchant would have no way to
 * tell that from genuine traffic.
 *
 * ## What it deliberately is not
 *
 * This is a **best-effort** limiter, and the honesty matters more than the
 * mechanism:
 *
 *   - It keeps its counters **in module memory**. Vercel runs many function
 *     instances and recycles them freely, so the effective limit is
 *     `configured × live instances`, and a cold start forgets everything.
 *   - It is therefore **not** a billing control. The hard floor is the
 *     merchant's own credit balance: `resolveQuotaAnswer()` refuses the call
 *     once the balance is gone, and that check is durable and shared.
 *   - A correct distributed limiter needs shared state (Redis/Upstash), which
 *     this project has not adopted. Adding one is a deployment decision, not a
 *     widget one.
 *
 * What it *does* buy, cheaply and with no new infrastructure: a single abusive
 * visitor cannot hold one warm instance in a tight loop, and a stuck client
 * cannot re-post the same message hundreds of times per minute. That is the
 * realistic accident, and it is the case this covers.
 *
 * ⚠️ Do not read this as a security boundary. It is a spill guard in front of
 *    one — the balance check — that is already there.
 */

export interface RateLimitRule {
  /** Requests permitted inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Seconds until the oldest hit falls out of the window. `0` when allowed. */
  retryAfterSeconds: number;
}

/**
 * Per-visitor rules, keyed by client IP.
 *
 * Sized for a person: a shopper typing quickly sends one message every few
 * seconds at most, so 20/minute is far above real use and far below a flood.
 */
export const WIDGET_IP_RULE: RateLimitRule = { limit: 20, windowMs: 60_000 };

/**
 * Per-conversation rules, keyed by the widget's session id.
 *
 * This is the one that survives an attacker changing IP, because the session id
 * is minted by the widget and not by the caller... except that the caller *can*
 * mint new ones at will. It is kept because it is the rule that actually binds
 * an ordinary visitor, and because a client that reuses one session — the
 * common case, and the case of a naive script — is stopped by it.
 */
export const WIDGET_SESSION_RULE: RateLimitRule = { limit: 30, windowMs: 10 * 60_000 };

/**
 * Upper bound on tracked keys.
 *
 * A Map that only ever grows is a memory leak with a hostile caller driving it,
 * so once the cap is hit the oldest-seen keys are dropped. Evicting the oldest
 * is right here: a key we have not seen in a long time is the one least likely
 * to still be an active conversation.
 */
const MAX_TRACKED_KEYS = 10_000;

const hits = new Map<string, number[]>();

/** Monotonic tiebreaker for eviction — insertion order alone is not enough once keys are refreshed. */
const lastSeen = new Map<string, number>();

function evictIfNeeded() {
  if (hits.size <= MAX_TRACKED_KEYS) return;

  const ordered = [...lastSeen.entries()].sort((a, b) => a[1] - b[1]);
  const dropCount = hits.size - MAX_TRACKED_KEYS;

  for (let i = 0; i < dropCount && i < ordered.length; i += 1) {
    const key = ordered[i][0];
    hits.delete(key);
    lastSeen.delete(key);
  }
}

/**
 * Records one hit and reports whether it is allowed.
 *
 * A **sliding window**, not a fixed one: fixed windows let a caller send
 * `limit` requests at the end of one window and `limit` more at the start of
 * the next, doubling the real rate at exactly the boundary an attacker would
 * aim for. Keeping the timestamps costs a little memory and removes that.
 *
 * `now` is a parameter so the behaviour is testable without waiting on a clock.
 */
export function checkRateLimit(
  key: string,
  rule: RateLimitRule,
  now: number = Date.now()
): RateLimitVerdict {
  const windowStart = now - rule.windowMs;
  const recent = (hits.get(key) ?? []).filter((at) => at > windowStart);

  if (recent.length >= rule.limit) {
    // The window frees up when its oldest surviving hit expires.
    const retryAfterMs = recent[0] + rule.windowMs - now;
    hits.set(key, recent);
    lastSeen.set(key, now);

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  recent.push(now);
  hits.set(key, recent);
  lastSeen.set(key, now);
  evictIfNeeded();

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * The client's address, as far as we can trust it.
 *
 * `x-forwarded-for` is a comma-separated chain and is client-appendable, so only
 * the **first** entry is meaningful — the one the nearest proxy wrote. It is
 * still spoofable by a direct caller, which is exactly why the IP rule is the
 * weaker of the two and the balance check is the real ceiling.
 */
export function clientAddress(headers: Headers): string {
  const forwarded = (headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (forwarded) return forwarded;

  return (headers.get("x-real-ip") ?? "").trim() || "unknown";
}

/** Test seam — module state must not leak between cases. */
export function resetWidgetRateLimits() {
  hits.clear();
  lastSeen.clear();
}
