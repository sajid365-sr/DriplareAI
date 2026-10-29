import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { CreateCustomTableSchemaDto } from "@/lib/domain/custom-entity";
import { syncChatbotCustomPrompt } from "@/lib/ai/prompt-assembler";
import { ensureBusinessTableSchemas } from "@/lib/domain/business-zone";
import { getWorkspaceBusinessBotIds, listWorkspaceBusinessForms } from "@/lib/domain/workspace-business-forms";

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

    const workspace = bot.workspaceId
      ? await db.workspace.findUnique({ where: { workspaceId: bot.workspaceId }, select: { category: true } })
      : null;
    await ensureBusinessTableSchemas(bot.chatbotId, bot.workspaceId, workspace?.category || bot.chatbotMode);
    const chatbotIds = await getWorkspaceBusinessBotIds(bot.workspaceId, bot.chatbotId);
    const schemas = await listWorkspaceBusinessForms(bot.workspaceId, chatbotIds);

    return NextResponse.json({ schemas });
  } catch (error) {
    console.error("[CUSTOM_SCHEMAS_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
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

    const body = await req.json();
    const validated = CreateCustomTableSchemaDto.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const { name, slug, description, fields } = validated.data;

    // Keep form slugs unique across every agent in a workspace.
    const chatbotIds = await getWorkspaceBusinessBotIds(bot.workspaceId, bot.chatbotId);
    const existing = await db.customTableSchema.findFirst({
      where: bot.workspaceId
        ? { slug, OR: [{ workspaceId: bot.workspaceId }, { workspaceId: null, chatbotId: { in: chatbotIds } }] }
        : { chatbotId: bot.chatbotId, slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: `A schema with slug "${slug}" already exists for this chatbot.` },
        { status: 409 }
      );
    }

    const schema = await db.customTableSchema.create({
      data: {
        chatbotId: bot.chatbotId,
        workspaceId: bot.workspaceId,
        name,
        slug,
        description,
        fields: JSON.parse(JSON.stringify(fields)),
      },
    });

    const workspaceBots = bot.workspaceId
      ? await db.chatbot.findMany({ where: { workspaceId: bot.workspaceId }, select: { chatbotId: true } })
      : [{ chatbotId: bot.chatbotId }];
    await Promise.all(workspaceBots.map((workspaceBot) => syncChatbotCustomPrompt(workspaceBot.chatbotId)));

    return NextResponse.json({ schema }, { status: 201 });
  } catch (error) {
    console.error("[CUSTOM_SCHEMAS_POST_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

