import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAutomationScope } from "@/lib/automations/access";
import { templateStatusSchema, templateWriteSchema } from "@/lib/automations/schema";

/**
 * GET    /api/automations/templates/[templateId]
 * PATCH  /api/automations/templates/[templateId] — edit, or record WhatsApp status
 * DELETE /api/automations/templates/[templateId]
 *
 * Two payload shapes are accepted, and they are kept apart on purpose:
 * `templateWriteSchema` edits the merchant's own copy, while
 * `templateStatusSchema` records what Meta decided. Merging them would let an
 * ordinary edit claim the template is approved.
 */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;
  const { templateId } = await params;

  try {
    const template = await db.messageTemplate.findFirst({
      where: { templateId, workspaceId: scope.workspaceId },
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json({ template });
  } catch (error) {
    console.error("[AUTOMATION_TEMPLATE_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;
  const { templateId } = await params;

  try {
    const existing = await db.messageTemplate.findFirst({
      where: { templateId, workspaceId: scope.workspaceId },
      // `body` and `waStatus` are read below to decide whether an edit
      // invalidated an existing WhatsApp approval.
      select: { templateId: true, body: true, waStatus: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const body = await req.json();

    if (isStatusOnly(body)) {
      const parsed = templateStatusSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", issues: parsed.error.issues },
          { status: 400 }
        );
      }

      const updated = await db.messageTemplate.update({
        where: { templateId },
        data: {
          waStatus: parsed.data.waStatus,
          waTemplateId: parsed.data.waTemplateId ?? null,
          // Clearing the reason on any non-rejected status: a stale rejection
          // message sitting next to an `approved` badge reads as a bug.
          waRejectedReason:
            parsed.data.waStatus === "rejected" ? (parsed.data.waRejectedReason ?? null) : null,
        },
      });
      return NextResponse.json({ templateId: updated.templateId, waStatus: updated.waStatus });
    }

    const parsed = templateWriteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Editing the text of a template Meta already approved invalidates that
    // approval — the approved artefact is the exact wording that was submitted.
    // Silently keeping the `approved` badge would let a broadcast be scheduled
    // against a template that will be rejected on send, so the status is reset
    // and the merchant is told why.
    const bodyChanged = input.body !== existing.body;
    const resetApproval = bodyChanged && existing.waStatus === "approved";

    const updated = await db.messageTemplate.update({
      where: { templateId },
      data: {
        name: input.name,
        channel: input.channel,
        category: input.category,
        language: input.language,
        body: input.body,
        headerType: input.headerType,
        headerValue: input.headerValue || null,
        buttons: input.buttons as never,
        archived: input.archived,
        ...(resetApproval
          ? { waStatus: "not_submitted", waTemplateId: null, waRejectedReason: null }
          : {}),
      },
    });

    return NextResponse.json({
      templateId: updated.templateId,
      waStatus: updated.waStatus,
      approvalReset: resetApproval,
    });
  } catch (error) {
    console.error("[AUTOMATION_TEMPLATE_PATCH]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;
  const { templateId } = await params;

  try {
    const existing = await db.messageTemplate.findFirst({
      where: { templateId, workspaceId: scope.workspaceId },
      select: { templateId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // A template already queued into a broadcast must not disappear — the send
    // would fail for every recipient with a confusing "template not found".
    // Archiving keeps the reference resolvable while removing it from pickers.
    const inFlight = await db.broadcast.count({
      where: {
        workspaceId: scope.workspaceId,
        templateId,
        status: { in: ["scheduled", "sending"] },
      },
    });
    if (inFlight > 0) {
      return NextResponse.json(
        {
          error: "Template is in use by a scheduled broadcast",
          broadcasts: inFlight,
          hint: "Archive it instead, or cancel those broadcasts first.",
        },
        { status: 409 }
      );
    }

    await db.messageTemplate.delete({ where: { templateId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AUTOMATION_TEMPLATE_DELETE]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** A status-only payload: exactly the keys `templateStatusSchema` owns. */
function isStatusOnly(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const allowed = new Set(["waStatus", "waTemplateId", "waRejectedReason"]);
  const keys = Object.keys(body as Record<string, unknown>);
  return keys.length > 0 && keys.every((key) => allowed.has(key));
}
