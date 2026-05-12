import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { trackReferral } from "@/lib/auth";

// POST /api/referral/track — call this after user signs up via referral link
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { referralCode } = await req.json();
    if (!referralCode) return NextResponse.json({ error: "No referral code" }, { status: 400 });

    await trackReferral(userId, referralCode);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[POST /api/referral/track]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
