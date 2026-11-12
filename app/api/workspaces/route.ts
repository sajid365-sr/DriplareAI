import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import {
  ensureDefaultWorkspace,
  getActiveWorkspace,
  WORKSPACE_COMPAT_SELECT,
  hydrateWorkspaceMigrationFields,
} from "@/lib/core/workspace-server";
import { isWorkspaceBusinessCategory } from "@/lib/domain/workspace-business-categories";

// GET /api/workspaces — list all workspaces owned by the user + the active one
export async function GET() {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Guarantees a default workspace exists (and backfills legacy chatbots)
    await ensureDefaultWorkspace(user.userId);

    const workspaces = await db.workspace.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "asc" },
      select: WORKSPACE_COMPAT_SELECT,
    });

    const active = await getActiveWorkspace(user.userId);

    return NextResponse.json({
      workspaces: await Promise.all(workspaces.map(hydrateWorkspaceMigrationFields)),
      activeWorkspaceId: active.workspaceId,
    });
  } catch (error) {
    console.error("[WORKSPACES_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// POST /api/workspaces — create a new business/workspace
export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: {
      name?: unknown;
      logoUrl?: unknown;
      category?: unknown;
      customBusinessTitle?: unknown;
      onboardingRequestId?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body (image may be too large)" },
        { status: 400 }
      );
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length > 100) {
      return NextResponse.json({ error: "Business name must be 100 characters or fewer" }, { status: 400 });
    }
    const category = isWorkspaceBusinessCategory(body.category) ? body.category : "ecommerce";
    const customBusinessTitle = typeof body.customBusinessTitle === "string" ? body.customBusinessTitle.trim().slice(0, 60) || null : null;
    const logoUrl =
      typeof body.logoUrl === "string" && body.logoUrl.trim()
        ? body.logoUrl.trim()
        : null;
    const onboardingRequestId =
      typeof body.onboardingRequestId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.onboardingRequestId)
        ? body.onboardingRequestId
        : null;

    if (body.onboardingRequestId !== undefined && onboardingRequestId === null) {
      return NextResponse.json({ error: "Invalid onboarding request ID" }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json(
        { error: "Business name is required" },
        { status: 400 }
      );
    }

    if (logoUrl && logoUrl.length > 200_000) {
      return NextResponse.json({ error: "Business logo is too large" }, { status: 400 });
    }

    if (onboardingRequestId) {
      const existing = await db.workspace.findUnique({
        where: { workspaceId: onboardingRequestId },
        select: WORKSPACE_COMPAT_SELECT,
      });
      if (existing) {
        if (existing.userId !== user.userId) {
          return NextResponse.json({ error: "Onboarding request already used" }, { status: 409 });
        }
        return NextResponse.json(await hydrateWorkspaceMigrationFields(existing));
      }
    }

    let workspace;
    try {
      workspace = await db.workspace.create({
        data: {
          ...(onboardingRequestId && { workspaceId: onboardingRequestId }),
          userId: user.userId,
          name,
          logoUrl,
          category,
          customBusinessTitle,
        },
        select: WORKSPACE_COMPAT_SELECT,
      });
    } catch (error) {
      if (
        onboardingRequestId &&
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        const existing = await db.workspace.findUnique({
          where: { workspaceId: onboardingRequestId },
          select: WORKSPACE_COMPAT_SELECT,
        });
        if (existing?.userId === user.userId) {
          return NextResponse.json(await hydrateWorkspaceMigrationFields(existing));
        }
      }
      throw error;
    }

    return NextResponse.json(await hydrateWorkspaceMigrationFields(workspace));
  } catch (error) {
    console.error("[WORKSPACES_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
