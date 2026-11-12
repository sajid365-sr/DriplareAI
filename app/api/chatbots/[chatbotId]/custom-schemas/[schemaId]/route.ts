import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { UpdateCustomTableSchemaDto } from "@/lib/domain/custom-entity";
import { syncChatbotCustomPrompt } from "@/lib/ai/prompt-assembler";
import { getWorkspaceBusinessBotIds } from "@/lib/domain/workspace-business-forms";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; schemaId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId, schemaId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const chatbotIds = await getWorkspaceBusinessBotIds(bot.workspaceId, bot.chatbotId);

    const schema = await db.customTableSchema.findFirst({
      where: bot.workspaceId
        ? { id: schemaId, OR: [{ workspaceId: bot.workspaceId }, { workspaceId: null, chatbotId: { in: chatbotIds } }] }
        : { id: schemaId, chatbotId: bot.chatbotId },
      include: {
        _count: {
          select: { records: true },
        },
      },
    });

    if (!schema) {
      return NextResponse.json({ error: "Schema not found" }, { status: 404 });
    }

    return NextResponse.json({ schema });
  } catch (error) {
    console.error("[CUSTOM_SCHEMA_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; schemaId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId, schemaId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const chatbotIds = await getWorkspaceBusinessBotIds(bot.workspaceId, bot.chatbotId);

    const body = await req.json();
    const validated = UpdateCustomTableSchemaDto.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await db.customTableSchema.findFirst({
      where: bot.workspaceId
        ? { id: schemaId, OR: [{ workspaceId: bot.workspaceId }, { workspaceId: null, chatbotId: { in: chatbotIds } }] }
        : { id: schemaId, chatbotId: bot.chatbotId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Schema not found" }, { status: 404 });
    }

    const updateData = {
        ...(validated.data.name ? { name: validated.data.name } : {}),
        ...(validated.data.description !== undefined ? { description: validated.data.description } : {}),
        ...(validated.data.fields ? { fields: JSON.parse(JSON.stringify(validated.data.fields)) } : {}),
        ...(validated.data.isVisibleInSidebar !== undefined ? { isVisibleInSidebar: validated.data.isVisibleInSidebar } : {}),
    };
    const sharedFormScope = bot.workspaceId
      ? { slug: existing.slug, OR: [{ workspaceId: bot.workspaceId }, { workspaceId: null, chatbotId: { in: chatbotIds } }] }
      : { slug: existing.slug, chatbotId: bot.chatbotId };
    await db.customTableSchema.updateMany({ where: sharedFormScope, data: updateData });
    const updated = await db.customTableSchema.findUnique({ where: { id: schemaId } });

    // Keep all agents in this business in sync with the shared form definitions.
    const workspaceBots = bot.workspaceId
      ? chatbotIds
      : [bot.chatbotId];
    await Promise.all(workspaceBots.map((workspaceBotId) => syncChatbotCustomPrompt(workspaceBotId)));

    return NextResponse.json({ schema: updated });
  } catch (error) {
    console.error("[CUSTOM_SCHEMA_PUT_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; schemaId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId, schemaId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const chatbotIds = await getWorkspaceBusinessBotIds(bot.workspaceId, bot.chatbotId);

    const existing = await db.customTableSchema.findFirst({
      where: bot.workspaceId
        ? { id: schemaId, OR: [{ workspaceId: bot.workspaceId }, { workspaceId: null, chatbotId: { in: chatbotIds } }] }
        : { id: schemaId, chatbotId: bot.chatbotId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Schema not found" }, { status: 404 });
    }

    await db.customTableSchema.deleteMany({
      where: bot.workspaceId
        ? { slug: existing.slug, OR: [{ workspaceId: bot.workspaceId }, { workspaceId: null, chatbotId: { in: chatbotIds } }] }
        : { slug: existing.slug, chatbotId: bot.chatbotId },
    });

    const workspaceBots = bot.workspaceId
      ? chatbotIds
      : [bot.chatbotId];
    await Promise.all(workspaceBots.map((workspaceBotId) => syncChatbotCustomPrompt(workspaceBotId)));

    return NextResponse.json({ success: true, message: "Schema deleted" });
  } catch (error) {
    console.error("[CUSTOM_SCHEMA_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

