import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getInboxAccessibleChatbot } from "@/lib/domain/chatbot-access";

interface MessageMatch {
  sessionId: string;
  matchedSnippet: string;
  matchRole: string;
  matchCount: number;
}

function getObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function buildSnippet(content: string, query: string): string {
  const matchIndex = content.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (matchIndex < 0) return content.slice(0, 100);
  const start = Math.max(0, matchIndex - 36);
  const end = Math.min(content.length, matchIndex + query.length + 54);
  return `${start > 0 ? "…" : ""}${content.slice(start, end)}${end < content.length ? "…" : ""}`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;
    const query = new URL(req.url).searchParams.get("q")?.trim() ?? "";

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (query.length < 2) return NextResponse.json({ results: [] });

    const bot = await getInboxAccessibleChatbot(userId, chatbotId);
    if (!bot) return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });

    const botIds = Array.from(new Set([bot.id, bot.chatbotId]));
    const [matchedMessages, matchedSessions, matchedOrders] = await Promise.all([
      db.chatMessage.findMany({
        where: {
          chatbotId: { in: botIds },
          content: { contains: query, mode: "insensitive" },
        },
        orderBy: { timestamp: "desc" },
        take: 100,
        select: { sessionId: true, role: true, content: true },
      }),
      db.chatSession.findMany({
        where: {
          chatbotId: { in: botIds },
          OR: [
            { guestName: { contains: query, mode: "insensitive" } },
            { sessionId: { contains: query, mode: "insensitive" } },
            { lastMessage: { contains: query, mode: "insensitive" } },
            { aiExtractionData: { path: ["phone"], string_contains: query } },
            { aiExtractionData: { path: ["orderId"], string_contains: query } },
          ],
        },
        take: 100,
        select: { sessionId: true },
      }),
      db.order.findMany({
        where: {
          chatbotId: { in: botIds },
          OR: [
            { orderId: { contains: query, mode: "insensitive" } },
            { customerName: { contains: query, mode: "insensitive" } },
            { customerPhone: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 100,
        select: { sessionId: true, orderId: true, customerPhone: true },
      }),
    ]);

    const messageMatches = new Map<string, MessageMatch>();
    for (const message of matchedMessages) {
      const match = messageMatches.get(message.sessionId);
      if (match) {
        match.matchCount += 1;
      } else {
        messageMatches.set(message.sessionId, {
          sessionId: message.sessionId,
          matchedSnippet: buildSnippet(message.content, query),
          matchRole: message.role,
          matchCount: 1,
        });
      }
    }

    const sessionIds = Array.from(new Set([
      ...matchedSessions.map((session) => session.sessionId),
      ...matchedOrders.map((order) => order.sessionId),
      ...messageMatches.keys(),
    ]));
    if (sessionIds.length === 0) return NextResponse.json({ results: [] });

    const sessions = await db.chatSession.findMany({
      where: { chatbotId: { in: botIds }, sessionId: { in: sessionIds } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    const results = await Promise.all(sessions.map(async (session) => {
      const [latestMessage, latestCustomerMessage, order] = await Promise.all([
        db.chatMessage.findFirst({
          where: { chatbotId: { in: botIds }, sessionId: session.sessionId },
          orderBy: { timestamp: "desc" },
          select: { content: true, role: true, sentByHuman: true, timestamp: true },
        }),
        db.chatMessage.findFirst({
          where: { chatbotId: { in: botIds }, sessionId: session.sessionId, role: "user" },
          orderBy: { timestamp: "desc" },
          select: { timestamp: true },
        }),
        db.order.findFirst({
          where: { chatbotId: { in: botIds }, sessionId: session.sessionId },
          orderBy: { updatedAt: "desc" },
          select: { orderId: true, customerPhone: true },
        }),
      ]);

      const extraction = getObject(session.aiExtractionData);
      const messageMatch = messageMatches.get(session.sessionId);
      const title = session.guestName || `${session.platform} user (${session.sessionId.slice(-5)})`;
      const phone = typeof extraction.phone === "string"
        ? extraction.phone
        : order?.customerPhone ?? null;
      const orderId = typeof extraction.orderId === "string"
        ? extraction.orderId
        : matchedOrders.find((item) => item.sessionId === session.sessionId)?.orderId ?? order?.orderId ?? null;

      return {
        sessionId: session.sessionId,
        title,
        platform: session.platform,
        isActive: session.isActive,
        isArchived: session.isArchived,
        isDone: session.isDone,
        snoozeUntil: session.snoozeUntil?.toISOString() ?? null,
        assignedToUserId: session.assignedToUserId,
        assignedAt: session.assignedAt?.toISOString() ?? null,
        assignmentNote: session.assignmentNote,
        assignmentAiPaused: session.assignmentAiPaused,
        assignmentAiResumeAt: session.assignmentAiResumeAt?.toISOString() ?? null,
        profilePhoto: session.profilePhoto,
        leadStatus: session.leadStatus,
        lastMessageSender: !latestMessage || latestMessage.role === "user"
          ? "customer"
          : latestMessage.sentByHuman
            ? "agent"
            : "ai",
        unread: Boolean(latestCustomerMessage && (!session.lastReadAt || latestCustomerMessage.timestamp > session.lastReadAt)),
        phone,
        orderId,
        lastMessage: latestMessage?.content?.slice(0, 160) ?? session.lastMessage ?? null,
        timestamp: latestMessage?.timestamp ?? session.updatedAt,
        matchedSnippet: messageMatch?.matchedSnippet ?? null,
        matchRole: messageMatch?.matchRole ?? null,
        matchCount: messageMatch?.matchCount ?? 0,
        aiExtractionData: extraction,
      };
    }));

    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return NextResponse.json({ results });
  } catch (error) {
    console.error("[SEARCH_MESSAGES_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
