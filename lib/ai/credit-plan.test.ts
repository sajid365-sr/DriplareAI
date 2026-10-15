import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Test doubles ──────────────────────────────────────────────────────────────
//
// Three imports are replaced, and none of the substitutions weaken the tests:
//
//   - `server-only` throws on import outside a Server Component by design, and
//     nothing here renders. Stubbed, as Vitest's own docs suggest.
//   - `@/lib/core/db` is stubbed so the *write* can be inspected. What matters
//     about `applyDerivation` is not that Prisma stores a row — it is exactly
//     which parts of the row it changes, and which it leaves alone. That is only
//     observable by reading the arguments, and reading them is the whole point:
//     this is the code that decides what a merchant is charged.
//   - `@/lib/ai/model-pricing` is stubbed per model, because the real one reads
//     a live OpenRouter snapshot and a test cannot depend on today's prices.
//
// `resolveReplyCredits` — the function billing actually uses — is deliberately
// not involved anywhere in this file. Nothing here changes what a reply costs
// until an admin presses Apply.

vi.mock("server-only", () => ({}));

const CATALOGUE_KEY = "ai_credit_rules";
const DERIVATION_KEY = "ai_credit_derivation";

const { findUnique, update, upsert, transaction, resolveModelPrice, getCreditRules } = vi.hoisted(
  () => ({
    findUnique: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    transaction: vi.fn(),
    resolveModelPrice: vi.fn(),
    getCreditRules: vi.fn(),
  })
);

vi.mock("@/lib/core/db", () => ({
  db: {
    platformSetting: { findUnique, update, upsert },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/ai/model-pricing", () => ({ resolveModelPrice }));
vi.mock("@/lib/ai/credit-resolver", () => ({ getCreditRules }));

import { applyDerivation, buildDerivationPreview } from "./credit-plan";

// ── Fixtures ──────────────────────────────────────────────────────────────────
//
// Four models chosen so each verdict is represented exactly once. Prices are the
// real shape `resolveModelPrice()` returns ($ per 1M tokens); the rate is 126 and
// the target ৳0.02, both the live values from 2026-10-14.

const RATE = 126;
const FALLBACK_PRICE = { promptPrice: 0.15, completionPrice: 0.6 };

/** $0.1/$0.32 per 1M → ৳0.0625 a reply → 4 credits. */
const CHEAP = { promptPrice: 0.1, completionPrice: 0.32 };
/** $2.5/$10 per 1M → ৳1.638 a reply → 82 credits. */
const DEAR = { promptPrice: 2.5, completionPrice: 10 };

const PRICES: Record<
  string,
  { promptPrice: number; completionPrice: number; source: "openrouter" | "fallback" }
> = {
  "cheap/model": { ...CHEAP, source: "openrouter" },
  "dear/model": { ...DEAR, source: "openrouter" },
  // The defect this panel exists to avoid: no OpenRouter quote, so
  // `model-pricing.ts` substitutes its placeholder. Deriving from it would cut
  // this model from 50 credits to 4 on an "Apply".
  "unquoted/model": { ...FALLBACK_PRICE, source: "fallback" },
  "fresh/model": { ...CHEAP, source: "openrouter" },
};

function storedCatalogue() {
  return {
    quickSetup: { fastModel: "cheap/model", smartModel: "dear/model", geniusModel: "fresh/model" },
    models: [
      {
        id: "cheap/model",
        name: "Cheap",
        provider: "Test",
        tier: "Economy",
        // Stored price is stale on purpose — live is 0.1/0.32.
        promptPrice: 0.08,
        completionPrice: 0.3,
        credits: 5,
        isMerchantActive: true,
        maxTokens: 4096,
        temperature: 0.7,
      },
      {
        id: "dear/model",
        name: "Dear",
        provider: "Test",
        tier: "Premium",
        promptPrice: DEAR.promptPrice,
        completionPrice: DEAR.completionPrice,
        credits: 3,
        isMerchantActive: true,
        maxTokens: 8192,
        temperature: 0.7,
      },
      {
        id: "unquoted/model",
        name: "Unquoted",
        provider: "Test",
        tier: "Standard",
        promptPrice: FALLBACK_PRICE.promptPrice,
        completionPrice: FALLBACK_PRICE.completionPrice,
        credits: 50,
        isMerchantActive: false,
        maxTokens: 4096,
        temperature: 0.7,
      },
      {
        id: "fresh/model",
        name: "Fresh",
        provider: "Test",
        tier: "Economy",
        promptPrice: CHEAP.promptPrice,
        completionPrice: CHEAP.completionPrice,
        // Already correct: derives to 4 as well.
        credits: 4,
        isMerchantActive: true,
        maxTokens: 4096,
        temperature: 0.7,
      },
    ],
    minCreditThreshold: 50,
    defaultProvider: "gemini",
    testChatMultiplier: 1,
    usdToBdtRate: RATE,
  };
}

/** The value handed to `platformSetting.update` on the catalogue row. */
function writtenCatalogue() {
  const call = update.mock.calls.find(([args]) => args.where.key === CATALOGUE_KEY);
  return call?.[0].data.value as Record<string, unknown>;
}

function writtenModels(): Record<string, unknown>[] {
  return writtenCatalogue().models as Record<string, unknown>[];
}

function modelById(id: string): Record<string, unknown> {
  const model = writtenModels().find((entry) => entry.id === id);
  if (!model) throw new Error(`${id} missing from the written catalogue`);
  return model;
}

beforeEach(() => {
  vi.clearAllMocks();

  const catalogue = storedCatalogue();

  findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
    if (where.key === CATALOGUE_KEY) return { key: CATALOGUE_KEY, value: catalogue };
    // No derivation row: the target and token estimate fall back to defaults.
    return null;
  });

  update.mockResolvedValue({});
  upsert.mockResolvedValue({});
  transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));

  resolveModelPrice.mockImplementation(async (modelId: string) => ({
    modelId,
    ...(PRICES[modelId] ?? FALLBACK_PRICE),
  }));

  getCreditRules.mockResolvedValue({
    modelCredits: {},
    testChatMultiplier: 1,
    usdToBdtRate: RATE,
  });
});

// ─── The preview ──────────────────────────────────────────────────────────────

describe("buildDerivationPreview", () => {
  it("classifies every row and writes nothing", async () => {
    const preview = await buildDerivationPreview();

    expect(preview.summary).toEqual({
      total: 4,
      unchanged: 1, // fresh/model
      withinThreshold: 1, // cheap/model, 5 → 4 is exactly 20%
      needsReview: 2, // dear/model, and unquoted/model which can never derive
      priceUnknown: 1,
      priceDrift: 1, // cheap/model's stored price is stale
      appliesByDefault: 1,
    });

    expect(update).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("derives from the live price, not the stored one", async () => {
    const preview = await buildDerivationPreview();
    const cheap = preview.rows.find((row) => row.modelId === "cheap/model")!;

    // Stored 0.08/0.30 would give 3 credits; the live quote gives 4.
    expect(cheap.storedPrice).toEqual({ prompt: 0.08, completion: 0.3 });
    expect(cheap.livePrice).toEqual({ prompt: 0.1, completion: 0.32 });
    expect(cheap.priceDrift).toBe(true);
    expect(cheap.proposedCredits).toBe(4);
    expect(cheap.costBdt).toBeCloseTo(0.062496, 9);
  });

  it("proposes no change for a model OpenRouter has no quote for", async () => {
    const preview = await buildDerivationPreview();
    const unquoted = preview.rows.find((row) => row.modelId === "unquoted/model")!;

    expect(unquoted.priceUnknown).toBe(true);
    expect(unquoted.appliesByDefault).toBe(false);
    // 50, not the 4 the placeholder price would derive.
    expect(unquoted.proposedCredits).toBe(50);
    expect(unquoted.verdict).toBe("needs_review");
  });

  it("prices each plan's allowance at the previewed target", async () => {
    const preview = await buildDerivationPreview();

    // BD has no `growth` plan, and asking `getPlan` for one silently returns
    // starter — so the list must come from the region's own plans.
    expect(preview.allowances.map((a) => a.planKey)).toEqual([
      "starter",
      "business",
      "enterprise",
    ]);
    // ⚠️ ১৫.৫: Enterprise used to be this list's third margin (40). It is now
    //    sold by negotiation, so there is no published price to divide by and the
    //    honest answer is `null` — not 0, which would read as "free". The
    //    allowance is still listed, because its *cost* is still known.
    expect(preview.allowances.map((a) => a.economics.netMarginPercent)).toEqual([70, 60, null]);
  });

  it("honours an explicit target without touching the stored row", async () => {
    const preview = await buildDerivationPreview({ targetBdtPerCredit: 0.04 });

    expect(preview.targetBdtPerCredit).toBe(0.04);
    // Doubling the target halves the credits: ৳0.0625 ÷ ৳0.04 → 2.
    expect(preview.rows.find((row) => row.modelId === "cheap/model")!.proposedCredits).toBe(2);
    // And the allowance doubles in cost, so the margin collapses.
    expect(preview.allowances[0].economics.netMarginPercent).toBe(40);
    expect(update).not.toHaveBeenCalled();
  });

  it("sanitises an unusable target instead of trusting it", async () => {
    const preview = await buildDerivationPreview({ targetBdtPerCredit: -1 });
    expect(preview.targetBdtPerCredit).toBe(0.02);
  });
});

// ─── Apply ────────────────────────────────────────────────────────────────────

describe("applyDerivation — what it writes", () => {
  it("writes the within-threshold row and the confirmed one", async () => {
    const result = await applyDerivation({ confirm: ["dear/model"] });

    expect(result.applied).toBe(2);
    expect(modelById("cheap/model").credits).toBe(4);
    expect(modelById("dear/model").credits).toBe(82);
  });

  it("never writes a row whose price was a placeholder, even when confirmed", async () => {
    const result = await applyDerivation({ confirm: ["unquoted/model"] });

    // The admin asking for it does not make a placeholder into a quote. The
    // proposed number there is the floor, and writing it would cut a model from
    // 50 credits to 4 on the strength of $0.15/$0.60 that OpenRouter never said.
    expect(modelById("unquoted/model").credits).toBe(50);
    expect(result.skipped).toContainEqual({
      modelId: "unquoted/model",
      reason: "price_unknown",
    });
    // The only write is cheap/model, which clears the threshold on its own — the
    // confirmed-but-unquoted row contributed nothing.
    expect(result.applied).toBe(1);
    expect(modelById("cheap/model").credits).toBe(4);
  });

  it("leaves an unconfirmed large move alone", async () => {
    const result = await applyDerivation({ confirm: [] });

    expect(modelById("dear/model").credits).toBe(3);
    expect(result.applied).toBe(1); // only cheap/model
  });

  it("reports a confirmed id that is not in the catalogue", async () => {
    const result = await applyDerivation({ confirm: ["ghost/model"] });

    expect(result.skipped).toContainEqual({ modelId: "ghost/model", reason: "not_found" });
  });

  it("does not count a row that was already correct", async () => {
    const result = await applyDerivation({ confirm: ["fresh/model"] });

    // confirmed, but 4 → 4 is not a change, so it is not an edit.
    expect(result.skipped).toContainEqual({ modelId: "fresh/model", reason: "unchanged" });
    expect(modelById("fresh/model").credits).toBe(4);
  });
});

describe("applyDerivation — what it must not disturb", () => {
  it("carries every other setting through untouched", async () => {
    await applyDerivation({ confirm: ["dear/model"] });
    const written = writtenCatalogue();

    // Four other routes replace this whole value; a partial write from here
    // would silently reset settings the admin never opened.
    expect(written.quickSetup).toEqual(storedCatalogue().quickSetup);
    expect(written.minCreditThreshold).toBe(50);
    expect(written.defaultProvider).toBe("gemini");
    expect(written.testChatMultiplier).toBe(1);
    expect(written.usdToBdtRate).toBe(RATE);
  });

  it("carries per-model fields it does not understand through untouched", async () => {
    await applyDerivation({ confirm: ["dear/model"] });

    expect(modelById("cheap/model").maxTokens).toBe(4096);
    expect(modelById("cheap/model").temperature).toBe(0.7);
    expect(modelById("dear/model").name).toBe("Dear");
    expect(modelById("dear/model").isMerchantActive).toBe(true);
  });

  it("refreshes the stored price only where a real quote replaced it", async () => {
    await applyDerivation({ confirm: ["dear/model"] });

    // cheap/model was written, so its stale price is corrected alongside.
    expect(modelById("cheap/model").promptPrice).toBe(0.1);
    expect(modelById("cheap/model").completionPrice).toBe(0.32);
    // dear/model's stored price already matched the quote — nothing to fix.
    expect(modelById("dear/model").promptPrice).toBe(DEAR.promptPrice);
    // fresh/model was not written, so it is not touched either.
    expect(modelById("fresh/model").promptPrice).toBe(CHEAP.promptPrice);
  });

  it("keeps the derivation inputs in their own row, never in the catalogue", async () => {
    await applyDerivation({ targetBdtPerCredit: 0.03, confirm: ["dear/model"] });

    // `ai_credit_rules` has four other wholesale writers, so anything stored
    // there would be erased by whichever of them ran next.
    expect(writtenCatalogue()).not.toHaveProperty("targetBdtPerCredit");
    expect(writtenCatalogue()).not.toHaveProperty("expectedTokens");

    const inputWrite = upsert.mock.calls.find(([args]) => args.where.key === DERIVATION_KEY);
    expect(inputWrite?.[0].update.value).toMatchObject({
      targetBdtPerCredit: 0.03,
      expectedTokens: { prompt: 4_000, completion: 300 },
    });
  });

  it("commits both rows in one transaction", async () => {
    await applyDerivation({ confirm: ["dear/model"] });

    // A catalogue repriced at a target the input row does not record would make
    // the next preview call every row changed.
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0][0]).toHaveLength(2);
    expect(update).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});

describe("applyDerivation — when there is nothing to write onto", () => {
  it("refuses rather than inventing a settings row", async () => {
    findUnique.mockImplementation(async ({ where }: { where: { key: string } }) =>
      where.key === CATALOGUE_KEY ? null : null
    );

    // Seeding a fresh row from here would duplicate the defaults that
    // `app/api/admin/ai-settings` owns — a second copy to drift out of step.
    await expect(applyDerivation({ confirm: [] })).rejects.toThrow(/No ai_credit_rules row/);
    expect(update).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
