import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAutomationScope } from "@/lib/automations/access";
import { json } from "@/lib/automations/persist";
import { templateWriteSchema } from "@/lib/automations/schema";

/**
 * GET  /api/automations/templates — the workspace's message templates
 * POST /api/automations/templates — create one
 *
 * Templates exist for one reason: WhatsApp will not deliver a
 * business-initiated message that is not an approved template. A merchant who
 * writes a broadcast as free text will have it silently rejected for every
 * recipient outside the 24-hour service window — which is most of them.
 *
 * So a template is the same message in two forms: free text on Messenger and
 * the web widget, and an approval-tracked object on WhatsApp. `waStatus`
 * carries the difference, and the UI refuses to schedule a WhatsApp broadcast
 * on anything but an `approved` template.
 */

export async function GET(req: Request) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;

  try {
    const url = new URL(req.url);
    const channel = url.searchParams.get("channel");
    const search = url.searchParams.get("q")?.trim();
    // Archived templates stay out of the pickers but are still reachable, so a
    // broadcast that already referenced one keeps rendering its name.
    const includeArchived = url.searchParams.get("archived") === "true";

    const templates = await db.messageTemplate.findMany({
      where: {
        workspaceId: scope.workspaceId,
        ...(includeArchived ? {} : { archived: false }),
        ...(channel && channel !== "all"
          ? { OR: [{ channel }, { channel: "all" }] }
          : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { body: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ archived: "asc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({
      templates: templates.map((template) => ({
        templateId: template.templateId,
        name: template.name,
        channel: template.channel,
        category: template.category,
        language: template.language,
        body: template.body,
        headerType: template.headerType,
        headerValue: template.headerValue,
        buttons: template.buttons,
        waStatus: template.waStatus,
        waTemplateId: template.waTemplateId,
        waRejectedReason: template.waRejectedReason,
        archived: template.archived,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[AUTOMATION_TEMPLATES_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;

  try {
    const parsed = templateWriteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const template = await db.messageTemplate.create({
      data: {
        workspaceId: scope.workspaceId,
        name: input.name,
        channel: input.channel,
        category: input.category,
        language: input.language,
        body: input.body,
        headerType: input.headerType,
        headerValue: input.headerValue || null,
        buttons: json(input.buttons),
        archived: input.archived,
        // Never taken from the request — see `templateStatusSchema`.
        waStatus: "not_submitted",
      },
    });

    return NextResponse.json({ templateId: template.templateId }, { status: 201 });
  } catch (error) {
    console.error("[AUTOMATION_TEMPLATES_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
