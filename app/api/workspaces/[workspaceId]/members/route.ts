import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";

// GET /api/workspaces/[workspaceId]/members - List workspace members
export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { userId } = await auth();
    const { workspaceId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify workspace access (owner or member)
    const workspace = await db.workspace.findUnique({
      where: { workspaceId },
      include: {
        user: {
          select: {
            userId: true,
            name: true,
            email: true,
            picture: true,
          },
        },
        members: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Combine owner + members
    const ownerEntry = {
      id: "owner-" + workspace.userId,
      workspaceId: workspace.workspaceId,
      userId: workspace.user.userId,
      name: workspace.user.name || "Owner",
      email: workspace.user.email,
      role: "owner",
      status: "active",
      picture: workspace.user.picture,
      createdAt: workspace.createdAt,
    };

    const memberEntries = workspace.members.map((m) => ({
      id: m.id,
      workspaceId: m.workspaceId,
      userId: m.userId,
      name: m.name || m.email.split("@")[0],
      email: m.email,
      role: m.role,
      status: m.status,
      picture: null,
      createdAt: m.createdAt,
    }));

    return NextResponse.json({
      ownerId: workspace.userId,
      members: [ownerEntry, ...memberEntries],
    });
  } catch (error) {
    console.error("[WORKSPACE_MEMBERS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// POST /api/workspaces/[workspaceId]/members - Invite / Add a new member
export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { userId } = await auth();
    const { workspaceId } = await params;
    const body = await req.json();
    const { email, name, role } = body;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const workspace = await db.workspace.findUnique({
      where: { workspaceId, userId },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Only the workspace owner can invite team members" },
        { status: 403 }
      );
    }

    // Check if user already exists in db by email
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { userId: true, name: true },
    });

    const member = await db.workspaceMember.upsert({
      where: {
        workspaceId_email: {
          workspaceId,
          email: email.toLowerCase(),
        },
      },
      update: {
        name: name || existingUser?.name || undefined,
        role: role || "agent",
        userId: existingUser?.userId || undefined,
      },
      create: {
        workspaceId,
        email: email.toLowerCase(),
        name: name || existingUser?.name || email.split("@")[0],
        role: role || "agent",
        status: "active",
        userId: existingUser?.userId || null,
      },
    });

    return NextResponse.json(member);
  } catch (error) {
    console.error("[WORKSPACE_MEMBER_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// DELETE /api/workspaces/[workspaceId]/members - Remove member by email or id
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { userId } = await auth();
    const { workspaceId } = await params;
    const url = new URL(req.url);
    const memberId = url.searchParams.get("memberId");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await db.workspace.findUnique({
      where: { workspaceId, userId },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Only workspace owner can remove members" }, { status: 403 });
    }

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    await db.workspaceMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WORKSPACE_MEMBER_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
