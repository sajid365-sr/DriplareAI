import { describe, expect, it } from "vitest";

import { buildAttemptOrder, buildFallbackChain, type FallbackCandidate } from "./ai-fallback";

const PRIMARY = "google/gemini-2.5-flash";

/** A catalogue shaped like the admin panel's: several vendors, three tiers. */
const CATALOGUE: FallbackCandidate[] = [
  { modelId: PRIMARY, tier: "economy", providerName: "Google" },
  { modelId: "google/gemini-2.0-flash", tier: "economy", providerName: "Google" },
  { modelId: "openai/gpt-4o-mini", tier: "economy", providerName: "OpenAI" },
  { modelId: "anthropic/claude-3.5-haiku", tier: "economy", providerName: "Anthropic" },
  { modelId: "meta-llama/llama-3.3-70b-instruct", tier: "standard", providerName: "Meta" },
  { modelId: "openai/gpt-4o", tier: "premium", providerName: "OpenAI" },
];

function chain(candidates: FallbackCandidate[], primaryTier: "economy" | "standard" | "premium" = "economy") {
  return buildFallbackChain({ primaryModelId: PRIMARY, primaryTier, candidates });
}

describe("buildFallbackChain", () => {
  it("never repeats the model that just failed", () => {
    expect(chain(CATALOGUE)).not.toContain(PRIMARY);
  });

  it("never falls back to a more expensive model", () => {
    // An economy primary must exclude both the standard and the premium
    // entries — a silent upgrade would drain the merchant's balance faster
    // than the dashboard promised.
    expect(chain(CATALOGUE)).not.toContain("meta-llama/llama-3.3-70b-instruct");
    expect(chain(CATALOGUE)).not.toContain("openai/gpt-4o");
  });

  it("spreads the chain across providers so one vendor outage cannot take the whole chain", () => {
    const result = chain(CATALOGUE);

    expect(result).toHaveLength(2);
    // Both picks are cheaper-or-equal to the primary and none is the primary's
    // own vendor, which is what makes them useful when Google is the problem.
    expect(result).not.toContain("google/gemini-2.0-flash");
  });

  it("prefers a different provider over a sibling model from the same one", () => {
    const [first] = chain(CATALOGUE);

    expect(first).not.toBe("google/gemini-2.0-flash");
  });

  it("prefers the same tier over a cheaper one", () => {
    const candidates: FallbackCandidate[] = [
      { modelId: PRIMARY, tier: "standard", providerName: "Google" },
      { modelId: "anthropic/claude-3.5-haiku", tier: "economy", providerName: "Anthropic" },
      { modelId: "openai/gpt-4o", tier: "standard", providerName: "OpenAI" },
    ];

    const result = buildFallbackChain({
      primaryModelId: PRIMARY,
      primaryTier: "standard",
      candidates,
      maxFallbacks: 1,
    });

    expect(result).toEqual(["openai/gpt-4o"]);
  });

  it("is deterministic — the same catalogue always yields the same order", () => {
    // Shuffling the input must not change the answer, or an incident could not
    // be reproduced from the logs.
    const reversed = [...CATALOGUE].reverse();

    expect(chain(reversed)).toEqual(chain(CATALOGUE));
  });

  it("honours maxFallbacks", () => {
    expect(
      buildFallbackChain({ primaryModelId: PRIMARY, primaryTier: "economy", candidates: CATALOGUE, maxFallbacks: 1 })
    ).toHaveLength(1);
    expect(
      buildFallbackChain({ primaryModelId: PRIMARY, primaryTier: "economy", candidates: CATALOGUE, maxFallbacks: 0 })
    ).toEqual([]);
  });

  it("still fills the chain when only one vendor is enabled", () => {
    // The realistic single-vendor setup: a same-vendor retry is worth more than
    // no fallback at all.
    const singleVendor: FallbackCandidate[] = [
      { modelId: PRIMARY, tier: "economy", providerName: "Google" },
      { modelId: "google/gemini-2.0-flash", tier: "economy", providerName: "Google" },
    ];

    expect(chain(singleVendor)).toEqual(["google/gemini-2.0-flash"]);
  });

  it("returns an empty chain when the catalogue has nothing else", () => {
    expect(chain([{ modelId: PRIMARY, tier: "economy", providerName: "Google" }])).toEqual([]);
  });

  it("de-duplicates a catalogue that lists the same model twice", () => {
    const duplicated: FallbackCandidate[] = [
      { modelId: "openai/gpt-4o-mini", tier: "economy", providerName: "OpenAI" },
      { modelId: "openai/gpt-4o-mini", tier: "economy", providerName: "OpenAI" },
    ];

    expect(chain(duplicated)).toEqual(["openai/gpt-4o-mini"]);
  });

  it("applies every rule even when the primary is missing from the catalogue", () => {
    const others: FallbackCandidate[] = [
      { modelId: "openai/gpt-4o-mini", tier: "economy", providerName: "OpenAI" },
      { modelId: "openai/gpt-4o", tier: "premium", providerName: "OpenAI" },
    ];

    // No tier for the primary means the cost ceiling cannot be checked, but the
    // cost *ordering* still holds: the cheap one comes first.
    const result = buildFallbackChain({ primaryModelId: "retired/model", candidates: others });

    expect(result[0]).toBe("openai/gpt-4o-mini");
  });

  it("works with candidates that carry no provider name", () => {
    const unnamed: FallbackCandidate[] = [
      { modelId: "openai/gpt-4o-mini", tier: "economy" },
      { modelId: "anthropic/claude-3.5-haiku", tier: "economy" },
    ];

    expect(chain(unnamed)).toHaveLength(2);
  });
});

describe("buildAttemptOrder", () => {
  it("puts the primary first and the chain after it", () => {
    const order = buildAttemptOrder({
      primaryModelId: PRIMARY,
      primaryTier: "economy",
      candidates: CATALOGUE,
      allowsFallback: true,
    });

    expect(order[0]).toBe(PRIMARY);
    expect(order.length).toBeGreaterThan(1);
  });

  it("tries the primary alone when the task forbids fallback", () => {
    const order = buildAttemptOrder({
      primaryModelId: "google/gemini-embedding-001",
      candidates: CATALOGUE,
      allowsFallback: false,
    });

    expect(order).toEqual(["google/gemini-embedding-001"]);
  });
});
