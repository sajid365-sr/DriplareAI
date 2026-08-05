import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";

/**
 * GET /api/user/credits
 * Returns the signed-in user's current credit balance.
 * Used by the Auto-Train Engine picker (and any credit-gated UI) to show
 * the "Credits available" line and disable actions when the balance is low.
 */
export async function GET() {
  try {
    const user = await getAndSyncUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userData = await db.user.findUnique({
      where: { userId: user.userId },
      select: { creditsBalance: true },
    });

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ creditsBalance: userData.creditsBalance });
  } catch (error) {
    console.error("[USER_CREDITS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
