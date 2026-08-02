import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";

// ── POST /api/orders/sync-courier
// Simulates calling Steadfast/Pathao API to sync courier statuses
// In production: call real courier APIs using stored API keys from EcommerceConfig
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const chatbots = await db.chatbot.findMany({
      where: { userId },
      select: { chatbotId: true },
    });
    const chatbotIds = chatbots.map((b) => b.chatbotId);

    // Fetch all "Processing" or "Shipped" orders for this user
    const pendingOrders = await db.order.findMany({
      where: {
        chatbotId: { in: chatbotIds },
        status: { in: ["Processing", "Shipped"] },
        courierTrackingId: { not: null },
      },
    });

    if (pendingOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending orders to sync",
        updated: 0,
      });
    }

    // Mock status progression — in production, call Steadfast/Pathao API
    const statusProgression: Record<string, string> = {
      Processing: "Shipped",
      Shipped: "Delivered",
    };

    let updatedCount = 0;
    for (const order of pendingOrders) {
      const nextStatus = statusProgression[order.status];
      if (nextStatus) {
        await db.order.update({
          where: { id: order.id },
          data: {
            status: nextStatus,
            ...(nextStatus === "Delivered" && { paymentStatus: "paid" }),
            updatedAt: new Date(),
          },
        });
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${updatedCount} order(s) from courier APIs`,
      updated: updatedCount,
    });
  } catch (error) {
    console.error("[SYNC_COURIER]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
