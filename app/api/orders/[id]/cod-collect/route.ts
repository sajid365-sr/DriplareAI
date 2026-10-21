import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getActiveWorkspace } from "@/lib/core/workspace-server";
import { canUseEcommerce } from "@/lib/domain/usage-limit";

/** PATCH /api/orders/[id]/cod-collect
 * Toggles COD collected state (Feature #26).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ecommerce = await canUseEcommerce(userId);
    if (!ecommerce.allowed) {
      return NextResponse.json({ error: ecommerce.error }, { status: 403 });
    }

    const { id } = await params;
    const body = (await req.json()) as { collected: boolean };
    const { collected } = body;

    const workspace = await getActiveWorkspace(userId);
    const userBots = await db.chatbot.findMany({
      where: { userId, workspaceId: workspace.workspaceId },
      select: { id: true, chatbotId: true },
    });
    const botIds = Array.from(new Set(userBots.flatMap((b) => [b.id, b.chatbotId])));

    const order = await db.order.findFirst({
      where: { id, chatbotId: { in: botIds } },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const updatedOrder = await db.order.update({
      where: { id },
      data: {
        codCollected: collected,
        codCollectedAt: collected ? new Date() : null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: collected ? "COD marked as collected" : "COD mark removed",
    });
  } catch (error) {
    console.error("[COD_COLLECT_PATCH]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

