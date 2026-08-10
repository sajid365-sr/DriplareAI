import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getActiveWorkspace } from "@/lib/core/workspace-server";

// Helper to verify user ownership of order
async function getAuthorizedOrder(userId: string, orderId: string) {
  const workspace = await getActiveWorkspace(userId);
  const userBots = await db.chatbot.findMany({
    where: { userId, workspaceId: workspace.workspaceId },
    select: { id: true, chatbotId: true },
  });

  const botIds = Array.from(
    new Set(userBots.flatMap((b) => [b.id, b.chatbotId]))
  );

  return db.order.findFirst({
    where: {
      id: orderId,
      chatbotId: { in: botIds },
    },
  });
}

// GET /api/orders/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const order = await getAuthorizedOrder(userId, id);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error("[ORDER_GET_ID]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PATCH /api/orders/[id]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existingOrder = await getAuthorizedOrder(userId, id);

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      customerName,
      customerPhone,
      deliveryAddress,
      district,
      items,
      totalAmount,
      courierName,
      status,
      internalNotes,
    } = body;

    const updatedOrder = await db.order.update({
      where: { id },
      data: {
        ...(customerName !== undefined && { customerName }),
        ...(customerPhone !== undefined && { customerPhone }),
        ...(deliveryAddress !== undefined && { deliveryAddress }),
        ...(district !== undefined && { district }),
        ...(items !== undefined && { items }),
        ...(totalAmount !== undefined && { totalAmount: Number(totalAmount) }),
        ...(courierName !== undefined && { courierName }),
        ...(status !== undefined && { status }),
        ...(internalNotes !== undefined && { internalNotes }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error("[ORDER_PATCH_ID]", error);
    return NextResponse.json(
      { error: error.message || "Failed to update order" },
      { status: 500 }
    );
  }
}

// DELETE /api/orders/[id]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existingOrder = await getAuthorizedOrder(userId, id);

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    await db.order.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Order #${existingOrder.orderId} deleted successfully`,
    });
  } catch (error: any) {
    console.error("[ORDER_DELETE_ID]", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete order" },
      { status: 500 }
    );
  }
}
