import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import { getActiveWorkspace } from "@/lib/core/workspace-server";

// ═══════════════════════════════════════════════════════════════
// GET /api/crm/contacts/[contactId]/timeline
// Returns unified CrmActivity timeline for a contact.
// ═══════════════════════════════════════════════════════════════
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getActiveWorkspace(user.userId);
    const { contactId } = await params;
    const { searchParams } = req.nextUrl;

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;

    // Verify contact belongs to this workspace
    const contact = await db.contact.findFirst({
      where: { contactId, workspaceId: workspace.workspaceId },
      select: { contactId: true },
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const [activities, total] = await Promise.all([
      db.crmActivity.findMany({
        where: { contactId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.crmActivity.count({ where: { contactId } }),
    ]);

    return NextResponse.json({
      activities,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error) {
    console.error("[CRM_CONTACT_TIMELINE_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
