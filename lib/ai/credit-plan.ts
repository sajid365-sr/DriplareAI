import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/core/db";
import { sanitizeUsdToBdtRate } from "@/lib/domain/credit-config";
import { getPlansForRegion } from "@/lib/domain/plan-config";
import {
  computeAllowanceEconomics,
  deriveCatalogueCredits,
  planCreditUpdate,
  sanitizeExpectedReplyTokens,
  sanitizeTargetBdtPerCredit,
  type CreditChangeVerdict,
  type DeriveCreditsInput,
  type ExpectedReplyTokens,
} from "@/lib/ai/credit-derivation";
import type {
  ApplyResult,
  DerivationAllowance,
  DerivationInputs,
  DerivationPreview,
  DerivationRow,
} from "@/lib/ai/derivation-types";
import { resolveModelPrice } from "@/lib/ai/model-pricing";
import { getCreditRules } from "@/lib/ai/credit-resolver";

/** The shapes the panel renders. Re-exported so callers need one import. */
export type {
  ApplyResult,
  DerivationAllowance,
  DerivationInputs,
  DerivationPreview,
  DerivationRow,
} from "@/lib/ai/derivation-types";

/**
 * Credit Plan — the server side of the derivation panel in `/admin/ai-settings`.
 *
 * ── Why derivation is not done at billing time ───────────────────────────────
 * `resolveReplyCredits()` — the one function that decides what a reply costs —
 * is untouched by any of this. It reads `ai_credit_rules.models[].credits` and
 * always will. Deriving inside it would mean a merchant's visible price could
 * change between two replies with nobody having decided anything, and the whole
 * point of `CREDIT_CHANGE_REVIEW_RATIO` is that a person approves a repricing.
 *
 * So derivation **materialises**: an admin looks at the diff, clicks Apply, and
 * the derived numbers are written into the same table by hand would have been.
 * Billing keeps reading a stored number; the number now comes from the price.
 *
 * ── Why the plan is computed here and never sent by the client ───────────────
 * The panel posts `{ targetBdtPerCredit, expectedTokens, apply, confirm[] }` —
 * policy, not numbers. Every proposed credit is recomputed on the server from
 * the stored catalogue and the live OpenRouter prices, so a stale tab, or a
 * hand-crafted request, cannot write a credit figure this module did not derive.
 *
 * ── What Apply will not touch ───────────────────────────────────────────────
 * A row whose `priceUnknown` is true is never written, `confirm` notwithstanding.
 * On 2026-10-14 that was six of thirty-four models — no OpenRouter quote, so
 * `model-pricing.ts` had substituted its $0.15/$0.60 placeholder — and the
 * proposed value for those is not a derivation but the floor. See the module
 * header of `credit-derivation.ts`.
 *
 * ── Why the two inputs get their own PlatformSetting row ────────────────────
 * `ai_credit_rules` has five writers, and four of them replace the entire JSON
 * value (`app/api/admin/ai-settings`, `.../fetch-models`, `.../validate-models`,
 * `lib/ai/openrouter-service.ts`). Anything stored inside that value is erased
 * by whichever of them runs next — an admin's target would silently revert to
 * the default the first time they added a model. So the derivation inputs live
 * in `ai_credit_derivation`, which has exactly one writer: this module.
 *
 * It also keeps the billing path untouched. `getCreditRules()` and the
 * `CreditRules` shape are unchanged, so nothing on the hot path gains a field,
 * a read, or a way to be wrong. `resolveReplyCredits()` still reads a stored
 * number and still has no idea this module exists.
 */

/** The catalogue + credit numbers. Replaced wholesale by four other routes. */
const SETTING_KEY = "ai_credit_rules";

/** The derivation inputs. Written only here. */
const DERIVATION_KEY = "ai_credit_derivation";

/** Smallest meaningful price difference; below this the two are the same quote. */
const PRICE_EPSILON = 1e-9;

// ─── The stored catalogue ─────────────────────────────────────────────────────

/**
 * The fields this module reads off a row of `ai_credit_rules.models[]`.
 *
 * Everything else on the entry — `maxTokens`, `temperature`, `contextWindow`,
 * whatever is added later — is carried through the write untouched, because the
 * write merges into the parsed row rather than replacing it.
 */
interface StoredModel {
  id: string;
  name?: string;
  provider?: string;
  tier?: string;
  promptPrice?: number;
  completionPrice?: number;
  credits?: number;
  isMerchantActive?: boolean;
  isDeprecated?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStoredModels(value: unknown): StoredModel[] {
  if (!isRecord(value) || !Array.isArray(value.models)) return [];

  return value.models.filter(
    (entry): entry is StoredModel => isRecord(entry) && typeof entry.id === "string"
  );
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// ─── The preview ──────────────────────────────────────────────────────────────

// The shapes the panel renders live in `derivation-types.ts`, which is client-safe
// on purpose — see the note there.

/** One catalogue entry paired with the price and derivation input it produced. */
interface ResolvedEntry {
  model: StoredModel;
  price: Awaited<ReturnType<typeof resolveModelPrice>>;
  derivationInput: Omit<DeriveCreditsInput, "targetBdtPerCredit">;
}

/** The stored derivation inputs, each sanitised so one bad write cannot poison them. */
async function readStoredInputs(): Promise<{
  targetBdtPerCredit: number;
  expectedTokens: ExpectedReplyTokens;
}> {
  const setting = await db.platformSetting.findUnique({ where: { key: DERIVATION_KEY } });
  const value = isRecord(setting?.value) ? setting.value : {};

  return {
    targetBdtPerCredit: sanitizeTargetBdtPerCredit(value.targetBdtPerCredit),
    expectedTokens: sanitizeExpectedReplyTokens(value.expectedTokens),
  };
}

/** Resolves the target and the token estimate, falling back to the stored row. */
async function resolveInputs(inputs: DerivationInputs): Promise<{
  targetBdtPerCredit: number;
  expectedTokens: ExpectedReplyTokens;
  usdToBdtRate: number;
}> {
  // The exchange rate *is* a credit rule, so it comes from the row that owns it.
  // Running the two reads together keeps the panel's preview to two round trips.
  const [stored, rules] = await Promise.all([readStoredInputs(), getCreditRules()]);

  return {
    // An undefined input means "as configured"; anything present is sanitised
    // even when it came from the stored row.
    targetBdtPerCredit:
      inputs.targetBdtPerCredit === undefined
        ? stored.targetBdtPerCredit
        : sanitizeTargetBdtPerCredit(inputs.targetBdtPerCredit),
    expectedTokens:
      inputs.expectedTokens === undefined
        ? stored.expectedTokens
        : sanitizeExpectedReplyTokens(inputs.expectedTokens),
    usdToBdtRate: rules.usdToBdtRate,
  };
}

/**
 * Builds the full diff. Read-only — opening the panel never writes anything.
 *
 * Prices are resolved one model at a time on purpose: `resolveModelPrice()` on a
 * cold cache performs the snapshot load, and firing thirty-four of them
 * concurrently would make every one of them miss the memory cache and read the
 * Singapore database thirty-four times.
 */
export async function buildDerivationPreview(
  inputs: DerivationInputs = {}
): Promise<DerivationPreview> {
  const setting = await db.platformSetting.findUnique({ where: { key: SETTING_KEY } });
  const storedModels = readStoredModels(setting?.value ?? null);
  const { targetBdtPerCredit, expectedTokens, usdToBdtRate } = await resolveInputs(inputs);

  const resolved: ResolvedEntry[] = [];
  let pricingFetchedAt: string | null = null;

  for (const model of storedModels) {
    const price = await resolveModelPrice(model.id);
    pricingFetchedAt = pricingFetchedAt ?? price.asOf;

    resolved.push({
      model,
      price,
      derivationInput: {
        modelId: model.id,
        promptPrice: price.promptPrice,
        completionPrice: price.completionPrice,
        usdToBdtRate,
        priceSource: price.source,
      },
    });
  }

  const derived = deriveCatalogueCredits(
    resolved.map((entry) => entry.derivationInput),
    targetBdtPerCredit,
    expectedTokens
  );

  const current: Record<string, number> = {};
  for (const model of storedModels) {
    if (typeof model.credits === "number") current[model.id] = model.credits;
  }

  const plan = planCreditUpdate(current, derived);

  const rows: DerivationRow[] = plan.rows.map((row, index) => {
    const model = resolved[index].model;
    const price = resolved[index].price;

    const storedPrompt = readNumber(model.promptPrice);
    const storedCompletion = readNumber(model.completionPrice);

    return {
      modelId: row.modelId,
      name: typeof model.name === "string" && model.name ? model.name : row.modelId,
      provider: typeof model.provider === "string" ? model.provider : "",
      tier: typeof model.tier === "string" ? model.tier : "",
      isMerchantActive: model.isMerchantActive === true,
      currentCredits: row.currentCredits,
      proposedCredits: row.proposedCredits,
      storedPrice: { prompt: storedPrompt, completion: storedCompletion },
      livePrice: { prompt: price.promptPrice, completion: price.completionPrice },
      priceSource: price.source,
      priceDrift:
        Math.abs(storedPrompt - price.promptPrice) > PRICE_EPSILON ||
        Math.abs(storedCompletion - price.completionPrice) > PRICE_EPSILON,
      costBdt: row.costBdt,
      priceUnknown: row.priceUnknown,
      verdict: row.verdict,
      appliesByDefault: canApplyByDefault(row.verdict, row.priceUnknown, row.currentCredits),
    };
  });

  return {
    rows,
    summary: {
      total: rows.length,
      unchanged: rows.filter((row) => row.verdict === "unchanged").length,
      withinThreshold: rows.filter((row) => row.verdict === "within_threshold").length,
      needsReview: rows.filter((row) => row.verdict === "needs_review").length,
      priceUnknown: rows.filter((row) => row.priceUnknown).length,
      priceDrift: rows.filter((row) => row.priceDrift).length,
      appliesByDefault: rows.filter((row) => row.appliesByDefault).length,
    },
    targetBdtPerCredit,
    expectedTokens,
    usdToBdtRate,
    pricingFetchedAt,
    allowances: buildAllowances(targetBdtPerCredit),
  };
}

/** A row may be written without anyone confirming it only if nothing moved far. */
function canApplyByDefault(
  verdict: CreditChangeVerdict,
  priceUnknown: boolean,
  currentCredits: number | null
): boolean {
  if (priceUnknown) return false;
  if (currentCredits === null) return false;
  // "unchanged" has nothing to write, so it is not an apply.
  return verdict === "within_threshold";
}

/** What each BD plan's advertised allowance would cost the platform at this target. */
function buildAllowances(targetBdtPerCredit: number): DerivationAllowance[] {
  // `getPlansForRegion` and not `PLAN_KEYS`: BD has no `growth` plan, and asking
  // for one returns starter's config silently (`getPlan`'s `?? plans[0]`), which
  // would print the Starter allowance under a "Growth" heading.
  return getPlansForRegion("bd").map((plan) => ({
    planKey: plan.key,
    includedCredits: plan.includedCredits,
    priceBdt: plan.price,
    economics: computeAllowanceEconomics({
      includedCredits: plan.includedCredits,
      priceBdt: plan.price,
      targetBdtPerCredit,
    }),
  }));
}

// ─── Apply ────────────────────────────────────────────────────────────────────

/**
 * Writes the derived credits the admin approved.
 *
 * @param confirm - model ids the admin explicitly accepted even though the move
 *                  crossed `CREDIT_CHANGE_REVIEW_RATIO`. Rows not listed keep
 *                  their current number.
 *
 * The write is a read-modify-write of the whole JSON value: only
 * `models[].credits` (and, for applied rows, the now-verifiable price) change,
 * and `quickSetup` / `minCreditThreshold` / `testMultiplier` / `usdToBdtRate`
 * are carried through exactly as they were. A partial write here would silently
 * reset settings the admin never opened.
 */
export async function applyDerivation(
  inputs: DerivationInputs & { confirm?: readonly string[] }
): Promise<ApplyResult> {
  const confirm = new Set(inputs.confirm ?? []);
  const preview = await buildDerivationPreview(inputs);

  const setting = await db.platformSetting.findUnique({ where: { key: SETTING_KEY } });

  // Apply is a settings save, so it needs something to save onto. Writing a
  // fresh row from here would mean duplicating the defaults (`quickSetup`,
  // `defaultProvider`, `minCreditThreshold`) that `app/api/admin/ai-settings`
  // owns — a second copy to drift out of step. The panel asks for a save first.
  if (!setting) {
    throw new Error(
      "No ai_credit_rules row exists yet. Save the AI settings once, then apply derived credits."
    );
  }

  const storedValue = isRecord(setting.value) ? setting.value : {};
  const storedModels = Array.isArray(storedValue.models) ? storedValue.models : [];

  const rowsById = new Map(preview.rows.map((row) => [row.modelId, row]));
  const skipped: ApplyResult["skipped"] = [];
  let applied = 0;

  const nextModels = storedModels.map((entry): unknown => {
    if (!isRecord(entry) || typeof entry.id !== "string") return entry;

    const row = rowsById.get(entry.id);
    if (!row) return entry;

    // Unknown price → never written. The proposed number there is the floor,
    // not a derivation, and `confirm` cannot turn a placeholder into a quote.
    if (row.priceUnknown) {
      if (confirm.has(row.modelId)) skipped.push({ modelId: row.modelId, reason: "price_unknown" });
      return entry;
    }

    const approved = row.appliesByDefault || confirm.has(row.modelId);
    // "unchanged" is deliberately not an apply: there is nothing to write, and
    // counting it would report edits that never happened.
    if (!approved || row.currentCredits === row.proposedCredits) {
      if (confirm.has(row.modelId)) skipped.push({ modelId: row.modelId, reason: "unchanged" });
      return entry;
    }

    applied += 1;

    const next: Record<string, unknown> = { ...entry, credits: row.proposedCredits };

    // The stored price is display-only (billing reads `resolveModelPrice()`), and
    // the panel shows no way to edit it. Refreshing it here is what lets the row
    // read "৳1.638 per reply → 82 credits" and have both halves be true.
    if (row.priceSource === "openrouter") {
      next.promptPrice = row.livePrice.prompt;
      next.completionPrice = row.livePrice.completion;
    }

    return next;
  });

  // A confirmed id that matches nothing in the catalogue is reported rather than
  // ignored — it means the panel and the database disagree about the model list.
  for (const modelId of confirm) {
    if (!rowsById.has(modelId)) skipped.push({ modelId, reason: "not_found" });
  }

  const nextValue = {
    ...storedValue,
    models: nextModels,
    updatedAt: new Date().toISOString(),
  } as unknown as Prisma.InputJsonValue;

  // Two writes, deliberately. The catalogue row is shared with four other routes
  // and only `models[]` may change; the derivation row is ours alone. One
  // transaction keeps them in step, because a catalogue repriced at a target the
  // row does not record would make the next preview call every row changed.
  const nextDerivation = {
    targetBdtPerCredit: preview.targetBdtPerCredit,
    expectedTokens: preview.expectedTokens,
    updatedAt: new Date().toISOString(),
  } as unknown as Prisma.InputJsonValue;

  await db.$transaction([
    db.platformSetting.update({ where: { key: SETTING_KEY }, data: { value: nextValue } }),
    db.platformSetting.upsert({
      where: { key: DERIVATION_KEY },
      update: { value: nextDerivation },
      create: { key: DERIVATION_KEY, value: nextDerivation },
    }),
  ]);

  return { preview, applied, skipped };
}
