import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { deleteTrainingSource } from "@/lib/ai/qa-training";

type BulkAction = "delete" | "archive" | "unarchive";

/**
 * Bulk operations on FAQs — delete, archive, or unarchive multiple FAQs at once.
 * POST /api/chatbots/[chatbotId]/faqs/bulk
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

    // Fetch all matching FAQs owned by this chatbot
    const faqs = await db.faq.findMany({
      where: { chatbotId: bot.chatbotId, faqId: { in: ids } },
    });

    if (faqs.length === 0) {
      return NextResponse.json({ error: "No FAQs found", deleted: 0, updated: 0 }, { status: 404 });
    }

    const matchedIds = faqs.map((f) => f.faqId);

    if (action === "delete") {
      // Delete companion Sources (best-effort)
      for (const faq of faqs) {
        if (faq.sourceId) {
          await deleteTrainingSource(faq.sourceId);
        }
      }

      // Bulk delete FAQs
      const result = await db.faq.deleteMany({
        where: { chatbotId: bot.chatbotId, faqId: { in: matchedIds } },
      });

      return NextResponse.json({ deleted: result.count });
    }

    // Archive / Unarchive — just flip the boolean
    const archived = action === "archive";
    const result = await db.faq.updateMany({
      where: { chatbotId: bot.chatbotId, faqId: { in: matchedIds } },
      data: { archived },
    });

    return NextResponse.json({ updated: result.count, archived });
  } catch (error) {
    console.error("[FAQ_BULK_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
