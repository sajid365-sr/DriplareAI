import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAutomationScope } from "@/lib/automations/access";
import { tagWriteSchema } from "@/lib/automations/schema";

/**
 * GET  /api/automations/tags — the workspace's tags, with usage counts
 * POST /api/automations/tags — create one
 *
 * Tags are shared with the Live Inbox, so this list is the same set an agent
 * applies by hand. An automation that tags a conversation therefore feeds the
 * manual workflow as well — which is the point: "tagged by rule" and "tagged by
 * hand" have to be the same vocabulary, or neither the filters nor the
 * broadcast audiences can be trusted.
 */

export async function GET() {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;

  try {
    const tags = await db.contactTag.findMany({
      where: { workspaceId: scope.workspaceId },
      orderBy: { name: "asc" },
    });

    const counts = await db.sessionTag.groupBy({
      by: ["tagId"],
      where: { tag: { workspaceId: scope.workspaceId } },
      _count: { _all: true },
    });

    const usage = new Map(counts.map((row) => [row.tagId, row._count._all]));

    return NextResponse.json({
      tags: tags.map((tag) => ({
        tagId: tag.tagId,
        name: tag.name,
        color: tag.color,
        sessions: usage.get(tag.tagId) ?? 0,
        createdAt: tag.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[AUTOMATION_TAGS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;

  try {
    const parsed = tagWriteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    // `@@unique([workspaceId, name])` makes this a lookup rather than a create
    // when the tag already exists. That is the friendlier outcome: a merchant
    // retyping "VIP" wants the existing tag, not a 500 from a constraint
    // violation.
    const existing = await db.contactTag.findFirst({
      where: { workspaceId: scope.workspaceId, name: parsed.data.name },
    });
    if (existing) {
      // The real usage count, not a placeholder zero: the client merges this
      // response straight into its list, and a tag that reports "0 sessions"
      // next to its own duplicate would look like the count had been reset.
      const sessions = await db.sessionTag.count({ where: { tagId: existing.tagId } });

      return NextResponse.json(
        {
          tag: {
            tagId: existing.tagId,
            name: existing.name,
            color: existing.color,
            sessions,
            createdAt: existing.createdAt.toISOString(),
          },
          existed: true,
        },
        { status: 200 }
      );
    }

    const tag = await db.contactTag.create({
      data: {
        workspaceId: scope.workspaceId,
        name: parsed.data.name,
        color: parsed.data.color,
      },
    });

    return NextResponse.json(
      {
        tag: {
          tagId: tag.tagId,
          name: tag.name,
          color: tag.color,
          sessions: 0,
          createdAt: tag.createdAt.toISOString(),
        },
        existed: false,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[AUTOMATION_TAGS_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
