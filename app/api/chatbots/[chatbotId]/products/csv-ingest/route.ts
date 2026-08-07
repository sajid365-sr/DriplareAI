import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { createSourceWithEmbeddings } from "@/lib/ai/source-ingestion";

export type CSVProductItem = {
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  stock?: number | null;
  colors?: string[] | null;
  sizes?: string[] | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
};

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
    const items = Array.isArray(body?.items) ? (body.items as CSVProductItem[]) : [];

    if (items.length === 0) {
      return NextResponse.json({ error: "No products provided for import" }, { status: 400 });
    }

    let savedCount = 0;
    const summaryLines: string[] = [];

    for (const item of items) {
      const name = item.name?.trim();
      if (!name) continue;

      const colors = Array.isArray(item.colors) ? item.colors.map((c) => c.trim()).filter(Boolean) : [];
      const sizes = Array.isArray(item.sizes) ? item.sizes.map((s) => s.trim()).filter(Boolean) : [];
      const stock = typeof item.stock === "number" && item.stock >= 0 ? Math.floor(item.stock) : 10;

      const variants = {
        ...(colors.length > 0 && { colors }),
        ...(sizes.length > 0 && { sizes }),
      };

      const rawImgUrls = Array.isArray(item.imageUrls) ? item.imageUrls : [];
      const itemImageUrls = rawImgUrls.filter((u: any) => typeof u === "string" && u.trim()).map((u: string) => u.trim());
      const itemImgUrl = item.imageUrl?.trim() || null;
      if (itemImgUrl && !itemImageUrls.includes(itemImgUrl)) {
        itemImageUrls.unshift(itemImgUrl);
      }
      const primaryImgUrl = itemImageUrls[0] || itemImgUrl || null;

      try {
        const p = await db.product.create({
          data: {
            chatbotId,
            name,
            description: item.description?.trim() || null,
            price: typeof item.price === "number" && item.price > 0 ? item.price : null,
            currency: item.currency?.trim() || "BDT",
            stock,
            variants: Object.keys(variants).length > 0 ? variants : undefined,
            imageUrl: primaryImgUrl,
            imageUrls: itemImageUrls,
            sourceType: "csv",
            isActive: true,
          },
        });
        savedCount++;

        summaryLines.push(
          `- ${p.name} | Price: ${p.price ? `${p.price} ${p.currency}` : "N/A"} | Stock: ${p.stock} | Colors: ${colors.join("/") || "N/A"} | Sizes: ${sizes.join("/") || "N/A"}`
        );
      } catch (err) {
        console.error("[CSV_INGEST_ITEM_ERROR]", err);
      }
    }

    // Generate Vector Embeddings for the batch CSV catalog import
    if (savedCount > 0 && summaryLines.length > 0) {
      try {
        await createSourceWithEmbeddings({
          chatbotId,
          type: "text",
          name: `CSV Product Import (${savedCount} products)`,
          content: `[CSV Product Catalog Batch Import]\nTotal Items: ${savedCount}\n\n${summaryLines.join("\n")}`,
        });
      } catch (embeddingErr) {
        console.error("[CSV_BATCH_EMBEDDING_ERROR]", embeddingErr);
      }
    }

    return NextResponse.json({
      success: true,
      count: savedCount,
    });
  } catch (error) {
    console.error("[PRODUCT_CSV_INGEST_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
