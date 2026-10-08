import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAutomationScope } from "@/lib/automations/access";

/**
 * GET /api/automations/[automationId]/runs — the rule's run log.
 *
 * A rule that never fires is indistinguishable from a rule that fires and is
 * ignored, unless the runs are visible. Each row carries the engine's own
 * outcome list, so the UI can show not just *that* nothing was sent but which
 * condition failed and on what value.
 *
 * Cursor pagination rather than offset: runs are appended continuously, and an
 * offset would shift under the reader between page loads, duplicating or
 * skipping rows on a busy workspace.
 */

const PAGE_SIZE = 25;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ automationId: string }> }
) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;
  const { automationId } = await params;

  try {
    const owned = await db.automation.findFirst({
      where: { automationId, workspaceId: scope.workspaceId },
      select: { automationId: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const status = url.searchParams.get("status");
    const limit = clampLimit(url.searchParams.get("limit"));

    const runs = await db.automationRun.findMany({
      where: {
        automationId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1, // one extra row tells us whether another page exists
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = runs.length > limit;
    const page = hasMore ? runs.slice(0, limit) : runs;

    const [sent, skipped, failed] = await Promise.all([
      db.automationRun.count({ where: { automationId, status: { in: ["sent", "matched"] } } }),
      db.automationRun.count({ where: { automationId, status: "skipped" } }),
      db.automationRun.count({ where: { automationId, status: "failed" } }),
    ]);

    return NextResponse.json({
      runs: page.map((run) => ({
        id: run.id,
        status: run.status,
        skipReason: run.skipReason,
        sessionId: run.sessionId,
        triggerType: run.triggerType,
        // The engine's per-rule verdicts at the time of the run. Shape is
        // enforced by `outcomeSchema` on the way in, so it is safe to hand to
        // the client as-is.
        matchedRules: run.matchedRules,
        actionsResult: run.actionsResult,
        error: run.error,
        creditsSpent: run.creditsSpent,
        createdAt: run.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      totals: { sent, skipped, failed },
    });
  } catch (error) {
    console.error("[AUTOMATION_RUNS]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** A client asking for 10 000 rows is a client about to time out. */
function clampLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return PAGE_SIZE;
  return Math.min(Math.max(parsed, 1), 100);
}
