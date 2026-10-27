import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import { getActiveWorkspace } from "@/lib/core/workspace-server";
import { z } from "zod";

const updateContactSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  lifecycleStage: z
    .enum(["new", "engaged", "qualified", "customer", "repeat", "lapsed"])
    .optional(),
  source: z.string().trim().max(50).optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
  primaryAddress: z.string().trim().max(500).optional().nullable(),
  district: z.string().trim().max(100).optional().nullable(),
  marketingConsent: z.boolean().optional(),
  smsConsent: z.boolean().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  aiSummary: z.array(z.string()).optional(),
  buyingIntentScore: z.number().int().min(0).max(100).optional().nullable(),
});

// ── Helper: verify workspace ownership ───────────────────────────────────────
async function getContactOrFail(contactId: string, workspaceId: string) {
  const contact = await db.contact.findFirst({
    where: { contactId, workspaceId },
  });
  return contact;
}

// ── GET /api/crm/contacts/[contactId] ────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const user = await getAndSyncUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = await getActiveWorkspace(user.userId);
    const { contactId } = await params;

    const contact = await db.contact.findFirst({
      where: { contactId, workspaceId: workspace.workspaceId },
      include: {
        identities: true,
        tagAssignments: { select: { tagId: true } },
        deals: {
          orderBy: { createdAt: "desc" },
          include: { tasks: { where: { status: { in: ["pending", "in_progress"] } } } },
        },
        tasks: {
          orderBy: [{ status: "asc" }, { dueAt: "asc" }],
        },
      },
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ contact });
  } catch (error) {
    console.error("[CRM_CONTACT_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// ── PATCH /api/crm/contacts/[contactId] ──────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const user = await getAndSyncUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = await getActiveWorkspace(user.userId);
    const { contactId } = await params;

    const existing = await getContactOrFail(contactId, workspace.workspaceId);
    if (!existing) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    const body = await req.json() as unknown;
    const parsed = updateContactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Track lifecycle stage change for activity log
    const lifecycleChanged = data.lifecycleStage && data.lifecycleStage !== existing.lifecycleStage;
    const ownerChanged = data.assignedToUserId !== undefined && data.assignedToUserId !== existing.assignedToUserId;

    const updated = await db.contact.update({
      where: { contactId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.lifecycleStage !== undefined && { lifecycleStage: data.lifecycleStage }),
        ...(data.source !== undefined && { source: data.source }),
        ...(data.assignedToUserId !== undefined && { assignedToUserId: data.assignedToUserId }),
        ...(data.primaryAddress !== undefined && { primaryAddress: data.primaryAddress }),
        ...(data.district !== undefined && { district: data.district }),
        ...(data.marketingConsent !== undefined && { marketingConsent: data.marketingConsent, consentUpdatedAt: new Date() }),
        ...(data.smsConsent !== undefined && { smsConsent: data.smsConsent, consentUpdatedAt: new Date() }),
        ...(data.customFields !== undefined && { customFields: data.customFields as any }),
        ...(data.aiSummary !== undefined && { aiSummary: data.aiSummary as any }),
        ...(data.buyingIntentScore !== undefined && { buyingIntentScore: data.buyingIntentScore }),
      },
    });

    // Log activities for significant changes
    const activityPromises: Promise<unknown>[] = [];

    if (lifecycleChanged) {
      activityPromises.push(
        db.crmActivity.create({
          data: {
            workspaceId: workspace.workspaceId,
            eventType: "lifecycle_changed",
            summary: `Lifecycle changed: ${existing.lifecycleStage} → ${data.lifecycleStage}`,
            contactId,
            actorUserId: user.userId,
            metadata: { from: existing.lifecycleStage, to: data.lifecycleStage },
          },
        })
      );
    }

    if (ownerChanged) {
      activityPromises.push(
        db.crmActivity.create({
          data: {
            workspaceId: workspace.workspaceId,
            eventType: "owner_changed",
            summary: "Contact owner updated",
            contactId,
            actorUserId: user.userId,
            metadata: { from: existing.assignedToUserId, to: data.assignedToUserId },
          },
        })
      );
    }

    await Promise.all(activityPromises);

    return NextResponse.json({ contact: updated });
  } catch (error) {
    console.error("[CRM_CONTACT_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// ── DELETE /api/crm/contacts/[contactId] ─────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const user = await getAndSyncUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspace = await getActiveWorkspace(user.userId);
    const { contactId } = await params;

    const existing = await getContactOrFail(contactId, workspace.workspaceId);
    if (!existing) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

    // Cascade: ContactIdentity, ContactTagAssignment, CrmActivity, CrmTask,
    // Deal, DealStageHistory all delete via onDelete: Cascade in schema.
    await db.contact.delete({ where: { contactId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CRM_CONTACT_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

