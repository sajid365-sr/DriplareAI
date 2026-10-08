import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { assertChatbotInScope, requireAutomationScope } from "@/lib/automations/access";
import { automationWriteSchema, RUN_STATUS_SENT } from "@/lib/automations/schema";
import { toCreateData } from "@/lib/automations/persist";
import {
  toAutomationDto,
  type AutomationRowLike,
  type AutomationRunStats,
} from "@/lib/automations/dto";

/**
 * GET  /api/automations — the rules list.
 * POST /api/automations — create a rule.
 *
 * Both are scoped to the workspace resolved from the `driplare_workspace`
 * cookie; nothing here accepts a workspace id from the client.
 */

export async function GET(req: Request) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;

  try {
    const url = new URL(req.url);
    const chatbotId = url.searchParams.get("chatbotId");
    const kind = url.searchParams.get("kind");
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("q")?.trim();

    const rows = await db.automation.findMany({
      where: {
        workspaceId: scope.workspaceId,
        ...(chatbotId ? { OR: [{ chatbotId: null }, { chatbotId }] } : {}),
        ...(kind ? { kind } : {}),
        ...(status ? { status } : {}),
        ...(search
          ? {
              AND: [
                {
                  OR: [
                    { name: { contains: search, mode: "insensitive" as const } },
                    { description: { contains: search, mode: "insensitive" as const } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    });

    const stats = await loadRunStats(scope.workspaceId);
    const activeRules = await db.automation.count({
      where: { workspaceId: scope.workspaceId, status: "active" },
    });

    // The Gate is a node the merchant pastes into n8n by hand, so the most
    // likely reason "nothing happens" is that it was never imported. Reporting
    // the newest evaluation lets the UI say that plainly instead of leaving the
    // merchant to guess.
    const newestRun = await db.automationRun.findFirst({
      where: { workspaceId: scope.workspaceId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    // Page-level counters, computed across the whole workspace rather than from
    // `rows`. The list below can be narrowed by a search box or an agent
    // filter, and a KPI that drops to "3 active rules" because someone typed a
    // letter into the search field would be actively misleading.
    const totals = { activeRules, runsToday: 0, sentToday: 0 };
    for (const entry of stats.values()) {
      totals.runsToday += entry.runsToday;
      totals.sentToday += entry.sentToday;
    }

    return NextResponse.json({
      automations: rows.map((row) =>
        toAutomationDto(row as AutomationRowLike, stats.get(row.automationId) ?? zeroStats())
      ),
      gateLastSeenAt: newestRun?.createdAt.toISOString() ?? null,
      totals,
    });
  } catch (error) {
    console.error("[AUTOMATIONS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;

  try {
    const body = await req.json();
    const parsed = automationWriteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const invalidBot = assertChatbotInScope(scope, parsed.data.chatbotId);
    if (invalidBot) return invalidBot;

    const rule = await db.automation.create({
      data: toCreateData(parsed.data, scope.workspaceId),
    });

    return NextResponse.json(
      { automation: toAutomationDto(rule as AutomationRowLike) },
      { status: 201 }
    );
  } catch (error) {
    console.error("[AUTOMATIONS_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * Per-rule run counts for the list page, in a handful of grouped queries rather
 * than several per rule.
 */
async function loadRunStats(workspaceId: string): Promise<Map<string, AutomationRunStats>> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [totals, todays, sentTodays, newest] = await Promise.all([
    db.automationRun.groupBy({
      by: ["automationId"],
      where: { workspaceId, automationId: { not: null } },
      _count: { _all: true },
    }),
    db.automationRun.groupBy({
      by: ["automationId"],
      where: { workspaceId, automationId: { not: null }, createdAt: { gte: startOfDay } },
      _count: { _all: true },
    }),
    db.automationRun.groupBy({
      by: ["automationId"],
      where: {
        workspaceId,
        automationId: { not: null },
        createdAt: { gte: startOfDay },
        status: RUN_STATUS_SENT,
      },
      _count: { _all: true },
    }),
    db.automationRun.groupBy({
      by: ["automationId"],
      where: { workspaceId, automationId: { not: null } },
      _max: { createdAt: true },
    }),
  ]);

  const stats = new Map<string, AutomationRunStats>();

  const ensure = (id: string): AutomationRunStats => {
    const existing = stats.get(id);
    if (existing) return existing;
    const created = zeroStats();
    stats.set(id, created);
    return created;
  };

  for (const row of totals) {
    if (row.automationId) ensure(row.automationId).runsTotal = row._count._all;
  }
  for (const row of todays) {
    if (row.automationId) ensure(row.automationId).runsToday = row._count._all;
  }
  for (const row of sentTodays) {
    if (row.automationId) ensure(row.automationId).sentToday = row._count._all;
  }
  for (const row of newest) {
    if (row.automationId) {
      ensure(row.automationId).lastRunAt = row._max.createdAt?.toISOString() ?? null;
    }
  }

  return stats;
}

function zeroStats(): AutomationRunStats {
  return { runsToday: 0, sentToday: 0, runsTotal: 0, lastRunAt: null };
}
