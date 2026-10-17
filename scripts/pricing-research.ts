/**
 * Pricing research — TASK-15.1 (R1–R6).
 * ─────────────────────────────────────────────────────────────────────────────
 * `docs/pricing/pricing-model-analysis.md` was written from the admin panel plus
 * the OpenRouter price list. Two of its inputs were therefore assumptions, not
 * measurements:
 *
 *   1. the token counts of one real reply (4,000 prompt + 300 completion), and
 *   2. what the platform actually bills per reply, per model.
 *
 * `AIUsageLog` has been recording both since TASK-10. This script reads them.
 * Everything it prints is either counted from the database or computed by the
 * same modules production uses (`credit-derivation.ts`, `credit-resolver.ts`,
 * `model-pricing.ts`) — no re-implementation, so the numbers here cannot drift
 * from the numbers the product would charge.
 *
 * ── Read-only, and structurally so ───────────────────────────────────────────
 * Every database call below is `findMany`, `groupBy`, `count` or `aggregate`.
 * There is no `create`, `update`, `upsert` or `delete` in this file, and no raw
 * SQL. It also writes nothing to disk unless `--json` is passed.
 *
 * ── Running it ───────────────────────────────────────────────────────────────
 *     npx tsx --conditions=react-server scripts/pricing-research.ts
 *     npx tsx --conditions=react-server scripts/pricing-research.ts --rows=200000
 *
 * ⚠️ `--conditions=react-server` is required, not cosmetic. `credit-resolver.ts`
 *    and `model-pricing.ts` begin with `import "server-only"`, whose default
 *    entry point throws; under the `react-server` condition it resolves to an
 *    empty module, exactly as it does inside a Next.js server component. Without
 *    the flag the script dies on the first import.
 *
 * Flags: `--rows=N` (row cap per scan, default 50000), `--days=N` (window),
 *        `--json` (also write `docs/pricing/research-output.json`).
 */

import "dotenv/config";

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  DEFAULT_EXPECTED_REPLY_TOKENS,
  DEFAULT_TARGET_BDT_PER_CREDIT,
  deriveModelCredits,
  planCreditUpdate,
  sanitizeTargetBdtPerCredit,
} from "../lib/ai/credit-derivation";
import { getCreditRules } from "../lib/ai/credit-resolver";
import { getPricingSnapshotInfo, resolveModelPrice } from "../lib/ai/model-pricing";
import { db } from "../lib/core/db";
import { percentile } from "../lib/domain/observability";
import { PAID_STATUSES } from "../lib/domain/payment-issues";

// ─── CLI ──────────────────────────────────────────────────────────────────────

function readFlag(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function readNumberFlag(name: string, fallback: number): number {
  const raw = readFlag(name);
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const ROW_LIMIT = readNumberFlag("rows", 50_000);
const WINDOW_DAYS = readFlag("days") ? readNumberFlag("days", 0) : null;
const WRITE_JSON = process.argv.includes("--json");

const SINCE = WINDOW_DAYS ? new Date(Date.now() - WINDOW_DAYS * 86_400_000) : null;

// ─── Output helpers ───────────────────────────────────────────────────────────

function fmtInt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("en-US");
}

function fmtUsd(value: number | null | undefined, digits = 5): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  return `$${value.toFixed(digits)}`;
}

function fmtBdt(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `৳${value.toFixed(digits)}`;
}

function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function heading(title: string): void {
  console.log(`\n${"═".repeat(78)}\n${title}\n${"═".repeat(78)}`);
}

function subheading(title: string): void {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 74 - title.length))}`);
}

function note(text: string): void {
  console.log(`   ⚠️  ${text}`);
}

/** Minimal fixed-width table. Column widths come from the widest cell. */
function printTable(headers: string[], rows: (string | number)[][]): void {
  if (rows.length === 0) {
    console.log("   (no rows)");
    return;
  }

  const cells = rows.map((row) => row.map((cell) => String(cell)));
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...cells.map((row) => (row[index] ?? "").length))
  );

  const line = (row: string[]) =>
    "   " + row.map((cell, index) => cell.padEnd(widths[index])).join("  ");

  console.log(line(headers));
  console.log("   " + widths.map((width) => "─".repeat(width)).join("  "));
  for (const row of cells) console.log(line(row));
}

/** Runs one section; a failure is reported and does not stop the rest. */
async function section<T>(name: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    console.error(`\n❌ ${name} failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// ─── Shared shapes ────────────────────────────────────────────────────────────

interface UsageRow {
  modelId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  llmCallCount: number;
  costUsd: number;
  creditsDeducted: number;
  costSource: string;
  channel: string;
  task: string | null;
  createdAt: Date;
}

/** `modelId` is empty on rows written before the column existed — fall back to `model`. */
function modelKeyOf(row: { modelId: string; model: string }): string {
  return row.modelId?.trim() || row.model?.trim() || "(unknown)";
}

function median(values: number[]): number | null {
  return percentile(values, 50);
}

const USAGE_SELECT = {
  modelId: true,
  model: true,
  promptTokens: true,
  completionTokens: true,
  totalTokens: true,
  llmCallCount: true,
  costUsd: true,
  creditsDeducted: true,
  costSource: true,
  channel: true,
  task: true,
  createdAt: true,
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// R1 — what a real reply costs, per model
// ══════════════════════════════════════════════════════════════════════════════

interface ModelStats {
  modelId: string;
  replies: number;
  exactRows: number;
  costSourceMix: Record<string, number>;
  medianPrompt: number | null;
  medianCompletion: number | null;
  p75Prompt: number | null;
  p75Completion: number | null;
  p90TotalTokens: number | null;
  medianLlmCalls: number | null;
  medianCostUsd: number | null;
  medianCostUsdExact: number | null;
  medianCreditsCharged: number | null;
  totalCostUsd: number;
}

function summariseModel(modelId: string, rows: UsageRow[]): ModelStats {
  const exact = rows.filter((row) => row.costSource === "exact");
  const costBasis = exact.length >= 10 ? exact : rows;

  const costSourceMix: Record<string, number> = {};
  for (const row of rows) costSourceMix[row.costSource] = (costSourceMix[row.costSource] ?? 0) + 1;

  return {
    modelId,
    replies: rows.length,
    exactRows: exact.length,
    costSourceMix,
    medianPrompt: median(costBasis.map((row) => row.promptTokens)),
    medianCompletion: median(costBasis.map((row) => row.completionTokens)),
    p75Prompt: percentile(costBasis.map((row) => row.promptTokens), 75),
    p75Completion: percentile(costBasis.map((row) => row.completionTokens), 75),
    p90TotalTokens: percentile(costBasis.map((row) => row.totalTokens), 90),
    medianLlmCalls: median(rows.map((row) => row.llmCallCount)),
    medianCostUsd: median(rows.map((row) => row.costUsd)),
    medianCostUsdExact: exact.length > 0 ? median(exact.map((row) => row.costUsd)) : null,
    medianCreditsCharged: median(rows.map((row) => row.creditsDeducted)),
    totalCostUsd: rows.reduce((sum, row) => sum + row.costUsd, 0),
  };
}

/**
 * Loads the chat rows to measure.
 *
 * Prefers `task = "chat"`. Rows written before TASK-10 have `task = null`, so if
 * that set is empty the fallback widens to null — and says so, because a token
 * median drawn from pre-gateway rows is a weaker statement than one drawn from
 * gateway rows, and the report must not blur the two.
 */
async function loadChatRows(): Promise<{ rows: UsageRow[]; basis: string; truncated: boolean }> {
  const window = SINCE ? { createdAt: { gte: SINCE } } : {};

  const gateway = await db.aIUsageLog.findMany({
    where: { task: "chat", ...window },
    select: USAGE_SELECT,
    orderBy: { createdAt: "desc" },
    take: ROW_LIMIT + 1,
  });

  if (gateway.length > 0) {
    return {
      rows: gateway.slice(0, ROW_LIMIT),
      basis: 'task = "chat" (gateway rows, trustworthy token counts)',
      truncated: gateway.length > ROW_LIMIT,
    };
  }

  const legacy = await db.aIUsageLog.findMany({
    where: { OR: [{ task: null }, { task: "chat" }], ...window },
    select: USAGE_SELECT,
    orderBy: { createdAt: "desc" },
    take: ROW_LIMIT + 1,
  });

  return {
    rows: legacy.slice(0, ROW_LIMIT),
    basis: "task is null or \"chat\" — no gateway-tagged chat rows found",
    truncated: legacy.length > ROW_LIMIT,
  };
}

async function runR1(): Promise<{ stats: ModelStats[]; suggestedTokens: { prompt: number; completion: number } } | null> {
  return section("R1 — reply cost per model", async () => {
    heading("R1 — what one real reply costs, per model");

    const { rows, basis, truncated } = await loadChatRows();
    console.log(`   Basis:   ${basis}`);
    console.log(`   Rows:    ${fmtInt(rows.length)}${WINDOW_DAYS ? ` (last ${WINDOW_DAYS} days)` : " (all time)"}`);
    if (truncated) {
      note(`Row cap hit at ${fmtInt(ROW_LIMIT)} — this is the most recent slice, not the whole history.`);
      note("Re-run with --rows=200000 if the medians look unrepresentative.");
    }

    if (rows.length === 0) {
      console.log("\n   No usage rows at all. Nothing to measure — every figure below is still an assumption.");
      return { stats: [], suggestedTokens: DEFAULT_EXPECTED_REPLY_TOKENS };
    }

    const dates = rows.map((row) => row.createdAt.getTime());
    console.log(
      `   Window:  ${new Date(Math.min(...dates)).toISOString().slice(0, 10)} → ` +
        `${new Date(Math.max(...dates)).toISOString().slice(0, 10)}`
    );

    const byModel = new Map<string, UsageRow[]>();
    for (const row of rows) {
      const key = modelKeyOf(row);
      const bucket = byModel.get(key);
      if (bucket) bucket.push(row);
      else byModel.set(key, [row]);
    }

    const stats = [...byModel.entries()]
      .map(([modelId, bucket]) => summariseModel(modelId, bucket))
      .sort((a, b) => b.totalCostUsd - a.totalCostUsd);

    subheading("Per-model distribution");
    printTable(
      ["model", "replies", "exact", "med prompt", "p75 prompt", "med compl", "p75 compl", "p90 total", "llmCalls", "med cost", "med charged"],
      stats.map((model) => [
        model.modelId,
        fmtInt(model.replies),
        fmtInt(model.exactRows),
        fmtInt(model.medianPrompt),
        fmtInt(model.p75Prompt),
        fmtInt(model.medianCompletion),
        fmtInt(model.p75Completion),
        fmtInt(model.p90TotalTokens),
        fmtInt(model.medianLlmCalls),
        fmtUsd(model.medianCostUsd),
        fmtInt(model.medianCreditsCharged),
      ])
    );

    subheading("Cost provenance (how trustworthy each row's cost is)");
    printTable(
      ["model", ...["exact", "estimated", "allocated"].map((source) => source)],
      stats.map((model) => [
        model.modelId,
        ...["exact", "estimated", "allocated"].map((source) =>
          model.costSourceMix[source] ? fmtInt(model.costSourceMix[source]) : "—"
        ),
      ])
    );
    note('Rows whose costSource is "estimated" carry an invented token count, so their cost is approximate.');

    // The measured token default for TASK-15.2. p75 rather than median: pricing
    // on the median means half of all replies sell below cost.
    const exactRows = rows.filter((row) => row.costSource === "exact" && row.promptTokens > 0);
    const tokenBasis = exactRows.length >= 20 ? exactRows : rows.filter((row) => row.promptTokens > 0);
    const suggestedTokens = {
      prompt: Math.round(percentile(tokenBasis.map((row) => row.promptTokens), 75) ?? 0),
      completion: Math.round(percentile(tokenBasis.map((row) => row.completionTokens), 75) ?? 0),
    };

    subheading("Token estimate to hand TASK-15.2");
    printTable(
      ["basis", "rows", "p75 prompt", "p75 completion"],
      [
        [
          exactRows.length >= 20 ? 'costSource = "exact"' : "all rows with tokens",
          fmtInt(tokenBasis.length),
          fmtInt(suggestedTokens.prompt),
          fmtInt(suggestedTokens.completion),
        ],
      ]
    );
    console.log(
      `\n   Currently assumed (DEFAULT_EXPECTED_REPLY_TOKENS): ` +
        `${fmtInt(DEFAULT_EXPECTED_REPLY_TOKENS.prompt)} + ${fmtInt(DEFAULT_EXPECTED_REPLY_TOKENS.completion)}`
    );
    console.log(
      `   Measured p75:                                      ` +
        `${fmtInt(suggestedTokens.prompt)} + ${fmtInt(suggestedTokens.completion)}`
    );
    note("Bengali vs English is NOT measurable: AIUsageLog records no language field.");
    note("If the measured prompt count is far above the assumption, every derived credit is too low today.");

    return { stats, suggestedTokens };
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// R1b + R2 — configured credits vs derived, and the target's consequences
// ══════════════════════════════════════════════════════════════════════════════

async function runR1b(measuredModels: ModelStats[], measuredTokens: { prompt: number; completion: number }) {
  return section("R1b — configured vs derived credits", async () => {
    heading("R1b — configured credits vs credits derived from the live price");

    const rules = await getCreditRules();
    const snapshot = await getPricingSnapshotInfo();
    const target = DEFAULT_TARGET_BDT_PER_CREDIT;

    console.log(`   USD → BDT rate (live):  ${rules.usdToBdtRate}`);
    console.log(`   Target BDT/credit:      ${fmtBdt(target, 4)}  (DEFAULT_TARGET_BDT_PER_CREDIT)`);
    console.log(`   Pricing snapshot:       ${snapshot.fetchedAt ? new Date(snapshot.fetchedAt).toISOString() : "none"} · ${snapshot.modelCount ?? 0} models`);
    if (!snapshot.fetchedAt) {
      note("No cached snapshot — resolveModelPrice() will fall back to the hardcoded price, not the real one.");
    }

    const configured = rules.modelCredits;
    const catalogue = Object.keys(configured);

    if (catalogue.length === 0) {
      console.log("\n   No models configured in ai_credit_rules. Nothing to compare.");
      return null;
    }

    // Only models that have actually been used get a measured column; the rest
    // are derived from the price alone, which is still the right answer.
    const measuredByModel = new Map(measuredModels.map((model) => [model.modelId, model]));

    const derived = [];
    for (const modelId of catalogue) {
      const price = await resolveModelPrice(modelId);
      derived.push({
        modelId,
        price,
        est: deriveModelCredits({
          modelId,
          promptPrice: price.promptPrice,
          completionPrice: price.completionPrice,
          usdToBdtRate: rules.usdToBdtRate,
          targetBdtPerCredit: target,
          tokens: measuredTokens,
          // Not cosmetic: a "fallback" price is `model-pricing.ts`'s placeholder,
          // and deriving from it would reprice a model on arithmetic that rests
          // on nothing. `priceUnknown` makes the plan leave those rows alone.
          priceSource: price.source,
        }),
      });
    }

    const plan = planCreditUpdate(configured, derived.map((entry) => entry.est));

    subheading(`Derivation at the measured p75 tokens (${fmtInt(measuredTokens.prompt)} + ${fmtInt(measuredTokens.completion)})`);
    printTable(
      ["model", "src", "prompt $/1M", "compl $/1M", "cost/reply", "CONFIGURED", "DERIVED", "verdict", "measured med"],
      derived.map((entry, index) => {
        const measured = measuredByModel.get(entry.modelId);
        const measuredCredits =
          measured?.medianCostUsd != null
            ? Math.max(1, Math.ceil((measured.medianCostUsd * rules.usdToBdtRate) / target))
            : null;

        return [
          entry.modelId,
          entry.price.source,
          entry.price.promptPrice.toFixed(2),
          entry.price.completionPrice.toFixed(2),
          fmtBdt(entry.est.costBdt),
          fmtInt(configured[entry.modelId]),
          fmtInt(entry.est.credits),
          plan.rows[index].verdict,
          measuredCredits === null ? "no data" : fmtInt(measuredCredits),
        ];
      })
    );

    const mispriced = plan.rows.filter(
      (row) => row.verdict === "needs_review" || row.verdict === "within_threshold"
    );
    const unquotable = derived.filter((entry) => entry.est.priceUnknown);
    console.log(
      `\n   ${fmtInt(mispriced.length)} of ${fmtInt(plan.rows.length)} configured models would change; ` +
        `${fmtInt(plan.needsReview)} cross the ±${Math.round(20)}% review line.`
    );
    if (unquotable.length > 0) {
      subheading("Models OpenRouter could not quote (derivation refuses to touch these)");
      printTable(
        ["model", "CONFIGURED", "derived from the placeholder"],
        unquotable.map((entry) => [
          entry.modelId,
          fmtInt(configured[entry.modelId]),
          fmtInt(entry.est.credits),
        ])
      );
      note("These model IDs are not in the 455-model snapshot, so no real price exists to derive from.");
      note("If a merchant enables one, its cost is unknown — that is a bigger risk than a wrong credit number.");
    }

    // The inversion, stated as a test rather than as a claim: is any model
    // charged fewer credits than a model that costs less to serve? Models without
    // a quoted price are excluded — a placeholder cost cannot order anything.
    const ordered = derived
      .filter((entry) => !entry.est.priceUnknown)
      .sort((a, b) => a.est.costBdt - b.est.costBdt);
    const inversions: string[] = [];
    for (let i = 1; i < ordered.length; i++) {
      const cheaper = ordered[i - 1];
      const dearer = ordered[i];
      const cheaperCredits = configured[cheaper.modelId];
      const dearerCredits = configured[dearer.modelId];
      if (dearerCredits < cheaperCredits) {
        inversions.push(
          `${dearer.modelId} costs ${fmtBdt(dearer.est.costBdt)}/reply and is charged ${dearerCredits}, ` +
            `while ${cheaper.modelId} costs ${fmtBdt(cheaper.est.costBdt)} and is charged ${cheaperCredits}`
        );
      }
    }

    subheading("Inversions in the live configuration");
    if (inversions.length === 0) {
      console.log("   None — every dearer model is charged at least as much as every cheaper one.");
    } else {
      for (const line of inversions) console.log(`   ❌ ${line}`);
      note("Each line above sells a credit for less than it cost. This is the defect TASK-15.2 removes.");
    }

    // R2 — where the allowance sits against the target.
    subheading("Allowance cost at this target");
    printTable(
      ["plan credit bundle", "credits", "cost to platform"],
      [
        ["Starter allowance", fmtInt(15_000), fmtBdt(15_000 * target)],
        ["Business allowance", fmtInt(50_000), fmtBdt(50_000 * target)],
        ["Enterprise allowance", fmtInt(150_000), fmtBdt(150_000 * target)],
      ]
    );

    return { configured, derived, plan, target };
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// R2 — allowance, utilisation and breakage
// ══════════════════════════════════════════════════════════════════════════════

async function runR2() {
  return section("R2 — allowance utilisation and revenue", async () => {
    heading("R2 — what merchants are given, what they use, what they pay");

    const rate = (await getCreditRules()).usdToBdtRate;

    subheading("Users per plan");
    const byPlan = await db.user.groupBy({
      by: ["plan", "region"],
      _count: { _all: true },
      _avg: { includedCredits: true, creditsUsedThisCycle: true, creditsBalance: true },
      _sum: { includedCredits: true, creditsUsedThisCycle: true },
    });

    printTable(
      ["plan", "region", "users", "avg allowance", "avg used this cycle", "utilisation", "credits issued", "credits used"],
      byPlan.map((row) => {
        const issued = row._sum.includedCredits ?? 0;
        const used = row._sum.creditsUsedThisCycle ?? 0;
        return [
          row.plan,
          row.region,
          fmtInt(row._count._all),
          fmtInt(row._avg.includedCredits),
          fmtInt(row._avg.creditsUsedThisCycle),
          fmtPct(issued > 0 ? (used / issued) * 100 : null),
          fmtInt(issued),
          fmtInt(used),
        ];
      })
    );
    note("A low utilisation figure is breakage: credits that were promised, priced into the plan, and never consumed.");

    subheading("Lifetime cost of those allowances if fully used");
    const allPlans = await db.user.groupBy({
      by: ["plan"],
      _count: { _all: true },
      _sum: { includedCredits: true },
    });
    const fullCost = allPlans.reduce(
      (sum, row) => sum + (row._sum.includedCredits ?? 0) * DEFAULT_TARGET_BDT_PER_CREDIT,
      0
    );
    console.log(`   ${fmtBdt(fullCost, 0)} per cycle across ${fmtInt(allPlans.reduce((s, r) => s + r._count._all, 0))} users — the worst case at ${fmtBdt(DEFAULT_TARGET_BDT_PER_CREDIT, 4)}/credit.`);

    subheading("Credit transactions by action");
    const byAction = await db.creditTransaction.groupBy({
      by: ["action_type"],
      _count: { _all: true },
      _sum: { credits_spent: true },
    });
    printTable(
      ["action_type", "transactions", "credits"],
      byAction
        .sort((a, b) => (b._sum.credits_spent ?? 0) - (a._sum.credits_spent ?? 0))
        .map((row) => [row.action_type, fmtInt(row._count._all), fmtInt(row._sum.credits_spent)])
    );

    subheading("Payments received, by package");
    const byPackage = await db.paymentTransaction.groupBy({
      by: ["packageId", "currency"],
      where: { paymentStatus: { in: PAID_STATUSES } },
      _count: { _all: true },
      _sum: { amount: true },
    });
    printTable(
      ["packageId", "currency", "payments", "amount"],
      byPackage.map((row) => [
        row.packageId ?? "(none)",
        row.currency,
        fmtInt(row._count._all),
        fmtInt(row._sum.amount),
      ])
    );
    if (byPackage.length === 0) {
      console.log(`   No payments with status in ${JSON.stringify(PAID_STATUSES)} — this is a pre-revenue dataset.`);
    }

    subheading("Real OpenRouter spend, all time");
    const spend = await db.aIUsageLog.aggregate({
      _sum: { costUsd: true, creditsDeducted: true },
      _count: { _all: true },
    });
    console.log(
      `   ${fmtUsd(spend._sum.costUsd, 4)} (= ${fmtBdt((spend._sum.costUsd ?? 0) * rate, 2)}) ` +
        `across ${fmtInt(spend._count._all)} rows, charging ${fmtInt(spend._sum.creditsDeducted)} credits.`
    );
    note("AIUsageLog covers AI spend only. WhatsApp's Meta per-conversation fee (R5) is metered nowhere.");

    return { byPlan, byAction, byPackage, fullCost };
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// R3 — which features are actually used
// ══════════════════════════════════════════════════════════════════════════════

async function runR3() {
  return section("R3 — feature usage", async () => {
    heading("R3 — which AI features are actually used");

    const rate = (await getCreditRules()).usdToBdtRate;

    subheading("By task (what the model was asked to do)");
    const byTask = await db.aIUsageLog.groupBy({
      by: ["task"],
      _count: { _all: true },
      _sum: { costUsd: true, creditsDeducted: true },
    });
    printTable(
      ["task", "calls", "cost USD", "cost BDT", "credits charged"],
      byTask
        .sort((a, b) => (b._sum.costUsd ?? 0) - (a._sum.costUsd ?? 0))
        .map((row) => [
          row.task ?? "(null — pre-gateway row)",
          fmtInt(row._count._all),
          fmtUsd(row._sum.costUsd),
          fmtBdt((row._sum.costUsd ?? 0) * rate, 2),
          fmtInt(row._sum.creditsDeducted),
        ])
    );

    subheading("By channel (where the customer came from)");
    const byChannel = await db.aIUsageLog.groupBy({
      by: ["channel"],
      _count: { _all: true },
      _sum: { costUsd: true, creditsDeducted: true },
    });
    printTable(
      ["channel", "calls", "cost USD", "cost BDT", "credits charged"],
      byChannel
        .sort((a, b) => (b._sum.costUsd ?? 0) - (a._sum.costUsd ?? 0))
        .map((row) => [
          row.channel,
          fmtInt(row._count._all),
          fmtUsd(row._sum.costUsd),
          fmtBdt((row._sum.costUsd ?? 0) * rate, 2),
          fmtInt(row._sum.creditsDeducted),
        ])
    );

    // Feature gating (TASK-15.3) needs to know which of these are worth gating:
    // a feature nobody uses is not worth a paywall, and one that dominates the
    // bill is not worth giving away.
    subheading("Free messages vs charged");
    const freeMix = await db.aIUsageLog.groupBy({
      by: ["isFreeMessage"],
      _count: { _all: true },
      _sum: { costUsd: true },
    });
    printTable(
      ["isFreeMessage", "calls", "cost USD"],
      freeMix.map((row) => [String(row.isFreeMessage), fmtInt(row._count._all), fmtUsd(row._sum.costUsd)])
    );
    if (freeMix.some((row) => row.isFreeMessage && (row._sum.costUsd ?? 0) > 0)) {
      note("Free messages are costing real money. That is the trial's cost, and it is currently unmetered against it.");
    }

    return { byTask, byChannel, freeMix };
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// R6 — signup → payment conversion
// ══════════════════════════════════════════════════════════════════════════════

async function runR6() {
  return section("R6 — signup to payment conversion", async () => {
    heading("R6 — how many signups ever pay");

    const totalUsers = await db.user.count();
    const paidByUser = await db.paymentTransaction.groupBy({
      by: ["userId"],
      where: { paymentStatus: { in: PAID_STATUSES } },
      _min: { createdAt: true },
      _count: { _all: true },
    });

    const paying = paidByUser.length;
    const conversion = totalUsers > 0 ? (paying / totalUsers) * 100 : null;

    console.log(`   Total users:        ${fmtInt(totalUsers)}`);
    console.log(`   Ever paid:          ${fmtInt(paying)}`);
    console.log(`   Conversion:         ${fmtPct(conversion)}`);
    console.log(`   Never paid:         ${fmtInt(totalUsers - paying)}`);

    if (totalUsers === 0) {
      console.log("\n   No users. The trial's cost cannot be estimated from conversion yet — only from the formula.");
      return { totalUsers, paying, conversion, medianDays: null };
    }

    // How long a trial must be, measured rather than chosen: if payers convert
    // on day 2, a 14-day trial is 12 days of free service.
    const paidUserIds = paidByUser.map((row) => row.userId);
    const users = await db.user.findMany({
      where: { userId: { in: paidUserIds } },
      select: { userId: true, createdAt: true },
    });
    const createdAt = new Map(users.map((user) => [user.userId, user.createdAt]));

    const days: number[] = [];
    for (const row of paidByUser) {
      const signedUp = createdAt.get(row.userId);
      const firstPaid = row._min.createdAt;
      if (!signedUp || !firstPaid) continue;
      days.push((firstPaid.getTime() - signedUp.getTime()) / 86_400_000);
    }

    if (days.length > 0) {
      subheading("Days from signup to first successful payment");
      printTable(
        ["payers", "median", "p75", "p90", "fastest"],
        [
          [
            fmtInt(days.length),
            fmtInt(median(days)),
            fmtInt(percentile(days, 75)),
            fmtInt(percentile(days, 90)),
            fmtInt(Math.min(...days)),
          ],
        ]
      );
      note("A trial longer than the p75 here is free service for three quarters of eventual payers.");
    }

    // The number TASK-15.6 actually needs: how many trials one customer's
    // payment has to cover.
    const revenue = await db.paymentTransaction.aggregate({
      where: { paymentStatus: { in: PAID_STATUSES } },
      _sum: { amount: true },
    });
    if (paying > 0 && conversion && conversion > 0) {
      const trialsPerPayer = 100 / conversion;
      console.log(
        `\n   At ${fmtPct(conversion)} conversion, every paying customer must cover ${trialsPerPayer.toFixed(1)} trials.`
      );
      console.log(
        `   Revenue so far: ${fmtInt(revenue._sum.amount)} — a trial budget is bounded by this, not by hope.`
      );
    }

    return { totalUsers, paying, conversion, medianDays: median(days) };
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Gaps this script cannot close
// ══════════════════════════════════════════════════════════════════════════════

function reportGaps(): string[] {
  heading("Gaps — questions the database cannot answer");
  const gaps = [
    "R4 competitor pricing — external, must be read from their public pages.",
    "R5 WhatsApp Meta per-conversation fee — no column anywhere records it, so every WhatsApp margin figure in the analysis is incomplete.",
    "Language split (Bengali vs English) — AIUsageLog stores no language field.",
    "Whether a merchant's customers are satisfied — no satisfaction signal is recorded anywhere.",
    "Which preset (Fast/Smart/Genius) a reply used — only the resolved modelId is stored.",
  ];
  gaps.forEach((gap, index) => console.log(`   ${index + 1}. ${gap}`));
  return gaps;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Driplare pricing research — TASK-15.1");
  console.log("READ-ONLY: every query below is findMany / groupBy / aggregate / count.");
  console.log(`Row cap ${fmtInt(ROW_LIMIT)}${WINDOW_DAYS ? `, window ${WINDOW_DAYS} days` : ", all time"}`);

  const r1 = await runR1();
  const r1b = await runR1b(r1?.stats ?? [], r1?.suggestedTokens ?? DEFAULT_EXPECTED_REPLY_TOKENS);
  const r2 = await runR2();
  const r3 = await runR3();
  const r6 = await runR6();
  const gaps = reportGaps();

  const output = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    rowLimit: ROW_LIMIT,
    windowDays: WINDOW_DAYS,
    targetBdtPerCredit: sanitizeTargetBdtPerCredit(DEFAULT_TARGET_BDT_PER_CREDIT),
    assumedTokens: DEFAULT_EXPECTED_REPLY_TOKENS,
    measuredTokens: r1?.suggestedTokens ?? null,
    r1: r1?.stats ?? null,
    r1b: r1b
      ? {
          configured: r1b.configured,
          plan: r1b.plan,
          derived: r1b.derived.map((entry) => ({
            modelId: entry.modelId,
            source: entry.price.source,
            promptPrice: entry.price.promptPrice,
            completionPrice: entry.price.completionPrice,
            costBdt: entry.est.costBdt,
            credits: entry.est.credits,
            priceUnknown: entry.est.priceUnknown,
          })),
        }
      : null,
    r2: r2
      ? { byPlan: r2.byPlan, byAction: r2.byAction, byPackage: r2.byPackage, fullAllowanceCostBdt: r2.fullCost }
      : null,
    r3: r3 ? { byTask: r3.byTask, byChannel: r3.byChannel, freeMix: r3.freeMix } : null,
    r6: r6 ?? null,
    gaps,
  };

  if (WRITE_JSON) {
    const path = join(process.cwd(), "docs", "pricing", "research-output.json");
    writeFileSync(path, JSON.stringify(output, null, 2), "utf8");
    console.log(`\n📄 Wrote ${path}`);
  }

  console.log("\nDone. No database rows were written.\n");
}

main()
  .catch((error) => {
    console.error("\n❌ Research failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
