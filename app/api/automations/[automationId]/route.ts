import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { assertChatbotInScope, requireAutomationScope } from "@/lib/automations/access";
import { automationStatusSchema, automationWriteSchema, RUN_STATUS_SENT } from "@/lib/automations/schema";
import { toUpdateData } from "@/lib/automations/persist";
import { toAutomationDto, type AutomationRowLike } from "@/lib/automations/dto";

/**
 * GET    /api/automations/[automationId] — one rule
 * PATCH  /api/automations/[automationId] — replace it
 * DELETE /api/automations/[automationId] — remove it, along with its run log
 *
 * PATCH takes the *whole* rule, not a diff. The schema couples fields to each
 * other (a `flow` must carry a graph, a `rule` must carry actions), and a
 * partial merge could satisfy each half of that invariant while breaking it as
 * a whole. The rule builder always submits the full object anyway, so the only
 * thing a diff would buy is a class of bug.
 *
 * The single exception is the enable/disable toggle, which sends nothing but
 * `status` — see `statusOnlySchema`.
 */

/** The list page's toggle: one field, and no reason to resend the whole rule. */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ automationId: string }> }
) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;
  const { automationId } = await params;

  try {
    const rule = await db.automation.findFirst({
      where: { automationId, workspaceId: scope.workspaceId },
    });
    if (!rule) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    const [runsToday, sentToday, runsTotal, newest] = await Promise.all([
      db.automationRun.count({
        where: { automationId, createdAt: { gte: startOfToday() } },
      }),
      db.automationRun.count({
        where: { automationId, createdAt: { gte: startOfToday() }, status: RUN_STATUS_SENT },
      }),
      db.automationRun.count({ where: { automationId } }),
      db.automationRun.findFirst({
        where: { automationId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    return NextResponse.json({
      automation: toAutomationDto(rule as AutomationRowLike, {
        runsToday,
        sentToday,
        runsTotal,
        lastRunAt: newest?.createdAt.toISOString() ?? null,
      }),
    });
  } catch (error) {
    console.error("[AUTOMATION_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ automationId: string }> }
) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;
  const { automationId } = await params;

  try {
    const existing = await db.automation.findFirst({
      where: { automationId, workspaceId: scope.workspaceId },
      select: { automationId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    const body = await req.json();

    // The toggle path: `{ status }` and nothing else.
    if (isStatusOnly(body)) {
      const parsedStatus = automationStatusSchema.safeParse(body);
      if (!parsedStatus.success) {
        return NextResponse.json(
          { error: "Validation failed", issues: parsedStatus.error.issues },
          { status: 400 }
        );
      }

      const updated = await db.automation.update({
        where: { automationId },
        data: { status: parsedStatus.data.status },
      });
      return NextResponse.json({ automation: toAutomationDto(updated as AutomationRowLike) });
    }

    const parsed = automationWriteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const invalidBot = assertChatbotInScope(scope, parsed.data.chatbotId);
    if (invalidBot) return invalidBot;

    const updated = await db.automation.update({
      where: { automationId },
      data: toUpdateData(parsed.data),
    });

    return NextResponse.json({ automation: toAutomationDto(updated as AutomationRowLike) });
  } catch (error) {
    console.error("[AUTOMATION_PATCH]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ automationId: string }> }
) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;
  const { automationId } = await params;

  try {
    const existing = await db.automation.findFirst({
      where: { automationId, workspaceId: scope.workspaceId },
      select: { automationId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    // `AutomationRun.automationId` is `onDelete: SetNull`, so the history has
    // to be cleared explicitly. Leaving it would leave orphaned rows that the
    // Activity Log renders as blanks — worse than losing the history of a rule
    // the merchant deliberately deleted.
    await db.$transaction([
      db.automationRun.deleteMany({ where: { automationId } }),
      db.automation.delete({ where: { automationId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AUTOMATION_DELETE]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** `{ status: "active" }` — and nothing else. */
function isStatusOnly(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const keys = Object.keys(body as Record<string, unknown>);
  return keys.length === 1 && keys[0] === "status";
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}
