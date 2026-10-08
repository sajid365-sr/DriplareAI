import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAutomationScope } from "@/lib/automations/access";
import {
  broadcastWriteSchema,
  parseBroadcastAudience,
} from "@/lib/automations/schema";
import { json } from "@/lib/automations/persist";

/**
 * GET    /api/automations/broadcasts/[broadcastId] — one broadcast + recipients
 * PATCH  /api/automations/broadcasts/[broadcastId] — edit a draft
 * DELETE /api/automations/broadcasts/[broadcastId]
 *
 * Editing is refused once delivery has started. Changing the body of a
 * half-sent broadcast would mean the first half of the audience received one
 * message and the second half another, with the UI showing only the new text —
 * so the copy has to be frozen at the moment the first recipient is queued.
 */

export async function GET(
  req: Request,
  { params }: { params: Promise<{ broadcastId: string }> }
) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;
  const { broadcastId } = await params;

  try {
    const broadcast = await db.broadcast.findFirst({
      where: { broadcastId, workspaceId: scope.workspaceId },
    });
    if (!broadcast) {
      return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const recipientStatus = url.searchParams.get("recipientStatus");

    const recipients = await db.broadcastRecipient.findMany({
      where: {
        broadcastId,
        ...(recipientStatus ? { status: recipientStatus } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    return NextResponse.json({
      broadcast: {
        broadcastId: broadcast.broadcastId,
        chatbotId: broadcast.chatbotId,
        name: broadcast.name,
        channel: broadcast.channel,
        templateId: broadcast.templateId,
        body: broadcast.body,
        audience: parseBroadcastAudience(broadcast.audience),
        scheduledAt: broadcast.scheduledAt?.toISOString() ?? null,
        status: broadcast.status,
        stats: broadcast.stats,
        createdAt: broadcast.createdAt.toISOString(),
        updatedAt: broadcast.updatedAt.toISOString(),
      },
      recipients: recipients.map((recipient) => ({
        id: recipient.id,
        sessionId: recipient.sessionId,
        chatbotId: recipient.chatbotId,
        status: recipient.status,
        error: recipient.error,
        sentAt: recipient.sentAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("[AUTOMATION_BROADCAST_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ broadcastId: string }> }
) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;
  const { broadcastId } = await params;

  try {
    const existing = await db.broadcast.findFirst({
      where: { broadcastId, workspaceId: scope.workspaceId },
      select: { broadcastId: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
    }

    if (existing.status === "sending" || existing.status === "sent") {
      return NextResponse.json(
        {
          error: "This broadcast has already started sending and can no longer be edited",
          status: existing.status,
        },
        { status: 409 }
      );
    }

    const parsed = broadcastWriteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;

    const updated = await db.broadcast.update({
      where: { broadcastId },
      data: {
        chatbotId: input.chatbotId || null,
        name: input.name,
        channel: input.channel,
        templateId: input.templateId || null,
        body: input.body,
        audience: json(input.audience ?? {}),
        scheduledAt,
        // Re-editing a scheduled broadcast whose date has passed would leave it
        // permanently scheduled and never sent; demoting it to a draft makes
        // the merchant press send again, which is the visible outcome.
        status: scheduledAt && scheduledAt.getTime() > Date.now() ? "scheduled" : "draft",
      },
    });

    return NextResponse.json({ broadcastId: updated.broadcastId, status: updated.status });
  } catch (error) {
    console.error("[AUTOMATION_BROADCAST_PATCH]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ broadcastId: string }> }
) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;
  const { broadcastId } = await params;

  try {
    const existing = await db.broadcast.findFirst({
      where: { broadcastId, workspaceId: scope.workspaceId },
      select: { broadcastId: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
    }

    // Messages already delivered cannot be recalled, so deleting a broadcast
    // that has sent would erase the only record that they were sent. The
    // recipient rows cascade away with it, which is exactly why this is
    // refused rather than merely warned about.
    if (existing.status === "sending" || existing.status === "sent") {
      return NextResponse.json(
        {
          error: "Sent broadcasts cannot be deleted — they are the delivery record",
          status: existing.status,
        },
        { status: 409 }
      );
    }

    await db.broadcast.delete({ where: { broadcastId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AUTOMATION_BROADCAST_DELETE]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
