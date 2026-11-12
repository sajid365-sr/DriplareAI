import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import { getActiveWorkspace } from "@/lib/core/workspace-server";
import { z } from "zod";

const VALID_TASK_STATUSES = ["pending", "in_progress", "done", "cancelled", "overdue"] as const;
type TaskStatus = (typeof VALID_TASK_STATUSES)[number];

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(255),
  type: z.string().trim().max(50).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  description: z.string().trim().optional().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// GET /api/crm/tasks
// Workspace-wide tasks list with filters and pagination.
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
    const status = searchParams.get("status") ?? "";
    const assignedTo = searchParams.get("assignedTo") ?? "";
    const contactId = searchParams.get("contactId") ?? "";
    const dealId = searchParams.get("dealId") ?? "";
    const dueToday = searchParams.get("dueToday") === "true";
    const overdue = searchParams.get("overdue") === "true";

    const where: Record<string, unknown> = {
      workspaceId: workspace.workspaceId,
    };

    if (status && VALID_TASK_STATUSES.includes(status as TaskStatus)) {
      where.status = status;
    }

    if (assignedTo) {
      where.assignedToUserId = assignedTo;
    }

    if (contactId) {
      where.contactId = contactId;
    }

    if (dealId) {
      where.dealId = dealId;
    }

    if (dueToday) {
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      where.dueAt = { lte: endOfToday };
    }

    if (overdue) {
      where.dueAt = { lt: new Date() };
      where.status = { not: "done" };
    }

    const [tasks, total] = await Promise.all([
      db.crmTask.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueAt: "asc" },
        include: {
          contact: {
            select: { contactId: true, name: true, phone: true },
          },
          deal: {
            select: { dealId: true, title: true, stage: true },
          },
        },
      }),
      db.crmTask.count({ where }),
    ]);

    return NextResponse.json({
      tasks,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error) {
    console.error("[CRM_TASKS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/crm/tasks
// Create a new CrmTask and log a CrmActivity on linked contact/deal.
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getActiveWorkspace(user.userId);

    const body = await req.json() as unknown;
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Validate contact ownership if provided
    if (data.contactId) {
      const contact = await db.contact.findFirst({
        where: { contactId: data.contactId, workspaceId: workspace.workspaceId },
        select: { contactId: true },
      });
      if (!contact) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }
    }

    // Validate deal ownership if provided
    if (data.dealId) {
      const deal = await db.deal.findFirst({
        where: { dealId: data.dealId, workspaceId: workspace.workspaceId },
        select: { dealId: true },
      });
      if (!deal) {
        return NextResponse.json({ error: "Deal not found" }, { status: 404 });
      }
    }

    const task = await db.crmTask.create({
      data: {
        workspaceId: workspace.workspaceId,
        title: data.title,
        type: data.type ?? "follow_up",
        priority: data.priority,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        assignedToUserId: data.assignedToUserId,
        contactId: data.contactId,
        dealId: data.dealId,
        description: data.description,
        source: "manual",
      },
    });

    // Log CrmActivity on linked contact or deal
    await db.crmActivity.create({
      data: {
        workspaceId: workspace.workspaceId,
        eventType: "task_created",
        summary: `Task created: ${data.title}`,
        contactId: data.contactId ?? null,
        dealId: data.dealId ?? null,
        taskId: task.taskId,
        actorUserId: user.userId,
        metadata: {
          taskType: data.type ?? "follow_up",
          priority: data.priority,
          dueAt: data.dueAt ?? null,
        },
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("[CRM_TASKS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
