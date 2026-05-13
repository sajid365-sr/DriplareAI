import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; sessionId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId, sessionId } = await params;
    const body = await req.json();
    const { isActive } = body;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await db.chatSession.update({
      where: {
        chatbotId_sessionId: {
          chatbotId,
          sessionId
        }
      },
      data: {
        isActive
      }
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error("[SESSION_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; sessionId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId, sessionId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete all messages in the session
    await db.chatMessage.deleteMany({
      where: {
        chatbotId,
        sessionId
      }
    });

    // Delete the session itself
    await db.chatSession.delete({
      where: {
        chatbotId_sessionId: {
          chatbotId,
          sessionId
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SESSION_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
