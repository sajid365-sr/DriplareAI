import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { deliverInboxMessage } from "@/lib/services/inbox-delivery";

/**
 * Feature #15: Comment Re-engagement (No DM reply follow-up)
 *
 * GET /api/cron/comment-followup
 * Periodic cron job (e.g. every 5–15 minutes) to find commenters who received an
 * auto-DM but have not replied within the merchant's configured delay window,
 * sending an automated friendly follow-up DM.
 */
export async function GET(req: Request) {
  try {
    // 1. Optional Cron Secret Authorization check
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Allow internal/local cron runs if secret not configured, else verify
      const isDevelopment = process.env.NODE_ENV !== "production";
      if (!isDevelopment) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const now = new Date();

    // 2. Fetch pending follow-up logs due for re-engagement
    const pendingLogs = await db.commentAutomationLog.findMany({
      where: {
        hasCustomerReplied: false,
        followUpSentAt: null,
        followUpDueAt: { lte: now },
        commentAutomation: {
          isActive: true,
          enableFollowUp: true,
        },
      },
      include: {
        commentAutomation: true,
      },
      take: 50,
    });

    if (pendingLogs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending comment follow-ups due",
        processed: 0,
      });
    }

    let sentCount = 0;
    let repliedCount = 0;

    for (const log of pendingLogs) {
      const { commentAutomation } = log;

      // 3. Check if customer sent any message in chat since the auto-DM
      const recentCustomerMessage = await db.chatMessage.findFirst({
        where: {
          chatbotId: commentAutomation.chatbotId,
          role: "user",
          sessionId: log.commenterId,
          timestamp: { gt: log.dmSentAt },
        },
      });

      if (recentCustomerMessage) {
        // Customer already engaged! Mark as replied so no follow-up is needed
        await db.commentAutomationLog.update({
          where: { id: log.id },
          data: { hasCustomerReplied: true },
        });
        repliedCount++;
        continue;
      }

      // 4. Send Re-engagement Follow-up DM
      const followUpText =
        commentAutomation.followUpDmText ||
        "Hello again! Please let us know if you have any questions or would like to place an order.";

      try {
        await deliverInboxMessage({
          botIds: [commentAutomation.chatbotId],
          sessionId: log.commenterId,
          text: followUpText,
        });

        // Mirror to ChatMessage
        const bot = await db.chatbot.findFirst({
          where: {
            OR: [
              { chatbotId: commentAutomation.chatbotId },
              { id: commentAutomation.chatbotId },
            ],
          },
          select: { userId: true },
        });

        if (bot?.userId) {
          await db.chatMessage.create({
            data: {
              chatbotId: commentAutomation.chatbotId,
              userId: bot.userId,
              sessionId: log.commenterId,
              role: "assistant",
              content: followUpText,
              sentByHuman: false,
              mediaType: "text",
            },
          });
        }

        // 5. Update log & statistics
        await db.commentAutomationLog.update({
          where: { id: log.id },
          data: { followUpSentAt: now },
        });

        await db.commentAutomation.update({
          where: { id: commentAutomation.id },
          data: { totalFollowUps: { increment: 1 } },
        });

        sentCount++;
      } catch (sendErr) {
        console.error("[COMMENT_FOLLOWUP_DISPATCH_ERROR]", log.id, sendErr);
      }
    }

    return NextResponse.json({
      success: true,
      processed: pendingLogs.length,
      sentCount,
      repliedCount,
    });
  } catch (error) {
    console.error("[CRON_COMMENT_FOLLOWUP_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
