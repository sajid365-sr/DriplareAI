import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";

/** Re-enable AI for conversations whose assignment pause has expired. */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const { count } = await db.chatSession.updateMany({
      where: {
        assignmentAiPaused: true,
        assignmentAiResumeAt: { lte: now },
      },
      data: {
        isActive: true,
        assignmentAiPaused: false,
        assignmentAiResumeAt: null,
      },
    });

    return NextResponse.json({ resumed: count, resumedAt: now.toISOString() });
  } catch (error) {
    console.error("[RESUME_ASSIGNED_AI_CRON]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
