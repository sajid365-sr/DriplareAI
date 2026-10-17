import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/core/db";
import { requireAutomationScope } from "@/lib/automations/access";

/**
 * GET /api/automations/activity — the workspace-wide run log.
 *
 * This is the debugging surface. When a merchant says "my automation stopped
 * working", the answer is in one of three places and this endpoint returns all
 * three in one response:
 *
 *   1. nothing is being evaluated at all  → every run count is zero and
 *      `gateLastSeenAt` is null. On its own that is ambiguous, because a
 *      workspace with no active rules writes no rows either — the engine returns
 *      before it has anything to record. `activeRuleCount` disambiguates: zero
 *      rules means "nothing can fire yet"; rules present means the n8n
 *      `Automation Gate` node was never imported;
 *   2. events arrive but are skipped       → `skipReason` names the cause
 *      (`quiet_hours`, `frequency_cap`, `condition_failed`, `lower_priority`);
 *   3. events are sent but the customer
 *      sees nothing                         → `failed` rows carry the error.
 *
 * Telling those apart from the UI alone is impossible, so they are modelled
 * explicitly here rather than left to be inferred from an empty table.
 */

const RANGES = { "24h": 1, "7d": 7, "30d": 30 } as const;
type RangeKey = keyof typeof RANGES;

const PAGE_SIZE = 50;

export async function GET(req: Request) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;

  try {
    const url = new URL(req.url);
    const range = parseRange(url.searchParams.get("range"));
    const status = url.searchParams.get("status");
    const skipReason = url.searchParams.get("skipReason");
    const automationId = url.searchParams.get("automationId");
    const cursor = url.searchParams.get("cursor");

    const since = new Date(Date.now() - RANGES[range] * 86_400_000);

    // Typed explicitly rather than inferred: this object is assembled from four
    // optional URL filters, and a spread-built literal widens enough that
    // Prisma stops accepting it as a filter for the relation-bearing query
    // below.
    const where: Prisma.AutomationRunWhereInput = {
      workspaceId: scope.workspaceId,
      createdAt: { gte: since },
      ...(status ? { status } : {}),
      ...(skipReason ? { skipReason } : {}),
      // A NULL `automationId` is a run where no rule was involved; asking for
      // one specific rule must not return those.
      ...(automationId ? { automationId } : {}),
    };

    const [runs, grouped, failures, gate, activeRuleCount] = await Promise.all([
      db.automationRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          // The rule may have been deleted since — `onDelete: SetNull` leaves
          // the run behind on purpose, and the UI renders it as "(deleted)".
          automation: { select: { automationId: true, name: true } },
        },
      }),
      db.automationRun.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      db.automationRun.findMany({
        where: { workspaceId: scope.workspaceId, status: "failed", createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, error: true, triggerType: true, createdAt: true, sessionId: true },
      }),
      // The whole workspace, not the filtered range: this answers "has n8n ever
      // called us?", which is a question about history, not about the filter.
      db.automationRun.findFirst({
        where: { workspaceId: scope.workspaceId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      // Whether any rule could fire at all. Without it, a workspace that has not
      // written a rule yet is indistinguishable from one whose gate is broken —
      // see the note at the top of this file.
      db.automation.count({
        where: { workspaceId: scope.workspaceId, status: "active" },
      }),
    ]);

    const hasMore = runs.length > PAGE_SIZE;
    const page = hasMore ? runs.slice(0, PAGE_SIZE) : runs;

    const counts = { sent: 0, skipped: 0, failed: 0, matched: 0, waiting: 0 };
    for (const row of grouped) {
      if (row.status in counts) {
        counts[row.status as keyof typeof counts] = row._count._all;
      }
    }

    return NextResponse.json({
      runs: page.map((run) => ({
        id: run.id,
        automationId: run.automation?.automationId ?? null,
        automationName: run.automation?.name ?? null,
        sessionId: run.sessionId,
        triggerType: run.triggerType,
        status: run.status,
        skipReason: run.skipReason,
        matchedRules: run.matchedRules,
        actionsResult: run.actionsResult,
        error: run.error,
        creditsSpent: run.creditsSpent,
        createdAt: run.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      counts,
      recentFailures: failures.map((failure) => ({
        id: failure.id,
        error: failure.error,
        triggerType: failure.triggerType,
        sessionId: failure.sessionId,
        createdAt: failure.createdAt.toISOString(),
      })),
      gateLastSeenAt: gate?.createdAt.toISOString() ?? null,
      activeRuleCount,
      range,
    });
  } catch (error) {
    console.error("[AUTOMATION_ACTIVITY]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

function parseRange(raw: string | null): RangeKey {
  return raw && raw in RANGES ? (raw as RangeKey) : "7d";
}
