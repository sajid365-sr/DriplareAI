import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";

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

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Fetch the workspace owner and any available agents in this workspace
    const currentUser = await db.user.findUnique({
      where: { userId },
      select: {
        userId: true,
        name: true,
        email: true,
        picture: true,
      },
    });

    const members = currentUser
      ? [
          {
            userId: currentUser.userId,
            name: currentUser.name || "Workspace Owner",
            email: currentUser.email,
            picture: currentUser.picture,
            role: "Owner",
          },
        ]
      : [];

    return NextResponse.json({ members });
  } catch (error) {
    console.error("[WORKSPACE_MEMBERS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

