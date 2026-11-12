import { db } from "@/lib/core/db";

export type WorkspaceAccess = {
  canRead: boolean;
  canWrite: boolean;
};

/** Resolve owner/admin access for workspace data APIs. */
export async function getWorkspaceAccess(userId: string, workspaceId: string): Promise<WorkspaceAccess | null> {
  const workspace = await db.workspace.findUnique({
    where: { workspaceId },
    select: { userId: true },
  });
  if (!workspace) return null;
  if (workspace.userId === userId) return { canRead: true, canWrite: true };

  const member = await db.workspaceMember.findFirst({
    where: { workspaceId, userId, status: "active" },
    select: { role: true },
  });
  if (!member) return { canRead: false, canWrite: false };

  return {
    canRead: true,
    canWrite: member.role === "admin",
  };
}
