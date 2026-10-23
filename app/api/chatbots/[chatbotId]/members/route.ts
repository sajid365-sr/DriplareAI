import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getInboxAccessibleChatbot } from "@/lib/domain/chatbot-access";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getInboxAccessibleChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // If bot belongs to a workspace, fetch all workspace members
    const workspaceId = bot.workspaceId;
  const workspaceMembers: Array<{
    userId: string;
    name: string;
    email: string;
    picture: string | null;
    role: string;
  }> = [];

    if (workspaceId) {
      const ws = await db.workspace.findUnique({
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
            where: { status: "active", userId: { not: null } },
          },
        },
      });

      if (ws) {
        workspaceMembers.push({
          userId: ws.user.userId,
          name: ws.user.name || "Owner",
          email: ws.user.email,
          picture: ws.user.picture,
          role: "Owner",
        });

        for (const m of ws.members) {
          workspaceMembers.push({
          userId: m.userId!,
            name: m.name || m.email.split("@")[0],
            email: m.email,
            picture: null,
            role: m.role === "admin" ? "Admin" : "Agent",
          });
        }
      }
    } else {
      // Fallback: owner only
      const currentUser = await db.user.findUnique({
        where: { userId },
        select: {
          userId: true,
          name: true,
          email: true,
          picture: true,
        },
      });
      if (currentUser) {
        workspaceMembers.push({
          userId: currentUser.userId,
          name: currentUser.name || "Workspace Owner",
          email: currentUser.email,
          picture: currentUser.picture,
          role: "Owner",
        });
      }
    }

    return NextResponse.json({ members: workspaceMembers });
  } catch (error) {
    console.error("[BOT_MEMBERS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
