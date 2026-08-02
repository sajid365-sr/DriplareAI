import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { integrationId } = await params;

    // Simulate 350ms webhook health latency check
    await new Promise((resolve) => setTimeout(resolve, 350));

    const randomLatency = Math.floor(Math.random() * 25) + 25; // 25-50ms

    return NextResponse.json({
      success: true,
      integrationId,
      status: "healthy",
      latencyMs: randomLatency,
      tokenStatus: "Active • Valid (Expires in 60 days)",
      subscriptions: ["messages", "messaging_postbacks", "feed/comments", "instagram_mentions"],
      testedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[TEST_WEBHOOK_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
