import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getActiveWorkspace } from "@/lib/core/workspace-server";
import { canUseEcommerce } from "@/lib/domain/usage-limit";
import { dispatchParcel, type CourierName } from "@/lib/services/courier-dispatch";

const SUPPORTED_COURIERS: CourierName[] = ["Steadfast", "Pathao", "RedX"];

/** POST /api/orders/book-parcel
 * One-click courier booking: validates data → calls courier API → saves tracking ID.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ecommerce = await canUseEcommerce(userId);
    if (!ecommerce.allowed) {
      return NextResponse.json({ error: ecommerce.error }, { status: 403 });
    }

    const body = (await req.json()) as { orderId: string; courier?: string };
    const { orderId, courier = "Steadfast" } = body;

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    if (!SUPPORTED_COURIERS.includes(courier as CourierName)) {
      return NextResponse.json(
        { error: `Unsupported courier. Supported: ${SUPPORTED_COURIERS.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify order ownership under this merchant's bots
    const workspace = await getActiveWorkspace(userId);
    const userBots = await db.chatbot.findMany({
      where: { userId, workspaceId: workspace.workspaceId },
      select: { id: true, chatbotId: true },
    });
    const botIds = Array.from(new Set(userBots.flatMap((b) => [b.id, b.chatbotId])));

    const order = await db.order.findFirst({
      where: { id: orderId, chatbotId: { in: botIds } },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.courierTrackingId) {
      return NextResponse.json(
        { error: `Order already has tracking ID: ${order.courierTrackingId}` },
        { status: 400 }
      );
    }

    const result = await dispatchParcel(userId, orderId, courier as CourierName);

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "Booking failed" }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      trackingId: result.trackingId,
      courier,
      message: `Parcel booked successfully with ${courier}. Tracking: ${result.trackingId}`,
    });
  } catch (error) {
    console.error("[BOOK_PARCEL_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

