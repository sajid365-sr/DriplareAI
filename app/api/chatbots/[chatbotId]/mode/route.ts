import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { z } from "zod";

const patchSchema = z.object({
  mode: z.enum(["live", "practice"]),
});

/**
 * PATCH /api/chatbots/[chatbotId]/mode
 *
 * Toggles the chatbot between "live" (default) and "practice" modes.
 *
 * Practice mode: Only the workspace owner's own test messages get AI replies.
 * All real customer messages are silently ignored — zero AI credits consumed.
 *
 * VideoScript: "শুরুতে agent থাকে practice mode। শুধু আপনার test message উত্তর দেয়,
 *               আসল customer না। পছন্দ হলে এক ক্লিকে live।"
 */
export async function PATCH(
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
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body — mode must be 'live' or 'practice'" },
        { status: 400 }
      );
    }

    const updated = await db.chatbot.update({
      where: { chatbotId: bot.chatbotId },
      data: { agentMode: parsed.data.mode },
      select: { chatbotId: true, name: true, agentMode: true },
    });

    return NextResponse.json({
      success: true,
      chatbotId: updated.chatbotId,
      agentMode: updated.agentMode,
      message:
        updated.agentMode === "practice"
          ? "Practice mode enabled — AI will only reply to your own test messages"
          : "Live mode enabled — AI responds to all customers",
    });
  } catch (error) {
    console.error("[CHATBOT_MODE_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

/**
 * GET /api/chatbots/[chatbotId]/mode
 * Returns the current agent mode for a chatbot.
 */
export async function GET(
  _req: Request,
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

    const chatbot = await db.chatbot.findUnique({
      where: { chatbotId: bot.chatbotId },
      select: { chatbotId: true, name: true, agentMode: true },
    });

    return NextResponse.json({
      chatbotId: chatbot?.chatbotId,
      agentMode: chatbot?.agentMode ?? "live",
    });
  } catch (error) {
    console.error("[CHATBOT_MODE_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

