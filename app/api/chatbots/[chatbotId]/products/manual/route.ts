import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { syncProductEmbedding } from "@/lib/ai/qa-training";

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

    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : null;
    const price = typeof body?.price === "number" && body.price > 0 ? body.price : null;
    const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : "BDT";
    const stock = typeof body?.stock === "number" && body.stock >= 0 ? Math.floor(body.stock) : 10;
    const imageUrl = typeof body?.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null;
    const rawImageUrls = Array.isArray(body?.imageUrls) ? body.imageUrls : [];
    const imageUrls = rawImageUrls.filter((u: any) => typeof u === "string" && u.trim()).map((u: string) => u.trim());
    if (imageUrl && !imageUrls.includes(imageUrl)) {
      imageUrls.unshift(imageUrl);
    }
    const primaryImageUrl = imageUrls[0] || imageUrl || null;
    const variants = body?.variants && typeof body.variants === "object" ? body.variants : null;

    if (!name) {
      return NextResponse.json({ error: "Product name is required" }, { status: 400 });
    }

    // Save product to database
    const createdProduct = await db.product.create({
      data: {
        chatbotId,
        name,
        description,
        price,
        currency,
        stock,
        variants: variants ?? undefined,
        imageUrl: primaryImageUrl,
        imageUrls,
        sourceType: "manual",
        isActive: true,
      },
    });

    // Vectorize into a companion Source (best-effort; persists sourceId + embeddingStatus).
    await syncProductEmbedding(createdProduct);

    return NextResponse.json({
      success: true,
      product: createdProduct,
    });
  } catch (error) {
    console.error("[PRODUCT_MANUAL_CREATE_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
