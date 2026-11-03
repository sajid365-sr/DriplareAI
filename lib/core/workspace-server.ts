/**
 * Multi-Business / Multi-Workspace — server-only helpers.
 *
 * Resolves the active workspace for a request from the `driplare_workspace`
 * cookie (validated against ownership), auto-provisioning a default workspace
 * and backfilling legacy chatbots the first time. Import this ONLY from server
 * code (route handlers) — it reads next/headers.
 */
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/core/db";
import { WORKSPACE_COOKIE } from "@/lib/core/workspace";

// These are the Workspace columns that predate the pending profile/seed
// migrations. Selecting them explicitly keeps core workspace routing usable
// until those optional columns are present in the connected database.
export const WORKSPACE_COMPAT_SELECT = {
  id: true,
  workspaceId: true,
  userId: true,
  name: true,
  logoUrl: true,
  category: true,
  customBusinessTitle: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WorkspaceSelect;

type WorkspaceCompatRecord = Prisma.WorkspaceGetPayload<{
  select: typeof WORKSPACE_COMPAT_SELECT;
}>;

export async function hydrateWorkspaceMigrationFields(workspace: WorkspaceCompatRecord) {
  try {
    const migrationFields = await db.workspace.findUnique({
      where: { workspaceId: workspace.workspaceId },
      select: { businessFormsSeedVersion: true, businessProfile: true },
    });
    return {
      ...workspace,
      businessFormsSeedVersion: migrationFields?.businessFormsSeedVersion ?? 0,
      businessProfile: migrationFields?.businessProfile ?? null,
    };
  } catch (error) {
    if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2022") {
      throw error;
    }
    return {
      ...workspace,
      businessFormsSeedVersion: 0,
      businessProfile: null as Prisma.JsonValue | null,
    };
  }
}

/**
 * Ensure the user has at least one workspace. On first run, creates a default
 * "My Business" workspace and assigns all of the user's existing (legacy)
 * chatbots to it so nothing falls out of scope after the migration.
 */
export async function ensureDefaultWorkspace(userId: string) {
  const existing = await db.workspace.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: WORKSPACE_COMPAT_SELECT,
  });
  if (existing) return hydrateWorkspaceMigrationFields(existing);

  try {
    const workspace = await db.workspace.create({
      data: { userId, name: "My Business" },
      select: WORKSPACE_COMPAT_SELECT,
    });

    // Backfill: adopt any chatbots that aren't in a workspace yet.
    await db.chatbot.updateMany({
      where: { userId, workspaceId: null },
      data: { workspaceId: workspace.workspaceId },
    });
    return hydrateWorkspaceMigrationFields(workspace);
  } catch (err) {
    // A concurrent request (several routes call this in parallel on first load)
    // may have created the default in the meantime — ignore and fall through.
    console.error("[ensureDefaultWorkspace] create raced/failed", err);
  }

  // Always converge on the earliest workspace so parallel callers that each
  // created a row still return the SAME one (prevents duplicate actives).
  const workspace = await db.workspace.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: WORKSPACE_COMPAT_SELECT,
  });
  if (workspace) return hydrateWorkspaceMigrationFields(workspace);

  // Extremely unlikely (create failed AND nothing exists) — last-resort create.
  const created = await db.workspace.create({
    data: { userId, name: "My Business" },
    select: WORKSPACE_COMPAT_SELECT,
  });
  return hydrateWorkspaceMigrationFields(created);
}

/**
 * Resolve the active workspace for the current request. Reads the cookie,
 * verifies the workspace belongs to the user, and falls back to the default.
 */
export async function getActiveWorkspace(userId: string) {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(WORKSPACE_COOKIE)?.value;

  if (cookieValue) {
    const scoped = await db.workspace.findFirst({
      where: { workspaceId: cookieValue, userId },
      select: WORKSPACE_COMPAT_SELECT,
    });
    if (scoped) return hydrateWorkspaceMigrationFields(scoped);
  }

  return ensureDefaultWorkspace(userId);
}

/**
 * Resolve only the active workspace ID for routes that do not need workspace
 * profile fields. Keeping this query narrow lets lightweight routes continue
 * to work while optional Workspace columns are being rolled out by migration.
 */
export async function getActiveWorkspaceId(userId: string): Promise<string> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(WORKSPACE_COOKIE)?.value;

  if (cookieValue) {
    const scoped = await db.workspace.findFirst({
      where: { workspaceId: cookieValue, userId },
      select: { workspaceId: true },
    });
    if (scoped) return scoped.workspaceId;
  }

  const existing = await db.workspace.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { workspaceId: true },
  });
  if (existing) return existing.workspaceId;

  try {
    const workspace = await db.workspace.create({
      data: { userId, name: "My Business" },
      select: { workspaceId: true },
    });

    await db.chatbot.updateMany({
      where: { userId, workspaceId: null },
      data: { workspaceId: workspace.workspaceId },
    });

    return workspace.workspaceId;
  } catch (error) {
    // Another request may have created the default workspace concurrently.
    const raced = await db.workspace.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { workspaceId: true },
    });
    if (raced) return raced.workspaceId;
    throw error;
  }
}

/**
 * Return the chatbotIds belonging to the user's active workspace.
 * This is the single scoping anchor: every downstream entity (orders,
 * sessions, integrations, sources, usage logs) filters by these ids.
 */
export async function getActiveWorkspaceChatbotIds(userId: string) {
  const workspace = await getActiveWorkspace(userId);
  const bots = await db.chatbot.findMany({
    where: { userId, workspaceId: workspace.workspaceId },
    select: { id: true, chatbotId: true },
  });
  return {
    workspace,
    bots,
    chatbotIds: bots.map((b) => b.chatbotId),
  };
}
