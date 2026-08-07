import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";

/**
 * PATCH /api/chatbots/[chatbotId]/products/[productId]
 * Updates a single product (name, price, description, variants, imageUrl, isActive).
 *
 * DELETE /api/chatbots/[chatbotId]/products/[productId]
 * Soft-deletes a product (sets isActive = false).
 */

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; productId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId: identifier, productId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, identifier);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Verify product belongs to this chatbot
    const existing = await db.product.findFirst({
      where: { productId, chatbotId: bot.chatbotId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const body = await req.json() as {
      name?: string;
      description?: string | null;
      price?: number | null;
      currency?: string;
      stock?: number;
      variants?: Record<string, string[]> | null;
      imageUrl?: string | null;
      imageUrls?: string[] | null;
      isActive?: boolean;
    };

    const cleanImageUrls = Array.isArray(body.imageUrls)
      ? body.imageUrls.map((u) => u.trim()).filter(Boolean)
      : undefined;

    const primaryImageUrl = cleanImageUrls
      ? cleanImageUrls[0] || null
      : body.imageUrl !== undefined
      ? body.imageUrl
      : undefined;

    const updated = await db.product.update({
      where: { productId },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.price !== undefined && { price: body.price }),
        ...(body.currency !== undefined && { currency: body.currency }),
        ...(body.stock !== undefined && { stock: Math.max(0, Math.floor(body.stock)) }),
        ...(body.variants !== undefined && { variants: body.variants ?? undefined }),
        ...(primaryImageUrl !== undefined && { imageUrl: primaryImageUrl }),
        ...(cleanImageUrls !== undefined && { imageUrls: cleanImageUrls }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PRODUCT_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ chatbotId: string; productId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId: identifier, productId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, identifier);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Verify product belongs to this chatbot
    const existing = await db.product.findFirst({
      where: { productId, chatbotId: bot.chatbotId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Hard delete — product catalog is user-managed, no archival needed
    await db.product.delete({ where: { productId } });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[PRODUCT_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
