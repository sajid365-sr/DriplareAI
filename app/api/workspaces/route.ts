import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import {
  ensureDefaultWorkspace,
  getActiveWorkspace,
} from "@/lib/core/workspace-server";

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
    });

    const active = await getActiveWorkspace(user.userId);

    return NextResponse.json({
      workspaces,
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

    let body: { name?: unknown; logoUrl?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body (image may be too large)" },
        { status: 400 }
      );
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const logoUrl =
      typeof body.logoUrl === "string" && body.logoUrl.trim()
        ? body.logoUrl.trim()
        : null;

    if (!name) {
      return NextResponse.json(
        { error: "Business name is required" },
        { status: 400 }
      );
    }

    const workspace = await db.workspace.create({
      data: { userId: user.userId, name, logoUrl },
    });

    return NextResponse.json(workspace);
  } catch (error) {
    console.error("[WORKSPACES_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
