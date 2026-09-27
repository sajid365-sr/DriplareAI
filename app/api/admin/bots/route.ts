import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";

function parsePagination(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export async function GET(req: Request) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const status = url.searchParams.get("status")?.trim() ?? "";

    // Build filter criteria
    const where: Record<string, unknown> = {};

    if (status && status !== "all") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { workspace: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Parallel execution for metrics, bot list, and total count
    const [
      totalActiveBots,
      totalTrainingChunks,
      globalChatSessions,
      totalBots,
      rawBots,
      total,
    ] = await Promise.all([
      db.chatbot.count({ where: { status: "active" } }),
      db.chunk.count(),
      db.chatSession.count(),
      db.chatbot.count(),
      db.chatbot.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          chatbotId: true,
          name: true,
          model: true,
          provider: true,
          temperature: true,
          maxTokens: true,
          systemPrompt: true,
          status: true,
          avatarColor: true,
          avatarBase64: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              userId: true,
              name: true,
              email: true,
              picture: true,
            },
          },
          workspace: {
            select: {
              workspaceId: true,
              name: true,
            },
          },
          _count: {
            select: {
              sources: true,
              sessions: true,
              messages: true,
              integrations: true,
            },
          },
          integrations: {
            select: {
              id: true,
              integrationId: true,
              platform: true,
              connected: true,
              status: true,
              connectedAt: true,
            },
          },
          sessions: {
            take: 1,
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          },
        },
      }),
      db.chatbot.count({ where }),
    ]);

    // Format bots list to extract lastActiveAt timestamp
    const bots = rawBots.map((bot) => {
      const lastSessionAt = bot.sessions[0]?.updatedAt ?? bot.updatedAt;
      return {
        id: bot.id,
        chatbotId: bot.chatbotId,
        name: bot.name,
        model: bot.model,
        provider: bot.provider,
        temperature: bot.temperature,
        maxTokens: bot.maxTokens,
        systemPrompt: bot.systemPrompt,
        status: bot.status,
        avatarColor: bot.avatarColor,
        avatarBase64: bot.avatarBase64,
        createdAt: bot.createdAt,
        updatedAt: bot.updatedAt,
        lastActiveAt: lastSessionAt,
        user: bot.user,
        workspace: bot.workspace,
        sourcesCount: bot._count.sources,
        sessionsCount: bot._count.sessions,
        messagesCount: bot._count.messages,
        integrations: bot.integrations,
      };
    });

    return NextResponse.json({
      metrics: {
        totalActiveBots,
        totalTrainingChunks,
        globalChatSessions,
        totalBots,
      },
      bots,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[ADMIN_BOTS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
