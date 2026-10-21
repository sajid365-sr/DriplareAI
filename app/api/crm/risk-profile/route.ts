import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getActiveWorkspace } from "@/lib/core/workspace-server";
import { calculateRiskProfile } from "@/lib/domain/customer-risk";

/** GET /api/crm/risk-profile?phone=017...
 * Looks up historical delivery record for phone number and computes risk profile (Feature #25).
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const phone = url.searchParams.get("phone");

    if (!phone) {
      return NextResponse.json({ error: "phone parameter is required" }, { status: 400 });
    }

    const workspace = await getActiveWorkspace(userId);
    const userBots = await db.chatbot.findMany({
      where: { userId, workspaceId: workspace.workspaceId },
      select: { id: true, chatbotId: true },
    });

    const botIds = Array.from(new Set(userBots.flatMap((b) => [b.id, b.chatbotId])));

    const orders = await db.order.findMany({
      where: {
        chatbotId: { in: botIds },
        customerPhone: phone,
      },
      select: {
        id: true,
        status: true,
        orderId: true,
        totalAmount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const profile = calculateRiskProfile(phone, orders);

    return NextResponse.json({ success: true, profile, recentOrders: orders });
  } catch (error) {
    console.error("[CRM_RISK_PROFILE_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

