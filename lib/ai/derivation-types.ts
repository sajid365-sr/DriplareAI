import type { AllowanceEconomics, CreditChangeVerdict, ExpectedReplyTokens } from "@/lib/ai/credit-derivation";

/**
 * The shapes `lib/ai/credit-plan.ts` returns, split out so the admin panel can
 * import them.
 *
 * ⚠️ Deliberately client-safe — no `server-only` here, and no runtime code, only
 *    types. `credit-plan.ts` itself imports `server-only` and the database, so
 *    the panel cannot import from it: a single value import would pull the
 *    Prisma client into the browser bundle and the build would stop. Types are
 *    erased, but keeping them in their own file means nobody has to rely on
 *    that. Same reasoning as `lib/domain/model-catalog.ts`.
 *
 *    `PricingSource` is spelled out rather than imported from `model-pricing.ts`
 *    for the same reason. `credit-plan.ts` assigns a `PricingSource` into this
 *    field, so if the two ever diverge the build fails — the duplication cannot
 *    go unnoticed.
 */
type PricingSource = "openrouter" | "fallback";

/** One model's row in the derivation diff. */
export interface DerivationRow {
  modelId: string;
  /** Display name from the catalogue; falls back to the id. */
  name: string;
  provider: string;
  tier: string;
  isMerchantActive: boolean;
  /** Credits configured today. `null` = never priced. */
  currentCredits: number | null;
  proposedCredits: number;
  /** What the settings row says the price is — read-only, and often stale. */
  storedPrice: { prompt: number; completion: number };
  /** What OpenRouter says right now — the figure the derivation used. */
  livePrice: { prompt: number; completion: number };
  priceSource: PricingSource;
  /** True when `storedPrice` no longer matches `livePrice`. */
  priceDrift: boolean;
  costBdt: number;
  priceUnknown: boolean;
  verdict: CreditChangeVerdict;
  /** Whether an Apply would write this row without anyone confirming it first. */
  appliesByDefault: boolean;
}

/** What one plan's advertised allowance would cost at the previewed target. */
export interface DerivationAllowance {
  planKey: string;
  includedCredits: number;
  priceBdt: number;
  economics: AllowanceEconomics;
}

export interface DerivationPreview {
  rows: DerivationRow[];
  summary: {
    total: number;
    unchanged: number;
    withinThreshold: number;
    needsReview: number;
    priceUnknown: number;
    priceDrift: number;
    /** Rows an Apply would write with no confirmation. */
    appliesByDefault: number;
  };
  /** The inputs this preview was computed at, after sanitising. */
  targetBdtPerCredit: number;
  expectedTokens: ExpectedReplyTokens;
  usdToBdtRate: number;
  /** When OpenRouter's prices were last fetched. `null` = no snapshot at all. */
  pricingFetchedAt: string | null;
  allowances: DerivationAllowance[];
}

/** The two admin-editable inputs. Both omit-able: absent means "as stored". */
export interface DerivationInputs {
  targetBdtPerCredit?: unknown;
  expectedTokens?: unknown;
}

export interface ApplyResult {
  preview: DerivationPreview;
  applied: number;
  /** Rows the request asked for that were left alone, with the reason. */
  skipped: { modelId: string; reason: "price_unknown" | "unchanged" | "not_found" }[];
}
