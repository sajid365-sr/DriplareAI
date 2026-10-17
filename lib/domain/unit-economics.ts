/**
 * Unit economics — what one workspace earns minus what its AI usage costs.
 *
 * ── Why this is its own module ────────────────────────────────────────────────
 * This arithmetic used to live twice: once in `app/api/admin/workspaces/route.ts`
 * and once in `app/api/admin/workspaces/[id]/route.ts`. Both copies read a
 * hardcoded revenue table whose keys and prices did not match the product's real
 * plans, so both printed wrong margins — the same bug, in two places, drifting
 * apart from each other. Two copies of a money calculation is the defect; the
 * wrong table was only its symptom.
 *
 * Now there is one function, it takes the plan/region/cost as arguments, and it
 * is unit-tested. Routes wire data into it; they do not do the math.
 *
 * ── On "we cannot tell" ───────────────────────────────────────────────────────
 * Cost is always measurable. Revenue sometimes is not: a plan sold by
 * negotiation (Global Enterprise, `contact: true`) has no price to read, and an
 * unrecognised plan key has no price we are entitled to assume. In those cases
 * `netProfitBdt` and `netMarginPercent` are `null` — deliberately, not `0`.
 *
 * A `0` would be read as a fact. Revenue `0` means "this customer pays nothing,
 * so the whole API cost is loss", which would flag a healthy Enterprise account
 * as a bleeding one. `null` means "unknown", and the UI is expected to say so.
 */

import { normalizeRegion, type Region } from "@/lib/core/region";
import { isUsableRevenue, resolvePlanMonthlyRevenue, type RevenueBasis } from "@/lib/domain/plan-revenue";

/**
 * Monthly API spend, in BDT, above which a workspace is worth a look when we
 * cannot compare it against revenue. Not a business rule about profitability —
 * simply the point where the number stops being noise on this dashboard.
 */
export const HIGH_COST_ALERT_BDT = 50;

/** A workspace whose revenue is unknown is flagged at 80% of its plan's revenue. */
const HIGH_COST_REVENUE_SHARE = 0.8;

export interface UnitEconomics {
  /** Monthly plan revenue in BDT. */
  revenueBdt: number;
  /** Whether that revenue is a real price, a negotiated deal, or unknown. */
  revenueBasis: RevenueBasis;
  costUsd: number;
  costBdt: number;
  /** `null` when revenue is not a known price — see the module comment. */
  netProfitBdt: number | null;
  /** `null` when there is no revenue to divide by, or revenue is unknown. */
  netMarginPercent: number | null;
  /** Spends more than the workspace brings in (or more than the flat threshold). */
  isHighCostAlert: boolean;
}

export interface UnitEconomicsInput {
  /** The owner's plan key, as stored (`User.plan` is free text). */
  plan: string | null | undefined;
  /** The owner's region, as stored (`User.region` is a string column). */
  region: unknown;
  /** The live USD→BDT rate the admin set. */
  usdToBdtRate: number;
  /** Summed `AIUsageLog.costUsd` for this workspace. Never a summed `costBdt`. */
  costUsd: number;
}

export function computeUnitEconomics(input: UnitEconomicsInput): UnitEconomics {
  const region: Region = normalizeRegion(input.region);
  const revenue = resolvePlanMonthlyRevenue(input.plan, region, input.usdToBdtRate);

  const costUsd = round(input.costUsd, 4);
  const costBdt = round(input.costUsd * input.usdToBdtRate, 2);

  if (!isUsableRevenue(revenue)) {
    // Revenue is a negotiated figure or an unrecognised plan: the profit and
    // margin questions genuinely have no answer here, so they stay unanswered.
    return {
      revenueBdt: 0,
      revenueBasis: revenue.basis,
      costUsd,
      costBdt,
      netProfitBdt: null,
      netMarginPercent: null,
      isHighCostAlert: costBdt > HIGH_COST_ALERT_BDT,
    };
  }

  const netProfitBdt = round(revenue.revenueBdt - costBdt, 2);

  // Margin needs a revenue to be a share *of*. A free plan (Global Starter's
  // 14-day trial) brings in nothing, so its margin is undefined rather than
  // "−100%": the profit figure above already shows the loss truthfully.
  const netMarginPercent =
    revenue.revenueBdt > 0 ? Math.round((netProfitBdt / revenue.revenueBdt) * 100) : null;

  return {
    revenueBdt: revenue.revenueBdt,
    revenueBasis: revenue.basis,
    costUsd,
    costBdt,
    netProfitBdt,
    netMarginPercent,
    isHighCostAlert:
      revenue.revenueBdt > 0
        ? costBdt > revenue.revenueBdt * HIGH_COST_REVENUE_SHARE
        : costBdt > HIGH_COST_ALERT_BDT,
  };
}

/** Round to `decimals` places, avoiding float noise like `0.30000000000000004`. */
export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
