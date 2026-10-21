import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { db } from "@/lib/core/db";
import { getActiveWorkspace } from "@/lib/core/workspace-server";

const commentAutomationSchema = z.object({
  id: z.string().optional(),
  chatbotId: z.string().min(1, "chatbotId is required"),
  postId: z.string().min(1, "postId is required"),
  postUrl: z.string().optional(),
  postTitle: z.string().optional(),
  postImageUrl: z.string().optional(),
  productIds: z.array(z.string()).default([]),
  publicReplyText: z.string().optional(),
  autoDmText: z.string().min(1, "Auto-DM message is required"),
  keywords: z.array(z.string()).default([]),
  enableFollowUp: z.boolean().default(false),
  followUpDelayMin: z.number().int().min(5).max(1440).default(30),
  followUpDmText: z.string().optional(),
  isActive: z.boolean().default(true),
});

/**
 * Feature #14 & #15: Comment Auto-DM + Product-aware Comment Reply
 *
 * GET /api/automations/comment?chatbotId=...
 * POST /api/automations/comment (Create or Update)
 * DELETE /api/automations/comment?id=...
 */

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getActiveWorkspace(userId);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const chatbotId = searchParams.get("chatbotId")?.trim();

    const rules = await db.commentAutomation.findMany({
      where: {
        workspaceId: workspace.id,
        ...(chatbotId ? { chatbotId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    // Collect all associated productIds to enrich response
    const allProductIds = Array.from(
      new Set(rules.flatMap((r) => r.productIds))
    );

    const products = allProductIds.length > 0
      ? await db.product.findMany({
          where: { productId: { in: allProductIds } },
          select: {
            productId: true,
            name: true,
            price: true,
            currency: true,
            imageUrl: true,
          },
        })
      : [];

    const productMap = new Map(products.map((p) => [p.productId, p]));

    const enrichedRules = rules.map((r) => ({
      ...r,
      linkedProducts: r.productIds.map((id) => productMap.get(id)).filter(Boolean),
    }));

    return NextResponse.json({
      success: true,
      rules: enrichedRules,
    });
  } catch (error) {
    console.error("[COMMENT_AUTOMATION_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getActiveWorkspace(userId);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = commentAutomationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (data.id) {
      // Update existing
      const existing = await db.commentAutomation.findUnique({
        where: { id: data.id },
      });

      if (!existing || existing.workspaceId !== workspace.id) {
        return NextResponse.json({ error: "Rule not found" }, { status: 404 });
      }

      const updated = await db.commentAutomation.update({
        where: { id: data.id },
        data: {
          chatbotId: data.chatbotId,
          postId: data.postId,
          postUrl: data.postUrl,
          postTitle: data.postTitle,
          postImageUrl: data.postImageUrl,
          productIds: data.productIds,
          publicReplyText: data.publicReplyText,
          autoDmText: data.autoDmText,
          keywords: data.keywords,
          enableFollowUp: data.enableFollowUp,
          followUpDelayMin: data.followUpDelayMin,
          followUpDmText: data.followUpDmText,
          isActive: data.isActive,
        },
      });

      return NextResponse.json({ success: true, rule: updated });
    }

    // Create new rule
    const created = await db.commentAutomation.create({
      data: {
        workspaceId: workspace.id,
        chatbotId: data.chatbotId,
        postId: data.postId,
        postUrl: data.postUrl,
        postTitle: data.postTitle,
        postImageUrl: data.postImageUrl,
        productIds: data.productIds,
        publicReplyText: data.publicReplyText,
        autoDmText: data.autoDmText,
        keywords: data.keywords,
        enableFollowUp: data.enableFollowUp,
        followUpDelayMin: data.followUpDelayMin,
        followUpDmText: data.followUpDmText,
        isActive: data.isActive,
      },
    });

    return NextResponse.json({ success: true, rule: created });
  } catch (error) {
    console.error("[COMMENT_AUTOMATION_POST_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getActiveWorkspace(userId);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await db.commentAutomation.findUnique({
      where: { id },
    });

    if (!existing || existing.workspaceId !== workspace.id) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    await db.commentAutomation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[COMMENT_AUTOMATION_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
