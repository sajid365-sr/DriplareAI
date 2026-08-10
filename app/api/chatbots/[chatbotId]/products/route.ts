import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import type { ExtractedProduct } from "@/lib/ai/product-extract";
import { syncProductEmbedding } from "@/lib/ai/qa-training";

/**
 * GET /api/chatbots/[chatbotId]/products
 * Returns paginated products for this chatbot.
 *
 * Query params:
 *   - page  (default: 1)
 *   - limit (default: 12)
 *
 * Response: { data: products, meta: { total, page, limit, totalPages } }
 *
 * POST /api/chatbots/[chatbotId]/products
 * Bulk-saves reviewed AI-extracted product drafts (upsert by sourcePostId).
 */

export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId: identifier } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, identifier);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "12", 10)));
    const skip = (page - 1) * limit;

    // Run count and data fetch in parallel for performance
    const [total, products] = await Promise.all([
      db.product.count({
        where: { chatbotId: bot.chatbotId, isActive: true },
      }),
      db.product.findMany({
        where: { chatbotId: bot.chatbotId, isActive: true },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error("[PRODUCTS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

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

    const bot = await getOwnedChatbot(userId, identifier);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }
    const chatbotId = bot.chatbotId;

    const body = await req.json() as { products?: ExtractedProduct[] };
    const items = Array.isArray(body.products) ? body.products : [];

    if (items.length === 0) {
      return NextResponse.json({ saved: 0 });
    }

    // Save each product to the catalog, then vectorize it into a companion Source.
    let savedCount = 0;
    for (const item of items) {
      try {
        const created = await db.product.create({
          data: {
            chatbotId,
            name: item.name.trim(),
            description: item.description ?? null,
            price: item.price ?? null,
            currency: item.currency ?? "BDT",
            variants: item.variants ?? undefined,
            sourceType: "fb_post",
            sourcePostId: item.sourcePostId || null,
            imageUrl: item.imageUrl || null,
            postUrl: item.postUrl || null,
            isActive: true,
          },
        });
        // Per-product embedding (best-effort; persists sourceId + embeddingStatus).
        await syncProductEmbedding(created);
        savedCount++;
      } catch (err) {
        console.error("[PRODUCTS_SAVE_ITEM]", err);
      }
    }

    return NextResponse.json({ saved: savedCount });
  } catch (error) {
    console.error("[PRODUCTS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
