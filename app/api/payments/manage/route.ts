import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/plan-config";

export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "downgrade") {
      // Downgrade to starter plan
      const starterPlan = getPlan((user.region as any) || "bd", "starter");
      
      await db.user.update({
        where: { userId: user.userId },
        data: {
          plan: "starter",
          includedMessages: starterPlan.includedMessages,
          // We don't reset messagesUsedThisCycle here to prevent abuse
        }
      });

      // Create notification
      await db.notification.create({
        data: {
          userId: user.userId,
          type: "plan",
          title: "Plan Downgraded",
          message: "Your subscription has been changed to the Starter plan.",
        }
      });

      return NextResponse.json({ success: true, message: "Plan downgraded to Starter" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[PAYMENT_MANAGE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
