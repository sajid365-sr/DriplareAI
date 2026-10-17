/**
 * TASK-15.1 then 15.4 — read-only measurement before any plan key is changed.
 * ─────────────────────────────────────────────────────────────────────────────
 * Why this exists: ১৫.৪ will move every merchant whose `User.plan` is a retired
 * key (`growth`, `pro`, `agency`) onto a plan this region actually sells. That is
 * a **write**, and it is not a cosmetic one — `setUserPlan`'s upgrade branch sets
 * `creditsBalance` to the target plan's allowance, so a merchant's balance can
 * change. Before asking for permission to do that, the actual state of those
 * accounts has to be visible rather than assumed.
 *
 * ── Read-only, and structurally so ───────────────────────────────────────────
 * Every database call below is `findMany`, `groupBy`, `aggregate` or `count`.
 * There is no `create`, `update`, `upsert` or `delete` in this file, and no raw
 * SQL. It writes nothing to disk.
 *
 * ── Running it ───────────────────────────────────────────────────────────────
 *     npx tsx --conditions=react-server scripts/task15-migration-audit.ts
 *
 * ⚠️ `--conditions=react-server` is required, not cosmetic: `lib/core/db` and
 *    everything over it begin with `import "server-only"`, whose default entry
 *    point throws. Under the `react-server` condition it resolves to an empty
 *    module — exactly as inside a Next.js server component. Without the flag the
 *    script dies on the first import.
 */

import "dotenv/config";

import { db } from "../lib/core/db";
import { PAID_STATUSES } from "../lib/domain/payment-status";
import { getPlanIfDefined, resolvePlanKeyForRegion } from "../lib/domain/plan-config";
import type { Region } from "../lib/core/region";

// ─── Output helpers ───────────────────────────────────────────────────────────
// Plain `console.log` on purpose: this is meant to be pasted into a message and
// read by a human deciding whether to approve a write.

function heading(title: string): void {
  console.log(`\n${"─".repeat(78)}\n${title}\n${"─".repeat(78)}`);
}

function row(label: string, value: unknown): void {
  console.log(`  ${label.padEnd(26)} ${String(value)}`);
}

function taka(amount: number): string {
  return `৳${amount.toLocaleString("en-US")}`;
}

function iso(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "—";
}

// ─── The audit ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const now = new Date();
  console.log(`TASK-15 legacy audit — read-only — ${now.toISOString()}`);

  // ── 1. Users, grouped by plan + region ─────────────────────────────────────
  // `groupBy` on the raw column, deliberately: the point is to see what the
  // database actually holds, including keys no region sells any more.
  heading("1. Users by plan × region");

  const userGroups = await db.user.groupBy({
    by: ["plan", "region"],
    _count: { _all: true },
    _sum: { creditsBalance: true, includedCredits: true, creditsUsedThisCycle: true },
  });

  let totalUsers = 0;
  for (const group of userGroups) {
    const region = (group.region || "bd") as Region;
    const plan = String(group.plan ?? "");
    const count = group._count._all;
    totalUsers += count;

    const known = getPlanIfDefined(region, plan);
    const resolved = resolvePlanKeyForRegion(region, plan);

    // ⚠️ The interesting column is the last one. `getPlan("bd", "growth")`
    //    silently answers with *starter*, so an unresolved key here means every
    //    allowance, limit and feature the merchant sees is the wrong plan's.
    const verdict = known
      ? "OK"
      : resolved
        ? `RETIRED → ${resolved}`
        : "UNRESOLVABLE";

    console.log(
      `\n  ${plan || "(empty)"} @ ${region}   ×${count}   [${verdict}]`
    );
    row("credit balance", group._sum.creditsBalance ?? 0);
    row("included credits", group._sum.includedCredits ?? 0);
    row("used this cycle", group._sum.creditsUsedThisCycle ?? 0);
    if (!known) {
      row("region sells this?", "no");
      row(
        "silent fallback",
        `getPlan() → ${getPlanIfDefined(region, "starter")?.includedCredits ?? 0} credits (starter)`
      );
    }
  }

  row("TOTAL USERS", totalUsers);

  // ── 2. Every user, individually ────────────────────────────────────────────
  // Counted above, listed here: a group total is not a decision. The verdict on
  // each row is whether that account's stored key resolves in its own region.
  heading("2. Every user individually");

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
      creditsUsedThisCycle: true,
      creditsResetDate: true,
      planExpiresAt: true,
      scheduledDowngradePlan: true,
      scheduledDowngradeAt: true,
      createdAt: true,
    },
  });

  if (users.length === 0) {
    console.log("  (no users)");
  }

  for (const user of users) {
    const region = (user.region || "bd") as Region;
    const known = getPlanIfDefined(region, user.plan);
    const resolved = resolvePlanKeyForRegion(region, user.plan);
    const flag = known ? " " : resolved ? "⚠" : "🔴";

    console.log(`\n  ${flag} ${user.name} <${user.email}>`);
    row("userId", user.userId);
    row("plan / region", `${user.plan} @ ${region}`);
    if (!known) {
      row("would migrate to", resolved ?? "NOTHING — needs a human");
    }
    row("credit balance", `${user.creditsBalance} (included ${user.includedCredits})`);
    row("used this cycle", user.creditsUsedThisCycle);
    row("creditsResetDate", iso(user.creditsResetDate));
    row("planExpiresAt", iso(user.planExpiresAt));
    row(
      "scheduled downgrade",
      user.scheduledDowngradePlan
        ? `${user.scheduledDowngradePlan} @ ${iso(user.scheduledDowngradeAt)}`
        : "—"
    );
    row("signed up", iso(user.createdAt));
  }

  // ── 3. Connected channels, per user ───────────────────────────────────────
  // This is the section that decides whether ১৫.৪ is safe. Moving a merchant
  // from `growth` down to `starter` would revoke WhatsApp/Instagram — so the
  // migration target has to be a plan that still permits every channel that is
  // actually connected. Printed as the raw platform slugs, not as a count.
  heading("3. Connected channels per user");

  const connected = await db.integration.findMany({
    where: { connected: true },
    select: {
      platform: true,
      status: true,
      connectedAt: true,
      chatbot: { select: { userId: true, name: true, status: true } },
    },
    orderBy: { connectedAt: "asc" },
  });

  const byUser = new Map<string, string[]>();
  for (const integration of connected) {
    const owner = integration.chatbot.userId;
    const label = `${integration.platform}${integration.status !== "active" ? `(${integration.status})` : ""}`;
    byUser.set(owner, [...(byUser.get(owner) ?? []), label]);
  }

  if (byUser.size === 0) {
    console.log("  (no connected channels)");
  }
  for (const user of users) {
    const channels = byUser.get(user.userId) ?? [];
    console.log(`  ${user.name.padEnd(22)} ${channels.length ? channels.join(", ") : "— none —"}`);
  }

  // ── 4. Payments, grouped ───────────────────────────────────────────────────
  // ১৫.৯'s whole rule is "has this user ever paid for a plan", so the two things
  // that matter here are `kind` (a top-up is not a plan purchase) and
  // `refundStatus` (money that came back is not money we have).
  heading("4. Payments by kind × status × refund × currency");

  const paymentGroups = await db.paymentTransaction.groupBy({
    by: ["kind", "paymentStatus", "refundStatus", "currency"],
    _count: { _all: true },
    _sum: { amount: true },
  });

  if (paymentGroups.length === 0) {
    console.log("  (no payments)");
  }
  for (const group of paymentGroups) {
    const isPlan = group.kind === "plan" || group.kind === "invoice_plan";
    const countsAsPaid =
      PAID_STATUSES.includes(group.paymentStatus) && group.refundStatus !== "refunded";
    console.log(
      `\n  ${group.kind} / ${group.paymentStatus} / refund=${group.refundStatus ?? "—"} / ${group.currency}`
    );
    row("count", group._count._all);
    row("sum", `${group._sum.amount ?? 0} ${group.currency}`);
    row("counts as plan revenue?", isPlan && countsAsPaid ? "yes" : "no");
  }

  // ── 5. Who ১৫.৯ will grant to ─────────────────────────────────────────────
  // The reset cron's answer, computed by the same predicate it uses. A merchant
  // with a plan payment is renewed; everyone else's clock advances and their
  // balance is left alone.
  heading("5. Reset eligibility preview (১৫.৯ — read-only)");

  const { isResetEligible } = await import("../lib/domain/reset-eligibility");

  const paidRows =
    users.length === 0
      ? []
      : await db.paymentTransaction.groupBy({
          by: ["userId", "refundStatus"],
          where: {
            userId: { in: users.map((user) => user.userId) },
            paymentStatus: { in: PAID_STATUSES },
            kind: { in: ["plan", "invoice_plan"] },
          },
        });

  const paid = new Set<string>();
  const refunded = new Set<string>();
  for (const payment of paidRows) {
    if (payment.refundStatus === "refunded") refunded.add(payment.userId);
    else paid.add(payment.userId);
  }

  for (const user of users) {
    const region = (user.region || "bd") as Region;
    const verdict = isResetEligible({
      plan: user.plan,
      region,
      hasPaidPlanPayment: paid.has(user.userId),
      hasRefundedPayment: refunded.has(user.userId),
      planExpiresAt: user.planExpiresAt,
      now,
    });

    console.log(
      `  ${verdict.eligible ? "✅" : "⛔"} ${user.name.padEnd(22)} ${user.plan} @ ${region}` +
        `   → ${verdict.reason}` +
        `   (expires ${user.planExpiresAt ? user.planExpiresAt.toISOString().slice(0, 10) : "—"})`
    );
  }

  // ── 5b. The ১৫.৭ deploy gate ──────────────────────────────────────────────
  // ১৫.৭ made renewal period-based: a paid merchant whose `planExpiresAt` has
  // already passed stops being renewed. That is the intended behaviour, but it
  // is a behaviour CHANGE for anyone already in that state — so the list is
  // printed here, before deploy, and nobody flips the rule without seeing it.
  //
  // "Already past" is the interesting set, not "will eventually expire": the
  // latter is every paying merchant, which is the whole point of the rule.
  heading("5b. 🔴 Already-expired payers (১৫.৭ deploy gate — read-only)");

  // ⚠️ `main()`-এর শুরুতে নেওয়া একটিই `now` ব্যবহার করা হয় — এই সেকশনের জন্য
  //    নতুন করে সময় না নিয়ে। কারণ একই রিপোর্টের দুই অংশ দুই মুহূর্তের সময়
  //    নিলে "eligibility"-র উত্তর ও "কত দিন পার হয়েছে"-র হিসাব আলাদা ঘড়িতে
  //    হত, অর্থাৎ সীমানার ঠিক উপরে থাকা একটি account এক অংশে ✅ আর অন্য অংশে ⛔
  //    দেখাত।
  const expiredPayers = users.filter(
    (user) =>
      paid.has(user.userId) &&
      user.planExpiresAt !== null &&
      user.planExpiresAt.getTime() <= now.getTime()
  );

  if (expiredPayers.length === 0) {
    console.log("  ✅ none — every paying merchant has a live period.");
    console.log("     Flipping ১৫.৭ changes nothing for anyone today.");
  } else {
    console.log(`  ⚠️  ${expiredPayers.length} paying merchant(s) would stop renewing:`);
    for (const user of expiredPayers) {
      const daysPast = Math.floor(
        (now.getTime() - (user.planExpiresAt as Date).getTime()) / 86_400_000
      );
      console.log(
        `  ⛔ ${user.name.padEnd(22)} ${user.plan} @ ${(user.region || "bd").padEnd(6)}` +
          `   expired ${daysPast} day(s) ago` +
          `   balance ${user.creditsBalance.toLocaleString()}`
      );
    }
    console.log("");
    console.log("  ⚠️  এই তালিকা ইউজারকে দেখিয়ে অনুমতি নিতে হবে — তাঁদের মেয়াদ");
    console.log("     এগিয়ে দেব, নাকি ছেড়ে দেব, সেটি এই তালিকা দেখেই ঠিক হবে।");
  }

  heading("Done — nothing was written");
  console.log(`  Every query above was a read. Timestamp: ${new Date().toISOString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n[task15-migration-audit]", error);
    process.exit(1);
  });
