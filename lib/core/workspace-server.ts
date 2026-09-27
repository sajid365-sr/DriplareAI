/**
 * Multi-Business / Multi-Workspace — server-only helpers.
 *
 * Resolves the active workspace for a request from the `driplare_workspace`
 * cookie (validated against ownership), auto-provisioning a default workspace
 * and backfilling legacy chatbots the first time. Import this ONLY from server
 * code (route handlers) — it reads next/headers.
 */
import { cookies } from "next/headers";
import { db } from "@/lib/core/db";
import { WORKSPACE_COOKIE } from "@/lib/core/workspace";

/**
 * Ensure the user has at least one workspace. On first run, creates a default
 * "My Business" workspace and assigns all of the user's existing (legacy)
 * chatbots to it so nothing falls out of scope after the migration.
 */
export async function ensureDefaultWorkspace(userId: string) {
  const existing = await db.workspace.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  try {
    const workspace = await db.workspace.create({
      data: { userId, name: "My Business" },
    });

    // Backfill: adopt any chatbots that aren't in a workspace yet.
    await db.chatbot.updateMany({
      where: { userId, workspaceId: null },
      data: { workspaceId: workspace.workspaceId },
    });
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
  });
  if (workspace) return workspace;

  // Extremely unlikely (create failed AND nothing exists) — last-resort create.
  return db.workspace.create({ data: { userId, name: "My Business" } });
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
    });
    if (scoped) return scoped;
  }

  return ensureDefaultWorkspace(userId);
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
