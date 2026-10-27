import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import { getActiveWorkspace } from "@/lib/core/workspace-server";
import { z } from "zod";

const VALID_STAGES = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"] as const;
type DealStage = (typeof VALID_STAGES)[number];

const stageChangeSchema = z.object({
  stage: z.enum(VALID_STAGES),
  lostReason: z.string().trim().max(500).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/crm/deals/[dealId]/stage
// Change a deal's pipeline stage.
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
    const parsed = stageChangeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { stage: newStage, lostReason, note } = parsed.data;

    // Verify deal belongs to workspace
    const existingDeal = await db.deal.findFirst({
      where: { dealId, workspaceId: workspace.workspaceId },
      select: { dealId: true, stage: true, contactId: true, title: true },
    });

    if (!existingDeal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const fromStage = existingDeal.stage as DealStage;
    const isTerminal = newStage === "won" || newStage === "lost";

    // Update deal stage + related fields in a transaction
    const [updatedDeal] = await db.$transaction([
      // 1. Update the deal itself
      db.deal.update({
        where: { dealId },
        data: {
          stage: newStage,
          ...(newStage === "lost" && lostReason ? { lostReason } : {}),
          ...(isTerminal ? { closedAt: new Date() } : {}),
        },
      }),

      // 2. Insert DealStageHistory record
      db.dealStageHistory.create({
        data: {
          dealId,
          fromStage,
          toStage: newStage,
          changedBy: user.userId,
          note: note ?? null,
        },
      }),

      // 3. Log CrmActivity
      db.crmActivity.create({
        data: {
          workspaceId: workspace.workspaceId,
          eventType: "deal_stage_changed",
          summary: `Deal stage changed from "${fromStage}" to "${newStage}"`,
          contactId: existingDeal.contactId,
          dealId,
          actorUserId: user.userId,
          metadata: {
            fromStage,
            toStage: newStage,
            lostReason: lostReason ?? null,
            note: note ?? null,
          },
        },
      }),
    ]);

    return NextResponse.json({ deal: updatedDeal });
  } catch (error) {
    console.error("[CRM_DEAL_STAGE_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
