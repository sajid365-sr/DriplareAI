import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await db.user.findUnique({
      where: { userId },
      select: { referralCode: true },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const referrals = await db.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        referredUser: { select: { name: true, email: true, plan: true, createdAt: true } },
      },
    });

    const totalEarned = referrals.reduce((sum, r) => sum + r.rewardPoints, 0);
    const totalReferrals = referrals.length;

    const referralList = referrals.map((r) => ({
      id: r.id,
      name: r.referredUser.name,
      email: r.referredUser.email,
      joinedAt: r.createdAt,
      status: r.rewardPoints > 0 ? "subscribed" : "signed_up",
      rewardEarned: r.rewardPoints,
    }));

    return NextResponse.json({
      referralCode: user.referralCode,
      totalReferrals,
      totalEarned,   // in "messages" unit
      referrals: referralList,
    });
  } catch (e) {
    console.error("[GET /api/referral]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
