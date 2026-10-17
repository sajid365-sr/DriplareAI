/**
 * Plan revenue — the one place that answers "what does this plan actually earn?"
 *
 * ── Why this module exists ────────────────────────────────────────────────────
 * Two admin routes grew their own copy of a hardcoded revenue table:
 *
 *     { starter: 0, growth: 2990, pro: 7990, agency: 14990, enterprise: 19900 }
 *
 * That table was wrong on both axes. `growth`, `pro` and `agency` are not
 * billing plans in this product at all, and the prices it carried do not match
 * `plan-config.ts` — where the real Bangladesh plans are `starter` (৳999),
 * `business` (৳2,499) and `enterprise` (৳4,999). It also ignored the region,
 * although the Global plans are priced in USD. Every net-profit and margin
 * figure an admin has read from those screens was therefore fiction.
 *
 * That is the same class of failure TASK-06 removed from the health panel: a
 * number an operator trusts must be measured, not invented. So revenue is now
 * derived from the plan catalogue — the single source of truth that also drives
 * the pricing page and the payment flow — and it is derived per region.
 *
 * ── Why it is a separate, pure module ─────────────────────────────────────────
 * No database, no `server-only`, no network: just a lookup and a multiplication.
 * It lives in `lib/domain/` so it can be unit-tested, and so both admin routes
 * and the observability service read the same rule instead of each deriving it.
 */

import type { Region } from "@/lib/core/region";
import { getPlansForRegion, type PlanConfig } from "@/lib/domain/plan-config";

/**
 * Where a revenue figure came from.
 *
 *   `plan`    — a real plan in this region's catalogue priced it.
 *   `custom`  — the plan is sold by negotiation (`contact: true`, e.g. Global
 *               Enterprise, whose priceLabel is literally "Custom"). There is
 *               no number to read, and saying `0` would claim it is free.
 *   `unknown` — the plan key is not in this region's catalogue, or the currency
 *               rate we would need to convert it is missing. `0` here would be
 *               a lie of a different kind: it would inflate the margin to 100%.
 */
export type RevenueBasis = "plan" | "custom" | "unknown";

export interface PlanRevenue {
  /** Monthly revenue in BDT. Genuinely `0` only when `basis` is `"plan"`. */
  revenueBdt: number;
  basis: RevenueBasis;
  /** The catalogue entry that priced this, when one was found. */
  plan: PlanConfig | null;
}

/**
 * Monthly revenue one workspace's plan brings in, expressed in BDT.
 *
 * Bangladesh plans are already priced in BDT, so their price is taken as-is.
 * Global plans are priced in USD and converted with the live rate the admin
 * controls in `/admin/ai-settings` — the same rate the AI cost side uses, so
 * revenue and cost in one margin calculation come from one currency basis.
 *
 * ⚠️ Deliberately **not** `getPlan()` from `plan-config.ts`. That helper falls
 *    back to `plans[0]` (Starter) when a key is missing, which would silently
 *    reprice an unrecognised plan as the cheapest one — trading one wrong number
 *    for another. Here a missing key is reported as missing.
 */
export function resolvePlanMonthlyRevenue(
  plan: string | null | undefined,
  region: Region,
  usdToBdtRate: number,
): PlanRevenue {
  const key = String(plan ?? "").trim().toLowerCase();
  const planConfig = getPlansForRegion(region).find((candidate) => candidate.key === key);

  if (!planConfig) {
    return { revenueBdt: 0, basis: "unknown", plan: null };
  }

  // "Custom" pricing has no number. Reporting it as `plan` with a price of zero
  // would read as "this customer pays nothing", which is not what contact-sales
  // means — it means we do not know from here.
  if (planConfig.contact === true) {
    return { revenueBdt: 0, basis: "custom", plan: planConfig };
  }

  if (region === "bd") {
    return { revenueBdt: round2(planConfig.price), basis: "plan", plan: planConfig };
  }

  // Global plans are USD. Without a usable rate the conversion would be
  // meaningless, so the figure is withheld rather than guessed.
  if (!Number.isFinite(usdToBdtRate) || usdToBdtRate <= 0) {
    return { revenueBdt: 0, basis: "unknown", plan: planConfig };
  }

  return { revenueBdt: round2(planConfig.price * usdToBdtRate), basis: "plan", plan: planConfig };
}

/**
 * Whether a revenue figure may be used in a margin calculation.
 *
 * A custom-priced or unrecognised plan has no revenue to subtract a cost from.
 * Adding it as `0` would make that workspace look like pure loss, and adding an
 * invented number would make it look profitable — both are worse than saying
 * "not counted", which is why callers are given this predicate instead of a
 * bare `0` to interpret.
 */
export function isUsableRevenue(revenue: PlanRevenue): boolean {
  return revenue.basis === "plan";
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
