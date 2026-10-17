import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { assertChatbotInScope, requireAutomationScope } from "@/lib/automations/access";
import { broadcastWriteSchema, parseBroadcastAudience } from "@/lib/automations/schema";
import { json } from "@/lib/automations/persist";

/**
 * GET  /api/automations/broadcasts — the list
 * POST /api/automations/broadcasts — create a draft
 *
 * Creating never sends. A broadcast reaches every contact who matches a filter
 * simultaneously and cannot be recalled, so it always starts as a draft or a
 * schedule — the send is a separate, deliberate call to
 * `/broadcasts/[broadcastId]/send`.
 */

export async function GET(req: Request) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const chatbotId = url.searchParams.get("chatbotId");

    const rows = await db.broadcast.findMany({
      where: {
        workspaceId: scope.workspaceId,
        ...(status ? { status } : {}),
        ...(chatbotId ? { OR: [{ chatbotId: null }, { chatbotId }] } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
    });

    // Recipient tallies in one grouped query, so a list of 40 broadcasts does
    // not fan out into 40 counts per status.
    const grouped = await db.broadcastRecipient.groupBy({
      by: ["broadcastId", "status"],
      where: { broadcastId: { in: rows.map((row) => row.broadcastId) } },
      _count: { _all: true },
    });

    const tallies = new Map<string, Record<string, number>>();
    for (const row of grouped) {
      const bucket = tallies.get(row.broadcastId) ?? {};
      bucket[row.status] = row._count._all;
      tallies.set(row.broadcastId, bucket);
    }

    return NextResponse.json({
      broadcasts: rows.map((row) => {
        const counts = tallies.get(row.broadcastId) ?? {};
        const targeted = Object.values(counts).reduce((sum, value) => sum + value, 0);
        return {
          broadcastId: row.broadcastId,
          chatbotId: row.chatbotId,
          name: row.name,
          channel: row.channel,
          templateId: row.templateId,
          body: row.body,
          audience: parseBroadcastAudience(row.audience),
          scheduledAt: row.scheduledAt?.toISOString() ?? null,
          status: row.status,
          // Derived from the recipient rows rather than read from `stats`, so a
          // list rendered while a drain is running still shows live numbers.
          progress: {
            targeted,
            sent: counts.sent ?? 0,
            delivered: counts.delivered ?? 0,
            read: counts.read ?? 0,
            failed: counts.failed ?? 0,
            queued: counts.queued ?? 0,
          },
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        };
      }),
    });
  } catch (error) {
    console.error("[AUTOMATION_BROADCASTS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;

  try {
    const parsed = broadcastWriteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const invalidBot = assertChatbotInScope(scope, input.chatbotId);
    if (invalidBot) return invalidBot;

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;

    const broadcast = await db.broadcast.create({
      data: {
        workspaceId: scope.workspaceId,
        chatbotId: input.chatbotId || null,
        name: input.name,
        channel: input.channel,
        templateId: input.templateId || null,
        body: input.body,
        audience: json(input.audience ?? {}),
        scheduledAt,
        // A future date means "schedule it"; anything else stays a draft until
        // the merchant explicitly presses send.
        status: scheduledAt && scheduledAt.getTime() > Date.now() ? "scheduled" : "draft",
      },
    });

    return NextResponse.json({ broadcastId: broadcast.broadcastId, status: broadcast.status }, {
      status: 201,
    });
  } catch (error) {
    console.error("[AUTOMATION_BROADCASTS_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
