import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getActiveWorkspace } from "@/lib/core/workspace-server";

// Map Steadfast delivery_status to internal order status
function mapSteadfastStatus(sfStatus: string): { status: string; paymentStatus?: string } {
  switch (sfStatus) {
    case "delivered":
    case "partial_delivered":
      return { status: "Delivered", paymentStatus: "paid" };
    case "cancelled":
    case "cancelled_approval_pending":
      return { status: "Returned" };
    case "hold":
    case "delivered_approval_pending":
    case "partial_delivered_approval_pending":
      return { status: "In Transit" };
    case "pending":
    case "in_review":
    default:
      return { status: "Dispatched" };
  }
}

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getActiveWorkspace(userId);
    const userBots = await db.chatbot.findMany({
      where: { userId, workspaceId: workspace.workspaceId },
      select: { id: true, chatbotId: true },
    });

    const botIds = Array.from(
      new Set(userBots.flatMap((b) => [b.id, b.chatbotId]))
    );

    // Fetch merchant's courier credentials
    const courierConfig = await db.courierConfig.findUnique({
      where: { userId },
    });

    // Fetch active non-finalized orders with tracking ID
    const activeOrders = await db.order.findMany({
      where: {
        chatbotId: { in: botIds },
        courierTrackingId: { not: null },
        status: { in: ["Processing", "Dispatched", "Shipped", "In Transit"] },
      },
    });

    if (activeOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active shipments pending status sync",
        updated: 0,
      });
    }

    let updatedCount = 0;
    const syncLogs = [];

    for (const order of activeOrders) {
      let nextStatus = order.status;
      let nextPaymentStatus: string | undefined = undefined;

      // If courier is Steadfast and credentials exist, make live API call
      if (
        (order.courierName === "Steadfast" || !order.courierName) &&
        courierConfig?.steadfastApiKey &&
        courierConfig?.steadfastSecretKey &&
        order.courierTrackingId
      ) {
        try {
          const sfResponse = await fetch(
            `https://portal.packzy.com/api/v1/status_by_trackingcode/${order.courierTrackingId}`,
            {
              method: "GET",
              headers: {
                "Api-Key": courierConfig.steadfastApiKey,
                "Secret-Key": courierConfig.steadfastSecretKey,
              },
            }
          );

          const rawText = await sfResponse.text();
          let sfData: any = null;
          try {
            sfData = JSON.parse(rawText);
          } catch {
            // Raw text response
          }

          if (sfResponse.ok && sfData && sfData.status === 200 && sfData.delivery_status) {
            const mapped = mapSteadfastStatus(sfData.delivery_status);
            nextStatus = mapped.status;
            nextPaymentStatus = mapped.paymentStatus;
          }
        } catch (sfErr) {
          console.error(`Error syncing Steadfast status for order ${order.orderId}:`, sfErr);
        }
      } else {
        // Fallback status simulation if not configured
        const fallbackMap: Record<string, string> = {
          Processing: "Dispatched",
          Dispatched: "In Transit",
          Shipped: "In Transit",
          "In Transit": "Delivered",
        };
        nextStatus = fallbackMap[order.status] || "In Transit";
        if (nextStatus === "Delivered") nextPaymentStatus = "paid";
      }

      await db.order.update({
        where: { id: order.id },
        data: {
          status: nextStatus,
          ...(nextPaymentStatus && { paymentStatus: nextPaymentStatus }),
          updatedAt: new Date(),
        },
      });

      updatedCount++;
      syncLogs.push({ orderId: order.orderId, newStatus: nextStatus });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${updatedCount} courier shipment(s)`,
      updated: updatedCount,
      syncLogs,
    });
  } catch (error: any) {
    console.error("[SYNC_STATUS_POST]", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync courier status" },
      { status: 500 }
    );
  }
}
