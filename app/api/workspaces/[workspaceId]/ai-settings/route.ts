import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import {
  EMPTY_WORKSPACE_AI_RULES,
  WorkspaceAISettingsPayloadSchema,
  parseWorkspaceAIRules,
} from "@/lib/domain/workspace-ai-settings";

type RouteContext = { params: Promise<{ workspaceId: string }> };

async function getAccess(userId: string, workspaceId: string) {
  const workspace = await db.workspace.findUnique({
    where: { workspaceId },
    select: { workspaceId: true, userId: true },
  });
  if (!workspace) return null;

  if (workspace.userId === userId) {
    return { canRead: true, canWrite: true };
  }

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

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getAndSyncUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId } = await params;
  const access = await getAccess(user.userId, workspaceId);
  if (!access) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  if (!access.canRead) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });

  try {
    const settings = await db.workspaceAISettings.findUnique({ where: { workspaceId } });
    return NextResponse.json({
      corePrompt: settings?.corePrompt ?? "",
      rules: settings ? parseWorkspaceAIRules(settings.rulesJson) : EMPTY_WORKSPACE_AI_RULES,
      updatedAt: settings?.updatedAt ?? null,
      canEdit: access.canWrite,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[WORKSPACE_AI_SETTINGS_GET]", error);
    return NextResponse.json({ error: "Failed to load workspace AI rules" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getAndSyncUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId } = await params;
  const access = await getAccess(user.userId, workspaceId);
  if (!access) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  if (!access.canWrite) return NextResponse.json({ error: "Workspace settings edit access required" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = WorkspaceAISettingsPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid workspace AI rules", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const settings = await db.workspaceAISettings.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        corePrompt: parsed.data.corePrompt,
        rulesJson: parsed.data.rules,
      },
      update: {
        corePrompt: parsed.data.corePrompt,
        rulesJson: parsed.data.rules,
      },
      select: { corePrompt: true, rulesJson: true, updatedAt: true },
    });

    return NextResponse.json({
      corePrompt: settings.corePrompt,
      rules: parseWorkspaceAIRules(settings.rulesJson),
      updatedAt: settings.updatedAt,
      canEdit: true,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[WORKSPACE_AI_SETTINGS_PATCH]", error);
    return NextResponse.json({ error: "Failed to save workspace AI rules" }, { status: 500 });
  }
}
