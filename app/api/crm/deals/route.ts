import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import { getActiveWorkspace } from "@/lib/core/workspace-server";
import { z } from "zod";

const VALID_STAGES = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"] as const;
type DealStage = (typeof VALID_STAGES)[number];

const createDealSchema = z.object({
  contactId: z.string().min(1),
  title: z.string().trim().min(1).max(255),
  amount: z.number().nonnegative().optional().nullable(),
  stage: z.enum(VALID_STAGES).default("new"),
  probability: z.number().min(0).max(100).optional().nullable(),
  expectedCloseDate: z.string().datetime({ offset: true }).optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
  source: z.string().trim().max(50).optional().nullable(),
  internalNotes: z.string().trim().optional().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// GET /api/crm/deals
// Workspace-wide deals list with filters and pagination.
// ═══════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getActiveWorkspace(user.userId);
    const { searchParams } = req.nextUrl;

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;

    // Filters
    const stage = searchParams.get("stage") ?? "";
    const assignedTo = searchParams.get("assignedTo") ?? "";
    const contactId = searchParams.get("contactId") ?? "";

    const where: Record<string, unknown> = {
      workspaceId: workspace.workspaceId,
    };

    if (stage && VALID_STAGES.includes(stage as DealStage)) {
      where.stage = stage;
    }

    if (assignedTo) {
      where.assignedToUserId = assignedTo;
    }

    if (contactId) {
      where.contactId = contactId;
    }

    const [deals, total] = await Promise.all([
      db.deal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          contact: {
            select: { contactId: true, name: true, phone: true },
          },
        },
      }),
      db.deal.count({ where }),
    ]);

    return NextResponse.json({
      deals,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error) {
    console.error("[CRM_DEALS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/crm/deals
// Create a new deal and log a CrmActivity.
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getActiveWorkspace(user.userId);

    const body = await req.json() as unknown;
    const parsed = createDealSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify contact belongs to workspace
    const contact = await db.contact.findFirst({
      where: { contactId: data.contactId, workspaceId: workspace.workspaceId },
      select: { contactId: true, name: true },
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const deal = await db.deal.create({
      data: {
        workspaceId: workspace.workspaceId,
        contactId: data.contactId,
        title: data.title,
        amount: data.amount,
        stage: data.stage,
        probability: data.probability,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
        assignedToUserId: data.assignedToUserId,
        source: data.source,
        internalNotes: data.internalNotes,
      },
    });

    // Log CrmActivity for deal creation
    await db.crmActivity.create({
      data: {
        workspaceId: workspace.workspaceId,
        eventType: "deal_created",
        summary: `Deal created: ${data.title}`,
        contactId: data.contactId,
        dealId: deal.dealId,
        actorUserId: user.userId,
        metadata: { stage: data.stage, amount: data.amount },
      },
    });

    return NextResponse.json({ deal }, { status: 201 });
  } catch (error) {
    console.error("[CRM_DEALS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
