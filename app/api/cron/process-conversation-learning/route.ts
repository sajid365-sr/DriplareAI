import { NextResponse } from "next/server";

import { processConversationLearningJobs } from "@/lib/ai/conversation-learning-jobs";
import { timingSafeEqualString } from "@/lib/core/timing-safe";

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    console.error("[CRON_CONVERSATION_LEARNING] CRON_SECRET is not configured.");
    return NextResponse.json({ error: "Cron is not configured." }, { status: 503 });
  }
  if (!timingSafeEqualString(request.headers.get("authorization"), `Bearer ${expectedSecret}`)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await processConversationLearningJobs();
    return NextResponse.json({ success: true, ...result, finishedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[CRON_CONVERSATION_LEARNING]", error);
    return NextResponse.json({ error: "Conversation learning worker failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
