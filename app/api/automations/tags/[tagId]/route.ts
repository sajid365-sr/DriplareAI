import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAutomationScope } from "@/lib/automations/access";
import { tagWriteSchema } from "@/lib/automations/schema";

/**
 * PATCH  /api/automations/tags/[tagId] — rename or recolour
 * DELETE /api/automations/tags/[tagId] — remove, and detach it everywhere
 *
 * Deleting a tag does not touch the conversations that carried it. The
 * `SessionTag` rows cascade away, which is the correct outcome: the tag is a
 * label, and removing the label must not remove the conversation it was on.
 */

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tagId: string }> }
) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;
  const { tagId } = await params;

  try {
    const existing = await db.contactTag.findFirst({
      where: { tagId, workspaceId: scope.workspaceId },
      select: { tagId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    const parsed = tagWriteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const clash = await db.contactTag.findFirst({
      where: {
        workspaceId: scope.workspaceId,
        name: parsed.data.name,
        tagId: { not: tagId },
      },
      select: { tagId: true },
    });
    if (clash) {
      return NextResponse.json({ error: "A tag with that name already exists" }, { status: 409 });
    }

    const tag = await db.contactTag.update({
      where: { tagId },
      data: { name: parsed.data.name, color: parsed.data.color },
    });

    return NextResponse.json({
      tag: {
        tagId: tag.tagId,
        name: tag.name,
        color: tag.color,
        createdAt: tag.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[AUTOMATION_TAG_PATCH]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ tagId: string }> }
) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;
  const { tagId } = await params;

  try {
    const existing = await db.contactTag.findFirst({
      where: { tagId, workspaceId: scope.workspaceId },
      select: { tagId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Rules that referenced this tag are left alone on purpose. Rewriting a
    // merchant's rule behind their back — silently dropping an `add_tag` step —
    // produces an automation that no longer matches what its own summary says.
    // The rules list surfaces a broken reference instead, so it can be fixed
    // deliberately.
    await db.contactTag.delete({ where: { tagId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AUTOMATION_TAG_DELETE]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
