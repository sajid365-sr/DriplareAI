/**
 * TASK-15.4 — migrate retired plan keys onto a plan the region actually sells.
 * ─────────────────────────────────────────────────────────────────────────────
 * `User.plan` can hold a key no region in the catalogue defines any more
 * (`growth`, `pro`, `agency`). `getPlan()` then answers with *starter* and every
 * allowance, limit and feature the merchant sees belongs to the wrong plan —
 * while the dashboard keeps printing the retired name. `resolvePlanKeyForRegion`
 * already fixed the *reading* side (১৫.৪); this script fixes the *stored* side,
 * which is the only way the two can ever agree.
 *
 * ── Why it calls `setUserPlan` and does not write the columns itself ─────────
 * The same reason ১৫.৪ deleted `VALID_PLAN_KEYS`: a second implementation of
 * "what a plan change means" is exactly how the `growth` ghost was born. So this
 * script owns only the *discovery* of who needs migrating; the change itself —
 * the credit reset, the `plan_change_admin` audit row, the notification, the
 * chatbot reconciliation — is the same audited function `/admin/workspaces`
 * calls. One writer, not two.
 *
 * ── Nothing happens unless you ask for it ────────────────────────────────────
 * Without `--apply` this is a dry run: it lists who would change, prints what
 * they would change to, and exits. It is also idempotent — after a row is
 * migrated its stored key resolves inside its own region, so `--apply` run again
 * finds nothing to do. That property is checked, not assumed: each candidate is
 * re-read immediately before the write.
 *
 * ── Running it ───────────────────────────────────────────────────────────────
 *     npx tsx --conditions=react-server scripts/task15-migrate-legacy-plans.ts
 *     npx tsx --conditions=react-server scripts/task15-migrate-legacy-plans.ts --apply
 *
 * ⚠️ `--conditions=react-server` is required, not cosmetic: `lib/core/db` and
 *    everything over it begin with `import "server-only"`, whose default entry
 *    point throws. Under the `react-server` condition it resolves to an empty
 *    module — exactly as inside a Next.js server component. Without the flag the
 *    script dies on the first import.
 */

import "dotenv/config";

import { db } from "../lib/core/db";
import { getPlanIfDefined, resolvePlanKeyForRegion } from "../lib/domain/plan-config";
import type { Region } from "../lib/core/region";
import { setUserPlan, type AdminActor } from "../lib/services/admin-credits";

/**
 * Who the audit trail attributes this change to.
 *
 * Deliberately **not** a real admin: no human pressed a button, and a
 * `creditTransaction` row naming a person who did not act is worse than one
 * naming the script. The `system:` prefix is the same convention other
 * machine-originated rows use, so an auditor can filter for it.
 */
const SYSTEM_ACTOR: AdminActor = {
  userId: "system:task15-migrate-legacy-plans",
  email: "system@driplare.invalid",
};

const APPLY = process.argv.includes("--apply");

// ─── Output helpers ───────────────────────────────────────────────────────────
// Plain `console.log`, matching the audit script: this output is meant to be read
// by the person deciding whether the write already went through.

function heading(title: string): void {
  console.log(`\n${"─".repeat(78)}\n${title}\n${"─".repeat(78)}`);
}

function row(label: string, value: unknown): void {
  console.log(`  ${label.padEnd(26)} ${String(value)}`);
}

// ─── Discovery ────────────────────────────────────────────────────────────────

interface Candidate {
  userId: string;
  name: string;
  email: string;
  region: Region;
  storedPlan: string;
  targetPlan: string;
  creditsBalance: number;
  includedCredits: number;
}

/**
 * Everyone whose stored key is not sold in their own region but *is* a retired
 * alias of one that is.
 *
 * A key that resolves to nothing (`UNRESOLVABLE`) is **not** a candidate and is
 * reported separately: guessing a plan for it would be inventing a decision, and
 * the safe direction is to leave the row alone and let a human look at it.
 */
async function findCandidates(): Promise<{
  candidates: Candidate[];
  unresolvable: Array<{ name: string; plan: string; region: Region }>;
}> {
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      userId: true,
      name: true,
      email: true,
      plan: true,
      region: true,
      creditsBalance: true,
      includedCredits: true,
    },
  });

  const candidates: Candidate[] = [];
  const unresolvable: Array<{ name: string; plan: string; region: Region }> = [];

  for (const user of users) {
    const region = (user.region || "bd") as Region;

    // Already correct for this region — the common case, and the reason a second
    // `--apply` is a no-op.
    if (getPlanIfDefined(region, user.plan)) continue;

    const target = resolvePlanKeyForRegion(region, user.plan);
    if (!target) {
      unresolvable.push({ name: user.name, plan: user.plan, region });
      continue;
    }

    candidates.push({
      userId: user.userId,
      name: user.name,
      email: user.email,
      region,
      storedPlan: user.plan,
      targetPlan: target,
      creditsBalance: user.creditsBalance,
      includedCredits: user.includedCredits,
    });
  }

  return { candidates, unresolvable };
}

// ─── The migration ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(
    `TASK-15.4 legacy plan migration — ${APPLY ? "APPLY" : "DRY RUN"} — ${new Date().toISOString()}`
  );

  heading("1. Discovery");

  const { candidates, unresolvable } = await findCandidates();

  if (candidates.length === 0) {
    console.log("  Nothing to migrate — every stored plan key is sold in its own region.");
  }

  for (const candidate of candidates) {
    console.log(`\n  ⚠ ${candidate.name} <${candidate.email}>`);
    row("userId", candidate.userId);
    row("stored / region", `${candidate.storedPlan} @ ${candidate.region}`);
    row("would become", candidate.targetPlan);
    row("balance now", `${candidate.creditsBalance} (included ${candidate.includedCredits})`);
  }

  for (const stuck of unresolvable) {
    console.log(
      `\n  🔴 ${stuck.name} — "${stuck.plan}" @ ${stuck.region} resolves to NOTHING`
    );
    row("action", "skipped — needs a human decision");
  }

  if (!APPLY) {
    heading("Dry run — nothing was written");
    console.log("  Re-run with --apply to perform the changes above.");
    console.log(`  Timestamp: ${new Date().toISOString()}`);
    return;
  }

  // ── The write ───────────────────────────────────────────────────────────────
  heading("2. Applying");

  const results: string[] = [];

  for (const candidate of candidates) {
    // ⚠️ Re-read immediately before writing. Discovery and the write are two
    //    separate round trips, and between them an admin (or another run of this
    //    script) may have changed the row. Migrating on a stale read would mean
    //    showing a human one account and changing another.
    const fresh = await db.user.findUnique({
      where: { userId: candidate.userId },
      select: { plan: true, region: true },
    });

    if (!fresh) {
      console.log(`  ⏭ ${candidate.name} — gone since discovery, skipped`);
      continue;
    }

    const region = (fresh.region || "bd") as Region;

    if (getPlanIfDefined(region, fresh.plan)) {
      console.log(`  ⏭ ${candidate.name} — already "${fresh.plan}" @ ${region}, skipped`);
      continue;
    }

    const target = resolvePlanKeyForRegion(region, fresh.plan);
    if (!target) {
      console.log(`  ⏭ ${candidate.name} — "${fresh.plan}" no longer resolvable, skipped`);
      continue;
    }

    const result = await setUserPlan({
      userId: candidate.userId,
      plan: target,
      reason: `১৫.৪ legacy migration: "${fresh.plan}" is not sold in region "${region}"`,
      admin: SYSTEM_ACTOR,
      // A retired key resolving to a real plan is never a downgrade here, and
      // the pause branch would be wrong even if it were: these are the accounts
      // least able to explain a suddenly-paused chatbot. `setUserPlan` computes
      // the direction itself; this only guarantees no limits are enforced.
      enforceLimits: false,
    });

    console.log(`\n  ✅ ${result.name} <${result.email}>`);
    row("plan", `${result.previousPlan} → ${result.newPlan}`);
    row("direction", result.direction);
    row("included credits", result.newIncludedCredits);
    if (result.pausedChatbots || result.pausedIntegrations) {
      row("paused", `chatbots ${result.pausedChatbots ?? 0} / integrations ${result.pausedIntegrations ?? 0}`);
    }

    results.push(`${result.email}: ${result.previousPlan} → ${result.newPlan}`);
  }

  heading("3. After");
  console.log(
    `  ${results.length} account(s) migrated, ${candidates.length - results.length} skipped.`
  );
  for (const line of results) console.log(`    • ${line}`);
  console.log(`  Timestamp: ${new Date().toISOString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n[task15-migrate-legacy-plans]", error);
    process.exit(1);
  });
