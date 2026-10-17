import { beforeEach, describe, expect, it } from "vitest";

import {
  WIDGET_IP_RULE,
  checkRateLimit,
  clientAddress,
  resetWidgetRateLimits,
} from "./rate-limit";

beforeEach(() => {
  resetWidgetRateLimits();
});

const RULE = { limit: 3, windowMs: 1_000 };

describe("checkRateLimit", () => {
  it("allows up to the limit and refuses the one after it", () => {
    expect(checkRateLimit("k", RULE, 0).allowed).toBe(true);
    expect(checkRateLimit("k", RULE, 1).allowed).toBe(true);
    expect(checkRateLimit("k", RULE, 2).allowed).toBe(true);
    expect(checkRateLimit("k", RULE, 3).allowed).toBe(false);
  });

  it("reports how long the caller should wait", () => {
    for (const at of [0, 1, 2]) checkRateLimit("k", RULE, at);

    // The window frees when its oldest surviving hit expires — 0 + 1000.
    expect(checkRateLimit("k", RULE, 3).retryAfterSeconds).toBe(1);
    expect(checkRateLimit("k", RULE, 900).retryAfterSeconds).toBe(1);
  });

  it("never reports a zero wait, which would invite an immediate retry", () => {
    for (const at of [0, 1, 2]) checkRateLimit("k", RULE, at);

    expect(checkRateLimit("k", RULE, 999).retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("slides rather than resetting on a boundary", () => {
    // A fixed window would let a caller send `limit` at the end of one window
    // and `limit` more at the start of the next — double the intended rate at
    // exactly the boundary an attacker would aim for.
    for (const at of [900, 950, 999]) checkRateLimit("k", RULE, at);

    // A fresh window has begun, but the earlier hits are still inside it.
    expect(checkRateLimit("k", RULE, 1_100).allowed).toBe(false);

    // Only once every one of them has aged out does the caller recover.
    expect(checkRateLimit("k", RULE, 2_000).allowed).toBe(true);
  });

  it("keeps keys independent", () => {
    for (const at of [0, 1, 2]) checkRateLimit("a", RULE, at);

    expect(checkRateLimit("b", RULE, 3).allowed).toBe(true);
  });

  it("does not record a refused request as a hit", () => {
    // Recording it would let a persistent caller extend their own lockout
    // forever — the window would never drain.
    for (const at of [0, 1, 2]) checkRateLimit("k", RULE, at);
    checkRateLimit("k", RULE, 3);
    checkRateLimit("k", RULE, 4);

    expect(checkRateLimit("k", RULE, 1_000).allowed).toBe(true);
  });

  it("defaults its clock to now, so callers need not pass one", () => {
    expect(checkRateLimit("k", RULE).allowed).toBe(true);
  });

  it("ships a per-visitor rule that is generous enough for a real shopper", () => {
    // One message every three seconds for a minute — far above how a person
    // types, far below a flood.
    expect(WIDGET_IP_RULE.limit).toBeGreaterThanOrEqual(20);
    expect(WIDGET_IP_RULE.windowMs).toBe(60_000);
  });
});

describe("clientAddress", () => {
  it("takes the first entry of the forwarded chain", () => {
    // The rest of the chain is appended by whoever is calling and is not ours
    // to trust; the first entry is what the nearest proxy wrote.
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" });

    expect(clientAddress(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(clientAddress(new Headers({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("returns a shared bucket rather than throwing when nothing identifies the caller", () => {
    // Callers with no address share one bucket. That is deliberately
    // conservative — it can only make the limit *stricter* than reality.
    expect(clientAddress(new Headers())).toBe("unknown");
  });
});
