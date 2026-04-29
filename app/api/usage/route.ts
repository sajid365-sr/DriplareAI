import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAndSyncUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAndSyncUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const enrichedUser = await db.user.findUnique({
      where: { userId: user.userId },
      include: {
        chatbots: { select: { id: true } },
        messages: { select: { id: true } },
      },
    });

    if (!enrichedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      points: enrichedUser.points,
      points_used: enrichedUser.pointsUsed,
      messages_total: enrichedUser.messages.length,
      chatbots_total: enrichedUser.chatbots.length,
      plan: enrichedUser.plan,
    });
  } catch (error) {
    console.error("[USAGE_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
