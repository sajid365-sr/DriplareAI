import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import { getActiveWorkspace } from "@/lib/core/workspace-server";
import { z } from "zod";

const VALID_STAGES = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"] as const;

const updateDealSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  amount: z.number().nonnegative().optional().nullable(),
  stage: z.enum(VALID_STAGES).optional(),
  probability: z.number().min(0).max(100).optional().nullable(),
  expectedCloseDate: z.string().datetime({ offset: true }).optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
  source: z.string().trim().max(50).optional().nullable(),
  internalNotes: z.string().trim().optional().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// GET /api/crm/deals/[dealId]
// Single deal with stageHistory, tasks, activities.
// ═══════════════════════════════════════════════════════════════
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getActiveWorkspace(user.userId);
    const { dealId } = await params;

    const deal = await db.deal.findFirst({
      where: { dealId, workspaceId: workspace.workspaceId },
      include: {
        contact: {
          select: { contactId: true, name: true, phone: true, email: true },
        },
        stageHistory: {
          orderBy: { createdAt: "desc" },
        },
        tasks: {
          orderBy: { dueAt: "asc" },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    return NextResponse.json({ deal });
  } catch (error) {
    console.error("[CRM_DEAL_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// PATCH /api/crm/deals/[dealId]
// Update deal fields and optionally log a CrmActivity.
// ═══════════════════════════════════════════════════════════════
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getActiveWorkspace(user.userId);
    const { dealId } = await params;

    const body = await req.json() as unknown;
    const parsed = updateDealSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    // Verify deal belongs to workspace
    const existingDeal = await db.deal.findFirst({
      where: { dealId, workspaceId: workspace.workspaceId },
      select: {
        dealId: true,
        contactId: true,
        amount: true,
        assignedToUserId: true,
        title: true,
      },
    });

    if (!existingDeal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const data = parsed.data;

    const updatedDeal = await db.deal.update({
      where: { dealId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.stage !== undefined && { stage: data.stage }),
        ...(data.probability !== undefined && { probability: data.probability }),
        ...(data.expectedCloseDate !== undefined && {
          expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
        }),
        ...(data.assignedToUserId !== undefined && { assignedToUserId: data.assignedToUserId }),
        ...(data.source !== undefined && { source: data.source }),
        ...(data.internalNotes !== undefined && { internalNotes: data.internalNotes }),
      },
    });

    // Log activity if notable fields changed
    const changedFields: string[] = [];
    if (data.amount !== undefined && data.amount !== existingDeal.amount) {
      changedFields.push(`amount changed to ${data.amount}`);
    }
    if (data.assignedToUserId !== undefined && data.assignedToUserId !== existingDeal.assignedToUserId) {
      changedFields.push(`assignee changed`);
    }

    if (changedFields.length > 0) {
      await db.crmActivity.create({
        data: {
          workspaceId: workspace.workspaceId,
          eventType: "deal_updated",
          summary: `Deal updated: ${changedFields.join(", ")}`,
          contactId: existingDeal.contactId,
          dealId,
          actorUserId: user.userId,
          metadata: {
            changedFields,
            previousAmount: existingDeal.amount,
            previousAssignee: existingDeal.assignedToUserId,
          },
        },
      });
    }

    return NextResponse.json({ deal: updatedDeal });
  } catch (error) {
    console.error("[CRM_DEAL_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
