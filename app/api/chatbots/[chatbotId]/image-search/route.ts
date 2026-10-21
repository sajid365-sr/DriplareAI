import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { matchProductsByImage } from "@/lib/ai/image-product-match";

const imageSearchSchema = z.object({
  imageUrl: z.string().url("Valid image URL is required"),
  sessionId: z.string().optional(),
  limit: z.number().int().min(1).max(10).default(4),
});

/**
 * POST /api/chatbots/[chatbotId]/image-search
 * Feature #10: Advanced Image Recognition (Product Matching)
 *
 * Receives an image URL (from Messenger/WhatsApp webhook via n8n, or test chat),
 * runs vision analysis, vector search on product catalog chunks, and returns
 * structured product cards of the closest matches.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { chatbotId: identifier } = await params;

    // 1. Dual Authentication: Clerk user session OR internal n8n shared secret
    const { userId } = await auth();
    const n8nSecret = req.headers.get("x-n8n-secret");
    const isN8nAuthorized =
      Boolean(process.env.N8N_CALLBACK_SECRET) &&
      n8nSecret === process.env.N8N_CALLBACK_SECRET;

    if (!userId && !isN8nAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Chatbot verification
    let bot = null;
    if (userId) {
      bot = await getOwnedChatbot(userId, identifier);
    } else {
      bot = await db.chatbot.findFirst({
        where: {
          OR: [{ chatbotId: identifier }, { id: identifier }],
        },
      });
    }

    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // 3. Request body parsing
    const body = await req.json().catch(() => null);
    const parsed = imageSearchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { imageUrl, sessionId, limit } = parsed.data;

    // 4. Perform Vision Analysis and Product Catalog Vector Matching
    const result = await matchProductsByImage({
      chatbotId: bot.chatbotId,
      imageUrl,
      limit,
      userId: bot.userId,
      workspaceId: bot.workspaceId ?? undefined,
      sessionId,
    });

    return NextResponse.json({
      success: true,
      description: result.description,
      products: result.products,
      rawMatchesCount: result.rawMatchesCount,
    });
  } catch (error) {
    console.error("[IMAGE_PRODUCT_SEARCH_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to process image product search" },
      { status: 500 }
    );
  }
}

