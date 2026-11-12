import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import { getActiveWorkspace } from "@/lib/core/workspace-server";
import { z } from "zod";

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().optional().nullable(),
  status: z.enum(["pending", "in_progress", "done", "cancelled", "overdue"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
  completedAt: z.string().datetime({ offset: true }).optional().nullable(),
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/crm/tasks/[taskId]
// Update a CrmTask. Auto-sets completedAt if status becomes "done".
// ═══════════════════════════════════════════════════════════════
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getActiveWorkspace(user.userId);
    const { taskId } = await params;

    const body = await req.json() as unknown;
    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    // Verify task belongs to workspace
    const existingTask = await db.crmTask.findFirst({
      where: { taskId, workspaceId: workspace.workspaceId },
      select: {
        taskId: true,
        status: true,
        contactId: true,
        dealId: true,
        title: true,
        completedAt: true,
      },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const data = parsed.data;
    const isCompletingNow = data.status === "done" && existingTask.status !== "done";

    // Auto-set completedAt if completing the task and not explicitly provided
    let resolvedCompletedAt: Date | null | undefined = undefined;
    if (data.completedAt !== undefined) {
      resolvedCompletedAt = data.completedAt ? new Date(data.completedAt) : null;
    } else if (isCompletingNow) {
      resolvedCompletedAt = new Date();
    }

    const updatedTask = await db.crmTask.update({
      where: { taskId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.dueAt !== undefined && { dueAt: data.dueAt ? new Date(data.dueAt) : null }),
        ...(data.assignedToUserId !== undefined && { assignedToUserId: data.assignedToUserId }),
        ...(resolvedCompletedAt !== undefined && { completedAt: resolvedCompletedAt }),
      },
    });

    // Log activity if task was just completed
    if (isCompletingNow) {
      await db.crmActivity.create({
        data: {
          workspaceId: workspace.workspaceId,
          eventType: "task_completed",
          summary: `Task completed: ${existingTask.title}`,
          contactId: existingTask.contactId ?? null,
          dealId: existingTask.dealId ?? null,
          taskId,
          actorUserId: user.userId,
          metadata: { completedAt: resolvedCompletedAt },
        },
      });
    }

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error("[CRM_TASK_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
