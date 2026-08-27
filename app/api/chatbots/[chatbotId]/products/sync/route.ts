import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { PRODUCT_SYNC_FEE } from "@/lib/domain/credit-config";
import { fetchFacebookPagePosts } from "@/lib/services/facebook";
import { extractProductsFromPosts } from "@/lib/ai/product-extract";

const FB_PLATFORMS = ["facebook", "n8n_facebook"];

/**
 * POST /api/chatbots/[chatbotId]/products/sync
 *
 * Fetches recent Facebook Page posts and runs AI extraction to produce
 * draft product entries. Does NOT save them yet — caller reviews first.
 *
 * Body: { limit?: number; since?: string }
 * Response: { products: ExtractedProduct[]; meta: { postsFetched, productsFound, creditsSpent } }
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

    const bot = await getOwnedChatbot(userId, identifier);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }
    const chatbotId = bot.chatbotId;

    // Parse request body
    const body = await req.json().catch(() => ({})) as {
      limit?: number;
      since?: string;
    };
    const limit = Math.min(Math.max(1, Math.floor(Number(body.limit) || 20)), 50);
    const since = typeof body.since === "string" ? body.since : undefined;

    // Credit check
    const user = await db.user.findUnique({
      where: { userId },
      select: { creditsBalance: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (user.creditsBalance < PRODUCT_SYNC_FEE) {
      return NextResponse.json(
        {
          error: "Insufficient credits. Please top up or upgrade your plan.",
          code: "INSUFFICIENT_CREDITS",
          credits_required: PRODUCT_SYNC_FEE,
          credits_balance: user.creditsBalance,
        },
        { status: 402 }
      );
    }

    // Find Facebook integration for this chatbot
    const integration = await db.integration.findFirst({
      where: {
        chatbotId,
        platform: { in: FB_PLATFORMS },
        connected: true,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "No connected Facebook page found. Connect from Platforms first." },
        { status: 404 }
      );
    }

    const config = integration.config as Record<string, unknown>;
    const pageId = config.pageId as string | undefined;
    const pageToken = config.pageToken as string | undefined;

    if (!pageId || !pageToken) {
      return NextResponse.json(
        { error: "Facebook integration is missing page credentials. Please reconnect." },
        { status: 400 }
      );
    }

    // Fetch Facebook Page posts
    let postsFetched = 0;
    let feedData;
    try {
      feedData = await fetchFacebookPagePosts(pageId, pageToken, { limit, since });
      postsFetched = (feedData.data || []).length;
    } catch (err) {
      console.error("[PRODUCT_SYNC_FB_FETCH]", err);
      return NextResponse.json(
        { error: "Failed to fetch Facebook posts. Check your page connection." },
        { status: 502 }
      );
    }

    if (postsFetched === 0) {
      return NextResponse.json({
        products: [],
        warning: "no_posts",
        meta: { postsFetched: 0, productsFound: 0, creditsSpent: 0 },
      });
    }

    // Run AI extraction
    const products = await extractProductsFromPosts(feedData.data, {
      chatbotId,
      userId,
      workspaceId: bot.workspaceId || undefined,
    });

    if (products.length === 0) {
      return NextResponse.json({
        products: [],
        warning: "no_products_found",
        meta: { postsFetched, productsFound: 0, creditsSpent: 0 },
      });
    }

    // Deduct credits + log transaction
    await db.$transaction([
      db.user.update({
        where: { userId },
        data: {
          creditsBalance: { decrement: PRODUCT_SYNC_FEE },
          creditsUsedThisCycle: { increment: PRODUCT_SYNC_FEE },
        },
      }),
      db.creditTransaction.create({
        data: {
          userId,
          chatbotId,
          action_type: "product_sync",
          model_tier: null,
          credits_spent: PRODUCT_SYNC_FEE,
          metadata: {
            postsFetched,
            productsFound: products.length,
            pageId,
          },
        },
      }),
    ]);

    return NextResponse.json({
      products,
      meta: {
        postsFetched,
        productsFound: products.length,
        creditsSpent: PRODUCT_SYNC_FEE,
      },
    });
  } catch (error) {
    console.error("[PRODUCT_SYNC_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
