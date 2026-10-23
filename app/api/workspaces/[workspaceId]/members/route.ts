import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import { appUrl, MailTemplates, sendMail } from "@/lib/services/mail";

const MEMBER_ROLES = new Set(["agent", "admin", "viewer"]);

// GET /api/workspaces/[workspaceId]/members - List workspace members
export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const user = await getAndSyncUser();
    const { workspaceId } = await params;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only the owner and active members can view this team's roster.
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

    const isOwner = workspace.userId === user.userId;
    const isActiveMember = await db.workspaceMember.findFirst({
      where: { workspaceId, userId: user.userId, status: "active" },
      select: { id: true },
    });
    if (!isOwner && !isActiveMember) {
      return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
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
      currentUserId: user.userId,
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
    const user = await getAndSyncUser();
    const { workspaceId } = await params;
    let body: { email?: unknown; name?: unknown; role?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const role = typeof body.role === "string" ? body.role : "agent";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (!MEMBER_ROLES.has(role)) {
      return NextResponse.json({ error: "Invalid team member role" }, { status: 400 });
    }

    const workspace = await db.workspace.findUnique({
      where: { workspaceId, userId: user.userId },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Only the workspace owner can invite team members" },
        { status: 403 }
      );
    }

    // Invite by email even when the person has never created an account.
    const existingUser = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { userId: true, name: true },
    });
    if (existingUser?.userId === workspace.userId) {
      return NextResponse.json({ error: "The workspace owner is already a team member" }, { status: 409 });
    }

    const existingMembership = await db.workspaceMember.findFirst({
      where: { workspaceId, email: { equals: email, mode: "insensitive" } },
      select: { id: true, status: true },
    });
    if (existingMembership?.status === "active") {
      return NextResponse.json({ error: "This person is already an active team member" }, { status: 409 });
    }

    const member = await db.workspaceMember.upsert({
      where: {
        workspaceId_email: {
          workspaceId,
          email: email.toLowerCase(),
        },
      },
      update: {
        name: name || existingUser?.name || undefined,
        role,
        userId: null,
        status: "invited",
        joinedAt: null,
      },
      create: {
        workspaceId,
        email,
        name: name || existingUser?.name || email.split("@")[0],
        role,
        status: "invited",
        userId: null,
        joinedAt: null,
      },
    });

    const invitationUrl = appUrl(
      `${existingUser ? "/sign-in" : "/sign-up"}?redirect_url=%2Fdashboard%2Finbox`
    );
    const emailResult = await sendMail({
      to: email,
      subject: `Invitation to join ${workspace.name} on Driplare AI`,
      html: MailTemplates.teamInvitation({
        inviteeName: name || existingUser?.name || email.split("@")[0],
        inviterName: user.name,
        workspaceName: workspace.name,
        role,
        invitationUrl,
      }),
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { error: "Invitation email could not be sent", code: "INVITE_EMAIL_FAILED", member, emailSent: false },
        { status: 502 }
      );
    }

    return NextResponse.json({ member, emailSent: true }, { status: 201 });
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
    const user = await getAndSyncUser();
    const { workspaceId } = await params;
    const url = new URL(req.url);
    const memberId = url.searchParams.get("memberId");

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await db.workspace.findUnique({
      where: { workspaceId, userId: user.userId },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Only workspace owner can remove members" }, { status: 403 });
    }

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const member = await db.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
      select: { id: true, userId: true },
    });
    if (!member) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }

    if (member.userId) {
      const chatbots = await db.chatbot.findMany({
        where: { workspaceId },
        select: { id: true, chatbotId: true },
      });
      const chatbotIds = Array.from(new Set(chatbots.flatMap((bot) => [bot.id, bot.chatbotId])));
      if (chatbotIds.length > 0) {
        await db.chatSession.updateMany({
          where: { chatbotId: { in: chatbotIds }, assignedToUserId: member.userId },
          data: { assignedToUserId: null, assignedAt: null },
        });
      }
    }

    await db.workspaceMember.delete({ where: { id: member.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WORKSPACE_MEMBER_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

