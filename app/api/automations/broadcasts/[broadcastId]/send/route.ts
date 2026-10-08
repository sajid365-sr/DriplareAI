import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAutomationScope } from "@/lib/automations/access";
import { drainBroadcast, enqueueBroadcast, queuedCount } from "@/lib/automations/broadcast-sender";
import { MESSAGING_WINDOW_HOURS } from "@/lib/services/outbound";

/**
 * POST /api/automations/broadcasts/[broadcastId]/send
 *
 * Queues the audience, then delivers the first batch inline so a small
 * broadcast completes within the request and the merchant sees a real result
 * immediately. Anything beyond one batch is left queued for the cron to drain —
 * see the note in `broadcast-sender.ts` for why the work is split that way.
 *
 * This is the only irreversible action in the product. Everything after it is
 * delivery reporting.
 */

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ broadcastId: string }> }
) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;
  const { broadcastId } = await params;

  try {
    const broadcast = await db.broadcast.findFirst({
      where: { broadcastId, workspaceId: scope.workspaceId },
      select: { broadcastId: true, status: true, body: true, channel: true },
    });
    if (!broadcast) {
      return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
    }

    // Re-sending is allowed while a drain is still running — it tops up the
    // queue rather than duplicating it — but a finished broadcast is immutable.
    if (broadcast.status === "sent") {
      return NextResponse.json(
        { error: "This broadcast has already been sent", status: "sent" },
        { status: 409 }
      );
    }

    if (!broadcast.body.trim()) {
      return NextResponse.json({ error: "The broadcast has no message to send" }, { status: 400 });
    }

    const enqueued = await enqueueBroadcast(broadcastId);

    if (enqueued.targeted === 0) {
      // Nothing matched the filter. Reverting to `draft` matters: leaving it in
      // `sending` would show a broadcast that is visibly stuck forever.
      await db.broadcast.update({ where: { broadcastId }, data: { status: "draft" } });
      return NextResponse.json(
        {
          error: "No contacts match this audience",
          targeted: 0,
          hint: "Widen the audience filters, or check that the selected agent has conversations.",
        },
        { status: 400 }
      );
    }

    const drained = await drainBroadcast(broadcastId);
    const remaining = await queuedCount(broadcastId);

    return NextResponse.json({
      targeted: enqueued.targeted,
      sent: drained.sent,
      failed: drained.failed,
      remaining,
      complete: drained.complete,
      /**
       * WhatsApp will not deliver a business-initiated message outside the
       * customer-service window unless it is an approved template, and the V1
       * send path carries free text. The drain records each affected recipient
       * as failed with `outside_messaging_window`, so this warning is what
       * turns a wall of failures into an explanation.
       */
      warning:
        broadcast.channel === "whatsapp"
          ? `WhatsApp only allows free-form messages within ${MESSAGING_WINDOW_HOURS} hours of the customer's last message. Recipients outside that window are skipped until approved templates are wired into the send path.`
          : null,
    });
  } catch (error) {
    console.error("[AUTOMATION_BROADCAST_SEND]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
