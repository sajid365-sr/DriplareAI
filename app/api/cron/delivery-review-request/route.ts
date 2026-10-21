import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { sendReviewRequest } from "@/lib/services/delivery-notifications";

/** GET /api/cron/delivery-review-request
 * Cron: finds orders delivered within the last 24-48h window without a review request and sends one (Feature #24).
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const eligibleOrders = await db.order.findMany({
      where: {
        status: "Delivered",
        reviewRequestSentAt: null,
        updatedAt: {
          gte: fortyEightHoursAgo,
          lte: twentyFourHoursAgo,
        },
        sessionId: { not: "" },
      },
      take: 100,
    });

    if (eligibleOrders.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: "No eligible orders" });
    }

    const chatbotIds = [...new Set(eligibleOrders.map((o) => o.chatbotId))];
    const chatbots = await db.chatbot.findMany({
      where: { chatbotId: { in: chatbotIds } },
      select: { chatbotId: true, id: true },
    });

    const botIdsMap = new Map<string, string[]>();
    for (const bot of chatbots) {
      botIdsMap.set(bot.chatbotId, [bot.id, bot.chatbotId]);
    }

    let sentCount = 0;

    for (const order of eligibleOrders) {
      const botIds = botIdsMap.get(order.chatbotId);
      if (!botIds) continue;

      await sendReviewRequest({
        orderId: order.id,
        botIds,
        sessionId: order.sessionId,
        customerName: order.customerName,
        orderPublicId: order.orderId,
      });

      sentCount++;
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      message: `Sent ${sentCount} review request(s)`,
    });
  } catch (error) {
    console.error("[CRON_REVIEW_REQUEST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
