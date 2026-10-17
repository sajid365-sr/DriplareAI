/**
 * Credit Derivation — a model's credit cost, computed from its real price.
 *
 * ── The defect this replaces ─────────────────────────────────────────────────
 * Every model's credit cost was typed in by hand, one number per model, in
 * `/admin/ai-settings`. That does not survive contact with a real catalogue.
 * Straight from the live admin panel on 2026-10-14:
 *
 *   openai/gpt-4o                        ৳1.638  per reply  →   3 credits
 *   meta-llama/llama-3.3-70b-instruct    ৳0.0625 per reply  →   5 credits
 *
 * The model that costs 26× more is charged *fewer* credits. The ladder is not
 * merely imprecise, it is inverted — and `openai/gpt-4o` is `premium` in
 * `MODEL_TIER_MAP`, whose tier default was 5, so this was not a tier decision
 * either. It was a typo, or a guess, and nothing in the system could notice.
 * Twenty active models means twenty occasions for that mistake.
 *
 * ── The fix ──────────────────────────────────────────────────────────────────
 * Do not store a credit cost per model. Store ONE number — what a credit is
 * worth in taka — and derive each model's credits from the price OpenRouter
 * already reports:
 *
 *   credits = ceil(cost per reply ৳ ÷ targetBdtPerCredit)
 *
 * The prices are not new work. `lib/ai/model-pricing.ts` has been fetching and
 * caching them (memory → PlatformSetting → live, stale-while-revalidate) since
 * long before this module, and `/admin/ai-settings` already displays them. This
 * module is the consumer that was missing: the machinery was built, then the
 * numbers were typed by hand anyway.
 *
 * ── What `targetBdtPerCredit` actually is ────────────────────────────────────
 * It is the platform's **cost** per credit, not a margin. After derivation every
 * model costs exactly that much per credit, by construction. The margin is
 * decided elsewhere — by how many credits a plan includes against its price:
 *
 *   Starter     ৳999   ÷ 15,000 credits → ৳300   of cost → 70% margin
 *   Business    ৳2,499 ÷ 50,000 credits → ৳1,000 of cost → 60% margin
 *   Enterprise  ৳4,999 ÷ 150,000 credits → ৳3,000 of cost → 40% margin
 *
 * That is why `DEFAULT_TARGET_BDT_PER_CREDIT` is ৳0.020: it is the value at
 * which today's advertised credit allowances come out as a sane, declining
 * margin ladder. Change the target and the allowances or the prices must move.
 *
 * ── Purity ───────────────────────────────────────────────────────────────────
 * No database, no network, no `server-only`. Prices and the rate arrive as
 * arguments so this arithmetic can be tested against the real panel figures
 * (see `credit-derivation.test.ts`) rather than against a mock.
 *
 * ⚠️ One input is still an estimate: `ExpectedReplyTokens`. It defaults to
 * 4,000 prompt + 300 completion, which is a placeholder. `AIUsageLog` already
 * records `promptTokens` / `completionTokens` per call, so TASK-15.1 replaces
 * this default with the measured p75 per preset. The arithmetic here does not
 * change when it does — only the number handed in.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Token counts to expect for one reply, used to turn a token price into a reply price. */
export interface ExpectedReplyTokens {
  prompt: number;
  completion: number;
}

export interface DeriveCreditsInput {
  modelId: string;
  /** USD per 1M prompt tokens — exactly what `resolveModelPrice()` returns. */
  promptPrice: number;
  /** USD per 1M completion tokens. */
  completionPrice: number;
  /** Live USD → BDT rate (`getUsdToBdtRate()`); sanitize with `sanitizeUsdToBdtRate()`. */
  usdToBdtRate: number;
  /** The platform's cost per credit. See `sanitizeTargetBdtPerCredit()`. */
  targetBdtPerCredit: number;
  /** Omit to use `DEFAULT_EXPECTED_REPLY_TOKENS`. */
  tokens?: ExpectedReplyTokens;
  /**
   * Where `promptPrice` / `completionPrice` came from — `resolveModelPrice()`'s
   * own `source` field. Pass it whenever you have it.
   *
   * `"fallback"` means OpenRouter had no quote for this model and
   * `model-pricing.ts` substituted its placeholder. That is fine for *reporting*
   * a cost, and wrong for *deriving* one: six of the thirty-four models
   * configured on 2026-10-14 were in this state, and a placeholder price made
   * `anthropic/claude-opus-4.7-fast` — configured at 50 credits — derive to 4.
   * An unquoted price is marked `priceUnknown`, so the update plan leaves the
   * admin's number alone instead of quietly cutting it by 92%.
   */
  priceSource?: "openrouter" | "fallback";
}

export interface DerivedModelCredits {
  modelId: string;
  /** Credits charged per reply. Never below `MIN_CREDITS_PER_REPLY`. */
  credits: number;
  /** Estimated USD cost of one reply at the expected token counts. */
  costUsd: number;
  /** The same cost in taka, at the rate given. */
  costBdt: number;
  /**
   * `costBdt ÷ credits` — what a credit costs *after* rounding up, which is
   * always slightly under the target. `null` when the price was unusable.
   */
  effectiveBdtPerCredit: number | null;
  /**
   * True when `credits` is not a derivation — either the price was unusable, or
   * it came from the fallback rather than a real OpenRouter quote.
   *
   * The admin panel must show these differently, and `planCreditUpdate()` must
   * not propose a new number for them: a derived figure resting on a placeholder
   * price is a guess wearing the same clothes as a measurement.
   */
  priceUnknown: boolean;
}

export type CreditChangeVerdict = "unchanged" | "within_threshold" | "needs_review";

export interface CreditUpdateRow {
  modelId: string;
  /** `null` = this model has no credit configured yet. */
  currentCredits: number | null;
  proposedCredits: number;
  costBdt: number;
  priceUnknown: boolean;
  verdict: CreditChangeVerdict;
}

export interface CreditUpdatePlan {
  rows: CreditUpdateRow[];
  /** How many rows crossed `CREDIT_CHANGE_REVIEW_RATIO`. */
  needsReview: number;
}

export interface AllowanceEconomics {
  /** What a plan's full credit allowance costs the platform. */
  costBdt: number;
  /** Plan price − cost. `null` when the plan has no usable price ("Contact us"). */
  netProfitBdt: number | null;
  /** `null` for the same reason — never `0`, which would claim "charges nothing". */
  netMarginPercent: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * The platform's cost per credit, in taka — the single number an admin sets.
 *
 * ৳0.020 is not arbitrary. It is the value at which the credit allowances the
 * product already advertises (15,000 / 50,000) produce a declining margin ladder
 * of 70% / 60% against the two BD plans that have a published price — i.e. the
 * existing plan prices are already coherent at this target, and only the
 * model-level numbers were wrong. Any other value would require moving the plan
 * prices or the allowances.
 *
 * ⚠️ ১৫.৫: this ladder used to have a third rung — Enterprise, 150,000 credits
 * at 40%. That tier is now priced by negotiation, so its allowance no longer has
 * a margin to be a rung of (the cost is still measured, the price is not). The
 * target is unchanged by that: it was chosen to fit the two published prices,
 * and it still does.
 *
 * It also places the observed models where a merchant can read them: the
 * cheapest active model lands at 4 credits and the most expensive at 104, so
 * the number itself finally says how expensive a reply is.
 */
export const DEFAULT_TARGET_BDT_PER_CREDIT = 0.02;

/** Sanity bounds — catches a typo like `2` or `0.00002`. */
export const TARGET_BDT_PER_CREDIT_MIN = 0.001;
export const TARGET_BDT_PER_CREDIT_MAX = 10;

/**
 * ⚠️ A placeholder, not a measurement.
 *
 * These are the token counts the analysis in `docs/pricing/pricing-model-analysis.md`
 * used, and they are an assumption until TASK-15.1 reads the real distribution
 * out of `AIUsageLog`. Bengali input and a large knowledge base both push the
 * prompt count well past 4,000, so treat every derived credit as provisional
 * until that measurement lands.
 */
export const DEFAULT_EXPECTED_REPLY_TOKENS: ExpectedReplyTokens = { prompt: 4_000, completion: 300 };

/**
 * A reply never costs less than one credit.
 *
 * Not for revenue — a fractionally cheap reply should be cheap. It is so that a
 * reply is always *charged*, which is what makes usage visible in a merchant's
 * credit history. Zero-cost replies would vanish from the only place a merchant
 * can see what their bot is doing.
 */
export const MIN_CREDITS_PER_REPLY = 1;

/**
 * How far a model's credits may move before the change needs a human.
 *
 * A merchant sees "Genius — 10 credits" and plans around it. If a cron silently
 * made that 104 overnight, they would be right to feel cheated, and the trust
 * costs more than the credits. So the daily recompute reports; it does not
 * apply. This is the same principle as `unit-economics`' `null`: the system
 * supplies the facts and lets a person decide.
 */
export const CREDIT_CHANGE_REVIEW_RATIO = 0.2;

/** OpenRouter quotes per token; every price in this codebase is per 1M. */
const TOKENS_PER_UNIT = 1_000_000;

/**
 * Digits kept before rounding up.
 *
 * `0.062496 / 0.02` is `3.1248000000000004` in IEEE-754, which is harmless —
 * but a cost that is an exact multiple of the target can land on
 * `5.000000000000001`, and `Math.ceil` would then charge 6 credits for what
 * should be 5. Trimming to 12 significant digits removes the dust without
 * touching a real difference. `model-pricing.ts` trims the same way, for the
 * same reason, when it converts per-token prices to per-1M.
 */
const RATIO_PRECISION = 12;

// ─── Sanitising the admin's number ────────────────────────────────────────────

/**
 * Normalises whatever arrived from the database or a form into a usable target.
 *
 * Mirrors `sanitizeUsdToBdtRate()` deliberately: both are admin-editable money
 * numbers, and both must behave the same way when someone types nonsense.
 * Non-numeric or non-positive input falls back to the default; anything merely
 * out of range is pulled back inside the bounds.
 */
export function sanitizeTargetBdtPerCredit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_TARGET_BDT_PER_CREDIT;
  }
  return Math.min(Math.max(value, TARGET_BDT_PER_CREDIT_MIN), TARGET_BDT_PER_CREDIT_MAX);
}

/** Upper bound on either half of the estimate — 1M tokens is already far past any real reply. */
const MAX_EXPECTED_TOKENS = 1_000_000;

function sanitizeTokenCount(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return fallback;
  return Math.min(Math.round(value), MAX_EXPECTED_TOKENS);
}

/**
 * Same treatment for the token estimate, which is admin-editable for the same
 * reason the target is: it is an assumption about real traffic, and the person
 * watching the bills knows more about it than a constant in this file.
 *
 * Zero is allowed — a completion-only estimate is a legitimate choice — but a
 * wholly unusable pair falls back to the placeholder rather than to 0, because
 * an all-zero estimate would derive every model at one credit.
 */
export function sanitizeExpectedReplyTokens(value: unknown): ExpectedReplyTokens {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  const prompt = sanitizeTokenCount(record.prompt, DEFAULT_EXPECTED_REPLY_TOKENS.prompt);
  const completion = sanitizeTokenCount(record.completion, DEFAULT_EXPECTED_REPLY_TOKENS.completion);

  if (prompt === 0 && completion === 0) return DEFAULT_EXPECTED_REPLY_TOKENS;

  return { prompt, completion };
}

// ─── Cost of one reply ────────────────────────────────────────────────────────

function isUsablePrice(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * What one reply costs in USD at the given token counts.
 *
 * Returns `null` when the price or the token counts are unusable — a fallback
 * price is *not* substituted here, because inventing a cost is exactly the
 * habit that produced the wrong credit table. The caller decides what an
 * unknown price means (`DerivedModelCredits.priceUnknown`).
 */
export function estimateReplyCostUsd(
  promptPrice: number,
  completionPrice: number,
  tokens: ExpectedReplyTokens = DEFAULT_EXPECTED_REPLY_TOKENS,
): number | null {
  if (!isUsablePrice(promptPrice) || !isUsablePrice(completionPrice)) return null;
  if (!isUsablePrice(tokens.prompt) || !isUsablePrice(tokens.completion)) return null;

  return (tokens.prompt * promptPrice + tokens.completion * completionPrice) / TOKENS_PER_UNIT;
}

// ─── Derivation ───────────────────────────────────────────────────────────────

/**
 * Credits for one model, derived from its price.
 *
 * @example
 * ```ts
 * // The live figure from /admin/ai-settings, at the shipped target.
 * deriveModelCredits({
 *   modelId: "openai/gpt-4o",
 *   promptPrice: 2.5, completionPrice: 10,
 *   usdToBdtRate: 126, targetBdtPerCredit: DEFAULT_TARGET_BDT_PER_CREDIT,
 * }).credits; // 82 — not the 3 it was typed as
 * ```
 */
export function deriveModelCredits(input: DeriveCreditsInput): DerivedModelCredits {
  const target = sanitizeTargetBdtPerCredit(input.targetBdtPerCredit);
  const tokens = input.tokens ?? DEFAULT_EXPECTED_REPLY_TOKENS;
  const costUsd = estimateReplyCostUsd(input.promptPrice, input.completionPrice, tokens);

  const rateUsable = Number.isFinite(input.usdToBdtRate) && input.usdToBdtRate > 0;

  if (costUsd === null || !rateUsable) {
    return {
      modelId: input.modelId,
      credits: MIN_CREDITS_PER_REPLY,
      costUsd: 0,
      costBdt: 0,
      effectiveBdtPerCredit: null,
      priceUnknown: true,
    };
  }

  const costBdt = costUsd * input.usdToBdtRate;
  const exact = Number((costBdt / target).toPrecision(RATIO_PRECISION));
  const credits = Math.max(MIN_CREDITS_PER_REPLY, Math.ceil(exact));

  return {
    modelId: input.modelId,
    credits,
    costUsd,
    costBdt,
    effectiveBdtPerCredit: costBdt / credits,
    // A fallback price still yields a computable cost, so the figures above stay
    // useful for display — but they are arithmetic on a placeholder, and the
    // flag says so rather than letting the result pass as a derivation.
    priceUnknown: input.priceSource === "fallback",
  };
}

/** Derives credits for a whole catalogue, preserving the order given. */
export function deriveCatalogueCredits(
  models: readonly Omit<DeriveCreditsInput, "targetBdtPerCredit">[],
  targetBdtPerCredit: number,
  tokens?: ExpectedReplyTokens,
): DerivedModelCredits[] {
  return models.map((model) =>
    deriveModelCredits({ ...model, targetBdtPerCredit, tokens: model.tokens ?? tokens })
  );
}

// ─── The review gate ──────────────────────────────────────────────────────────

/**
 * Whether a model's credits may move without a person looking at it.
 *
 * `currentCredits <= 0` is `needs_review` rather than a computed ratio: a model
 * that previously had no cost has no baseline to compare against, and treating
 * that as "0% change" would be a divide-by-zero dressed as approval.
 */
export function reviewCreditChange(
  currentCredits: number,
  proposedCredits: number,
  maxRatio: number = CREDIT_CHANGE_REVIEW_RATIO
): CreditChangeVerdict {
  if (!Number.isFinite(currentCredits) || !Number.isFinite(proposedCredits)) return "needs_review";
  if (proposedCredits === currentCredits) return "unchanged";
  if (currentCredits <= 0) return "needs_review";

  const ratio = Math.abs(proposedCredits - currentCredits) / currentCredits;
  return ratio > maxRatio ? "needs_review" : "within_threshold";
}

/**
 * The diff an admin approves — pure, so the panel only has to render it.
 *
 * A row whose `priceUnknown` is true proposes **no change**: `proposedCredits`
 * echoes what is configured and the verdict is `needs_review`. Deriving from a
 * price we could not read would reprice the model on the strength of a
 * placeholder, which on 2026-10-14 would have cut the four `-fast` models and
 * `anthropic/claude-opus-4` from 30–50 credits to 4. The admin's number,
 * whatever it rests on, is closer to the truth than arithmetic on $0.15/$0.60.
 *
 * @param current - modelId → credits as configured today
 * @param derived - output of `deriveCatalogueCredits()`
 */
export function planCreditUpdate(
  current: Readonly<Record<string, number>>,
  derived: readonly DerivedModelCredits[],
  maxRatio: number = CREDIT_CHANGE_REVIEW_RATIO
): CreditUpdatePlan {
  const rows = derived.map<CreditUpdateRow>((model) => {
    const existing = current[model.modelId];
    const currentCredits = typeof existing === "number" ? existing : null;

    if (model.priceUnknown) {
      return {
        modelId: model.modelId,
        currentCredits,
        proposedCredits: currentCredits ?? MIN_CREDITS_PER_REPLY,
        costBdt: model.costBdt,
        priceUnknown: true,
        verdict: "needs_review" as CreditChangeVerdict,
      };
    }

    return {
      modelId: model.modelId,
      currentCredits,
      proposedCredits: model.credits,
      costBdt: model.costBdt,
      priceUnknown: false,
      verdict:
        currentCredits === null
          ? "needs_review"
          : reviewCreditChange(currentCredits, model.credits, maxRatio),
    };
  });

  return { rows, needsReview: rows.filter((row) => row.verdict === "needs_review").length };
}

// ─── What a plan's allowance costs ────────────────────────────────────────────

/**
 * The projected economics of a plan's *full* allowance — every adverised credit
 * spent on an average reply.
 *
 * Distinct from `computeUnitEconomics()`, which measures what a workspace
 * actually spent. This one answers "if they used everything they were promised,
 * would it still pay?" — the question the plan prices were never checked against.
 *
 * `netProfitBdt` and `netMarginPercent` are `null` rather than `0` when the plan
 * has no usable price (Enterprise is "Contact us"), because `0%` is a claim that
 * the plan charges nothing, and it does not.
 */
export function computeAllowanceEconomics(input: {
  includedCredits: number;
  /** `null` for a plan priced by negotiation. */
  priceBdt: number | null;
  targetBdtPerCredit: number;
}): AllowanceEconomics {
  const target = sanitizeTargetBdtPerCredit(input.targetBdtPerCredit);
  const credits = Number.isFinite(input.includedCredits) ? Math.max(0, input.includedCredits) : 0;
  const costBdt = credits * target;

  const priceUsable =
    input.priceBdt !== null && Number.isFinite(input.priceBdt) && input.priceBdt > 0;

  if (!priceUsable) {
    return { costBdt, netProfitBdt: null, netMarginPercent: null };
  }

  const price = input.priceBdt as number;
  return {
    costBdt,
    netProfitBdt: price - costBdt,
    netMarginPercent: Math.round(((price - costBdt) / price) * 100),
  };
}
