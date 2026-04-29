import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { subDays, format } from "date-fns";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const messages = await db.chatMessage.findMany({
      where: { chatbotId },
      orderBy: { timestamp: "asc" },
    });

    const totalMessages = messages.length;
    const uniqueSessions = new Set(messages.map((m) => m.sessionId)).size;

    // Timeline array (Last 7 days)
    const timeline = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dateStr = format(d, "MMM dd");
      const count = messages.filter((m) => format(m.timestamp, "MMM dd") === dateStr).length;
      timeline.push({ date: dateStr, messages: count });
    }

    return NextResponse.json({
      total_messages: totalMessages,
      unique_sessions: uniqueSessions,
      avg_response_ms: totalMessages > 0 ? 840 : 0, // Mocked for now
      satisfaction: totalMessages > 0 ? 98 : 0,    // Mocked for now
      timeline,
    });
  } catch (error) {
    console.error("[ANALYTICS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
