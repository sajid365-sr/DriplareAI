import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAutomationScope } from "@/lib/automations/access";
import { json } from "@/lib/automations/persist";
import { toAutomationDto, type AutomationRowLike } from "@/lib/automations/dto";

/**
 * POST /api/automations/[automationId]/duplicate
 *
 * Cloning is how merchants actually build a rule set: copy the "Price enquiry"
 * rule, change two keywords, done. Rebuilding it from an empty form is the kind
 * of friction that stops people from ever making a second rule.
 *
 * The copy starts as a `draft` regardless of the original's status. Cloning a
 * live rule straight into `active` would silently double every reply the
 * original sends the moment the merchant pressed the button — the one outcome a
 * "duplicate" button must never produce.
 */

/** Keeps " (Copy)" inside the 120-char limit the write schema enforces. */
const NAME_LIMIT = 120;
const SUFFIX = " (Copy)";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ automationId: string }> }
) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;
  const { automationId } = await params;

  try {
    const source = await db.automation.findFirst({
      where: { automationId, workspaceId: scope.workspaceId },
    });
    if (!source) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    const copy = await db.automation.create({
      data: {
        workspaceId: scope.workspaceId,
        chatbotId: source.chatbotId,
        name: `${source.name.slice(0, NAME_LIMIT - SUFFIX.length)}${SUFFIX}`,
        description: source.description,
        kind: source.kind,
        status: "draft",
        priority: source.priority,
        stopOnMatch: source.stopOnMatch,
        matchMode: source.matchMode,
        triggerType: source.triggerType,
        // The JSON columns are copied verbatim — they came out of the database
        // and are already validated, so re-parsing them would only risk
        // dropping a field the current schema no longer knows about.
        triggerConfig: json(source.triggerConfig),
        conditions: json(source.conditions),
        actions: json(source.actions),
        // `undefined` (not `null`) so an absent graph falls to the column
        // default rather than writing an explicit value the model does not
        // distinguish.
        graph: source.graph === null ? undefined : json(source.graph),
        quietHours: json(source.quietHours),
        frequencyCap: json(source.frequencyCap),
        // `stats` and `lastRunAt` are deliberately NOT copied: the clone has
        // never run, and inheriting the original's counters would make the
        // list page lie about it.
      },
    });

    return NextResponse.json(
      { automation: toAutomationDto(copy as AutomationRowLike) },
      { status: 201 }
    );
  } catch (error) {
    console.error("[AUTOMATION_DUPLICATE]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
