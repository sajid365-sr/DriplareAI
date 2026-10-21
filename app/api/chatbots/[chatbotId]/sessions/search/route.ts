import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;
    const url = new URL(req.url);
    const query = url.searchParams.get("q")?.trim() || "";

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const botIds = Array.from(new Set([bot.id, bot.chatbotId]));

    // Search messages across this chatbot containing the search term
    const matchedMessages = await db.chatMessage.findMany({
      where: {
        chatbotId: { in: botIds },
        content: {
          contains: query,
          mode: "insensitive",
        },
      },
      orderBy: { timestamp: "desc" },
      take: 50,
      select: {
        id: true,
        sessionId: true,
        role: true,
        content: true,
        timestamp: true,
      },
    });

    if (matchedMessages.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Group matching snippets by sessionId to show best match per session
    const sessionsMap = new Map<
      string,
      {
        sessionId: string;
        matchedSnippet: string;
        matchRole: string;
        timestamp: string;
        matchCount: number;
      }
    >();

    for (const msg of matchedMessages) {
      if (!sessionsMap.has(msg.sessionId)) {
        // Extract a snippet around the match
        const lowerContent = msg.content.toLowerCase();
        const matchIdx = lowerContent.indexOf(query.toLowerCase());
        const start = Math.max(0, matchIdx - 30);
        const end = Math.min(msg.content.length, matchIdx + query.length + 50);
        let snippet = msg.content.slice(start, end);
        if (start > 0) snippet = "..." + snippet;
        if (end < msg.content.length) snippet = snippet + "...";

        sessionsMap.set(msg.sessionId, {
          sessionId: msg.sessionId,
          matchedSnippet: snippet,
          matchRole: msg.role,
          timestamp: msg.timestamp.toISOString(),
          matchCount: 1,
        });
      } else {
        const item = sessionsMap.get(msg.sessionId)!;
        item.matchCount += 1;
      }
    }

    const results = Array.from(sessionsMap.values());
    return NextResponse.json({ results });
  } catch (error) {
    console.error("[SEARCH_MESSAGES_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

