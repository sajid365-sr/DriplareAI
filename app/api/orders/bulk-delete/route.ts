import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getActiveWorkspace } from "@/lib/core/workspace-server";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { orderIds } = body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { error: "No order IDs provided for deletion" },
        { status: 400 }
      );
    }

    // Get active workspace to scope order authorization
    const workspace = await getActiveWorkspace(userId);
    const userBots = await db.chatbot.findMany({
      where: { userId, workspaceId: workspace.workspaceId },
      select: { id: true, chatbotId: true },
    });

    const botIds = Array.from(
      new Set(userBots.flatMap((b) => [b.id, b.chatbotId]))
    );

    // Delete orders matching orderIds and belonging to user's business
    const deleteResult = await db.order.deleteMany({
      where: {
        id: { in: orderIds },
        chatbotId: { in: botIds },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deleteResult.count} order(s).`,
      count: deleteResult.count,
    });
  } catch (error: any) {
    console.error("[BULK_DELETE_POST]", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete orders" },
      { status: 500 }
    );
  }
}
