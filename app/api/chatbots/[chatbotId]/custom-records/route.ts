import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { Prisma } from "@prisma/client";

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

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const schemaSlug = searchParams.get("schema");
    const schemaId = searchParams.get("schemaId");
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const workspaceBots = bot.workspaceId
      ? await db.chatbot.findMany({ where: { workspaceId: bot.workspaceId }, select: { chatbotId: true } })
      : [{ chatbotId: bot.chatbotId }];
    const chatbotIds = workspaceBots.map((workspaceBot) => workspaceBot.chatbotId);

    // Data records are business-wide: show submissions from every agent in this workspace.
    const where: Prisma.CustomRecordWhereInput = { chatbotId: { in: chatbotIds } };

    if (schemaId) {
      where.schemaId = schemaId;
    } else if (schemaSlug) {
      where.schema = {
        is: {
          slug: schemaSlug,
          ...(bot.workspaceId
            ? { OR: [{ workspaceId: bot.workspaceId }, { workspaceId: null, chatbotId: { in: chatbotIds } }] }
            : { chatbotId: bot.chatbotId }),
        },
      };
    }

    if (status && status !== "all") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, records] = await Promise.all([
      db.customRecord.count({ where }),
      db.customRecord.findMany({
        where,
        include: {
          schema: {
            select: { id: true, name: true, slug: true, fields: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[CUSTOM_RECORDS_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

