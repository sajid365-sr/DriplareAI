import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getChannelFamily, getChannelIdentity } from "@/lib/domain/channel-binding";

export async function POST(req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  const workspace = await db.workspace.findFirst({ where: { workspaceId, userId }, select: { workspaceId: true } });
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    const body = await req.json() as { chatbotId?: unknown; platform?: unknown };
    if (typeof body.chatbotId !== "string" || typeof body.platform !== "string") {
      return NextResponse.json({ error: "chatbotId and platform are required" }, { status: 400 });
    }
    const chatbots = await db.chatbot.findMany({ where: { workspaceId }, select: { chatbotId: true } });
    const chatbotIds = chatbots.map((bot) => bot.chatbotId);
    const target = await db.integration.findFirst({
      where: { chatbotId: body.chatbotId, platform: body.platform, chatbot: { workspaceId } },
      select: { chatbotId: true, platform: true, config: true },
    });
    if (!target) return NextResponse.json({ error: "Channel is not configured for this agent" }, { status: 404 });
    const identity = getChannelIdentity(target.platform, target.config);
    if (!identity) return NextResponse.json({ error: "This channel does not support agent switching" }, { status: 400 });

    const sameChannel = (await db.integration.findMany({
      where: { chatbotId: { in: chatbotIds } },
      select: { id: true, chatbotId: true, platform: true, config: true },
    })).filter((row) => getChannelFamily(row.platform) === getChannelFamily(target.platform)
      && getChannelIdentity(row.platform, row.config) === identity);

    await db.$transaction(async (tx) => {
      for (const integration of sameChannel) {
        await tx.integration.update({ where: { id: integration.id }, data: { connected: integration.chatbotId === target.chatbotId, status: integration.chatbotId === target.chatbotId ? "active" : "standby" } });
      }
    });
    return NextResponse.json({ success: true, chatbotId: target.chatbotId, platform: target.platform });
  } catch (error) {
    console.error("[CHANNEL_ASSIGN]", error);
    return NextResponse.json({ error: "Failed to switch channel agent" }, { status: 500 });
  }
}
