import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { deleteTrainingSource } from "@/lib/ai/qa-training";

type BulkAction = "delete" | "archive" | "unarchive";

/**
 * Bulk operations on Sample Replies — delete, archive, or unarchive multiple at once.
 * POST /api/chatbots/[chatbotId]/sample-replies/bulk
 * Body: { action: "delete" | "archive" | "unarchive", ids: string[] }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId: identifier } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action, ids } = (await req.json()) as { action: BulkAction; ids: string[] };

    if (!action || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "action and ids[] are required" },
        { status: 400 }
      );
    }

    if (!["delete", "archive", "unarchive"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'delete', 'archive', or 'unarchive'" },
        { status: 400 }
      );
    }

    const bot = await getOwnedChatbot(userId, identifier);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Fetch all matching Sample Replies owned by this chatbot
    const replies = await db.sampleReply.findMany({
      where: { chatbotId: bot.chatbotId, sampleReplyId: { in: ids } },
    });

    if (replies.length === 0) {
      return NextResponse.json({ error: "No sample replies found", deleted: 0, updated: 0 }, { status: 404 });
    }

    const matchedIds = replies.map((r) => r.sampleReplyId);

    if (action === "delete") {
      // Delete companion Sources (best-effort)
      for (const reply of replies) {
        if (reply.sourceId) {
          await deleteTrainingSource(reply.sourceId);
        }
      }

      // Bulk delete
      const result = await db.sampleReply.deleteMany({
        where: { chatbotId: bot.chatbotId, sampleReplyId: { in: matchedIds } },
      });

      return NextResponse.json({ deleted: result.count });
    }

    // Archive / Unarchive
    const archived = action === "archive";
    const result = await db.sampleReply.updateMany({
      where: { chatbotId: bot.chatbotId, sampleReplyId: { in: matchedIds } },
      data: { archived },
    });

    return NextResponse.json({ updated: result.count, archived });
  } catch (error) {
    console.error("[SAMPLE_REPLY_BULK_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
