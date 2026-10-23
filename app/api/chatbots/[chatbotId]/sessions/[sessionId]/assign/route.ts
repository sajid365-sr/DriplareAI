import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getInboxAccessibleChatbot } from "@/lib/domain/chatbot-access";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; sessionId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId, sessionId } = await params;
    const body = await req.json();
    const { assignedToUserId } = body;
    const assignmentNote = typeof body.assignmentNote === "string"
      ? body.assignmentNote.trim().slice(0, 2000)
      : "";
    const aiPauseDurationMinutes = body.aiPauseDurationMinutes;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getInboxAccessibleChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const botIds = Array.from(new Set([bot.id, bot.chatbotId]));

    const existingSession = await db.chatSession.findFirst({
      where: {
        sessionId,
        chatbotId: { in: botIds },
      },
    });

    if (!existingSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const targetUserId = assignedToUserId ? String(assignedToUserId) : null;

    if (
      aiPauseDurationMinutes !== undefined &&
      aiPauseDurationMinutes !== null &&
      (!Number.isInteger(aiPauseDurationMinutes) || aiPauseDurationMinutes < 1 || aiPauseDurationMinutes > 43200)
    ) {
      return NextResponse.json({ error: "AI pause duration must be between 1 minute and 30 days" }, { status: 400 });
    }

    if (targetUserId) {
      if (!bot.workspaceId) {
        return NextResponse.json({ error: "This chatbot has no workspace team" }, { status: 400 });
      }
      const targetMember = await db.workspaceMember.findFirst({
        where: { workspaceId: bot.workspaceId, userId: targetUserId, status: "active" },
        select: { id: true },
      });
      const isOwner = await db.workspace.findFirst({
        where: { workspaceId: bot.workspaceId, userId: targetUserId },
        select: { id: true },
      });
      if (!targetMember && !isOwner) {
        return NextResponse.json({ error: "Assignee must be an active workspace member" }, { status: 400 });
      }
    }

    const previousAssignee = existingSession.assignedToUserId;

    const now = new Date();
    const resumeAt = targetUserId && typeof aiPauseDurationMinutes === "number"
      ? new Date(now.getTime() + aiPauseDurationMinutes * 60_000)
      : null;
    const updatedSession = await db.chatSession.update({
      where: { id: existingSession.id },
      data: {
        assignedToUserId: targetUserId,
        assignedAt: targetUserId ? now : null,
        ...(targetUserId
          ? {
              isActive: false,
              assignmentAiPaused: true,
              assignmentAiResumeAt: resumeAt,
              assignmentNote: assignmentNote || null,
            }
          : existingSession.assignmentAiPaused
            ? {
                isActive: true,
                assignmentAiPaused: false,
                assignmentAiResumeAt: null,
              }
            : {
                assignmentAiResumeAt: null,
              }),
      },
    });

    // Create an in-app notification for the assigned agent if targetUserId is set
    if (targetUserId && targetUserId !== previousAssignee) {
      try {
        await db.notification.create({
          data: {
            userId: targetUserId,
            type: "system",
            title: "New Conversation Assigned",
            message: `Conversation with ${existingSession.guestName || "Customer (" + sessionId.slice(-5) + ")"} has been assigned to you.`,
          },
        });
      } catch (notifErr) {
        console.error("[ASSIGN_NOTIF_ERROR]", notifErr);
      }
    }

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error("[ASSIGN_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

