import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { pollSteadfast } from "@/lib/services/courier-poll";
import { sendDeliveryNotification } from "@/lib/services/delivery-notifications";
import type { DeliveryStatus } from "@/lib/templates/delivery-notification-templates";

const NOTIFIABLE_STATUSES: DeliveryStatus[] = [
  "Dispatched",
  "In Transit",
  "Out for Delivery",
  "Delivered",
];

/** GET /api/cron/courier-status-sync
 * Cron: polls courier APIs for status changes and sends automated customer delivery notifications.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const activeOrders = await db.order.findMany({
      where: {
        courierTrackingId: { not: null },
        status: { in: ["Processing", "Dispatched", "Shipped", "In Transit", "Out for Delivery"] },
      },
      take: 200,
    });

    if (activeOrders.length === 0) {
      return NextResponse.json({ success: true, updated: 0, message: "No active shipments" });
    }

    const chatbotIds = [...new Set(activeOrders.map((o) => o.chatbotId))];
    const chatbots = await db.chatbot.findMany({
      where: { chatbotId: { in: chatbotIds } },
      select: { chatbotId: true, id: true, userId: true },
    });

    const userIdMap = new Map<string, string>();
    for (const bot of chatbots) {
      userIdMap.set(bot.chatbotId, bot.userId);
      userIdMap.set(bot.id, bot.userId);
    }

    const uniqueUserIds = [...new Set(chatbots.map((b) => b.userId))];
    const configs = await db.courierConfig.findMany({
      where: { userId: { in: uniqueUserIds } },
    });
    const configMap = new Map(configs.map((c) => [c.userId, c]));

    let updatedCount = 0;
    const logs: { orderId: string; from: string; to: string }[] = [];

    for (const order of activeOrders) {
      const userId = userIdMap.get(order.chatbotId);
      if (!userId) continue;

      const config = configMap.get(userId);
      let newStatus: string | null = null;
      let newPaymentStatus: string | null = null;

      if (
        (order.courierName === "Steadfast" || !order.courierName) &&
        config?.steadfastApiKey &&
        config?.steadfastSecretKey &&
        order.courierTrackingId
      ) {
        const poll = await pollSteadfast(
          config.steadfastApiKey,
          config.steadfastSecretKey,
          order.courierTrackingId
        );
        if (poll.status && poll.status !== order.status) {
          newStatus = poll.status;
          newPaymentStatus = poll.paymentStatus;
        }
      }

      if (!newStatus || newStatus === order.status) continue;

      await db.order.update({
        where: { id: order.id },
        data: {
          status: newStatus,
          ...(newPaymentStatus ? { paymentStatus: newPaymentStatus } : {}),
          updatedAt: new Date(),
        },
      });

      logs.push({ orderId: order.orderId, from: order.status, to: newStatus });
      updatedCount++;

      // Trigger automated delivery notification on status change (Feature #23)
      if (
        NOTIFIABLE_STATUSES.includes(newStatus as DeliveryStatus) &&
        order.lastNotificationStatus !== newStatus &&
        order.sessionId &&
        order.courierTrackingId
      ) {
        const botRecord = chatbots.find(
          (b) => b.chatbotId === order.chatbotId || b.id === order.chatbotId
        );
        if (botRecord) {
          const botIds = [botRecord.id, botRecord.chatbotId];
          await sendDeliveryNotification({
            orderId: order.id,
            status: newStatus as DeliveryStatus,
            botIds,
            sessionId: order.sessionId,
            customerName: order.customerName,
            trackingId: order.courierTrackingId,
            courierName: order.courierName ?? "Courier",
            orderPublicId: order.orderId,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      logs,
      message: `Synced ${updatedCount} shipment(s)`,
    });
  } catch (error) {
    console.error("[CRON_COURIER_SYNC]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

