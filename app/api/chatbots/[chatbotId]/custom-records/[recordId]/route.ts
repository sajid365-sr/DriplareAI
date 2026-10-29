import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { UpdateCustomRecordDto } from "@/lib/domain/custom-entity";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; recordId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId, recordId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const workspaceBots = bot.workspaceId
      ? await db.chatbot.findMany({ where: { workspaceId: bot.workspaceId }, select: { chatbotId: true } })
      : [{ chatbotId: bot.chatbotId }];
    const record = await db.customRecord.findFirst({
      where: { id: recordId, chatbotId: { in: workspaceBots.map((workspaceBot) => workspaceBot.chatbotId) } },
    });

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const body = await req.json();
    const validated = UpdateCustomRecordDto.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const { status, notes, data } = validated.data;

    const updated = await db.customRecord.update({
      where: { id: recordId },
      data: {
        ...(status ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(data ? { data: JSON.parse(JSON.stringify(data)) } : {}),
      },
      include: {
        schema: {
          select: { id: true, name: true, slug: true, fields: true },
        },
      },
    });

    return NextResponse.json({ record: updated });
  } catch (error) {
    console.error("[CUSTOM_RECORD_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; recordId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId, recordId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const workspaceBots = bot.workspaceId
      ? await db.chatbot.findMany({ where: { workspaceId: bot.workspaceId }, select: { chatbotId: true } })
      : [{ chatbotId: bot.chatbotId }];
    const record = await db.customRecord.findFirst({
      where: { id: recordId, chatbotId: { in: workspaceBots.map((workspaceBot) => workspaceBot.chatbotId) } },
    });

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    await db.customRecord.delete({
      where: { id: recordId },
    });

    return NextResponse.json({ success: true, message: "Record deleted" });
  } catch (error) {
    console.error("[CUSTOM_RECORD_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

