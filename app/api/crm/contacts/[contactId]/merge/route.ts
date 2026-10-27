import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import { getActiveWorkspace } from "@/lib/core/workspace-server";
import { z } from "zod";

const mergeSchema = z.object({
  sourceContactId: z.string().min(1),
});

// ═══════════════════════════════════════════════════════════════
// POST /api/crm/contacts/[contactId]/merge
// Merge a duplicate (source) contact INTO this (target) contact.
// ═══════════════════════════════════════════════════════════════
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getActiveWorkspace(user.userId);
    const { contactId: targetContactId } = await params;

    const body = await req.json() as unknown;
    const parsed = mergeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { sourceContactId } = parsed.data;

    if (sourceContactId === targetContactId) {
      return NextResponse.json(
        { error: "Cannot merge a contact with itself" },
        { status: 400 }
      );
    }

    // Verify both contacts belong to the active workspace
    const [targetContact, sourceContact] = await Promise.all([
      db.contact.findFirst({
        where: { contactId: targetContactId, workspaceId: workspace.workspaceId },
      }),
      db.contact.findFirst({
        where: { contactId: sourceContactId, workspaceId: workspace.workspaceId },
      }),
    ]);

    if (!targetContact) {
      return NextResponse.json({ error: "Target contact not found" }, { status: 404 });
    }
    if (!sourceContact) {
      return NextResponse.json({ error: "Source contact not found" }, { status: 404 });
    }

    // Run all merge operations in a transaction
    const updatedTarget = await db.$transaction(async (tx) => {
      // 1. Move ContactIdentity rows
      await tx.contactIdentity.updateMany({
        where: { contactId: sourceContactId },
        data: { contactId: targetContactId },
      });

      // 2. Move Deals
      await tx.deal.updateMany({
        where: { contactId: sourceContactId },
        data: { contactId: targetContactId },
      });

      // 3. Move CrmTasks
      await tx.crmTask.updateMany({
        where: { contactId: sourceContactId },
        data: { contactId: targetContactId },
      });

      // 4. Move CrmActivities
      await tx.crmActivity.updateMany({
        where: { contactId: sourceContactId },
        data: { contactId: targetContactId },
      });

      // 5. Move ContactTagAssignments — skip duplicates by upsert strategy
      const sourceTags = await tx.contactTagAssignment.findMany({
        where: { contactId: sourceContactId },
        select: { tagId: true },
      });

      for (const { tagId } of sourceTags) {
        const existing = await tx.contactTagAssignment.findFirst({
          where: { contactId: targetContactId, tagId },
        });
        if (!existing) {
          await tx.contactTagAssignment.create({
            data: { contactId: targetContactId, tagId },
          });
        }
      }

      // Delete source tag assignments after migration
      await tx.contactTagAssignment.deleteMany({
        where: { contactId: sourceContactId },
      });

      // 6. Mark source contact as merged ("lapsed" as proxy since there's no "merged" stage)
      await tx.contact.update({
        where: { contactId: sourceContactId },
        data: {
          mergedIntoId: targetContactId,
          lifecycleStage: "lapsed",
        },
      });

      // 7. Update target's mergedFromIds to include source
      const updated = await tx.contact.update({
        where: { contactId: targetContactId },
        data: {
          mergedFromIds: {
            push: sourceContactId,
          },
        },
      });

      // 8. Log a CrmActivity for the merge
      await tx.crmActivity.create({
        data: {
          workspaceId: workspace.workspaceId,
          eventType: "identity_linked",
          summary: `Merged contact: ${sourceContact.name ?? sourceContactId}`,
          contactId: targetContactId,
          actorUserId: user.userId,
          metadata: {
            sourceContactId,
            sourceName: sourceContact.name,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({ success: true, contact: updatedTarget });
  } catch (error) {
    console.error("[CRM_CONTACT_MERGE_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
