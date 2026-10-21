import "server-only";

import { callModel } from "@/lib/ai/gateway";
import { getGeminiEmbeddings } from "@/lib/ai/embeddings";
import { db } from "@/lib/core/db";
import type { ProductCardData } from "@/app/(dashboard)/dashboard/inbox/_components/product-card-strip";

export interface ImageProductMatchInput {
  chatbotId: string;
  imageUrl: string;
  limit?: number;
  userId?: string;
  workspaceId?: string;
  sessionId?: string;
}

export interface MatchedProductItem extends ProductCardData {
  score: number;
  description?: string | null;
  stock?: number;
  variants?: unknown;
}

export interface ImageProductMatchResult {
  description: string;
  products: MatchedProductItem[];
  rawMatchesCount: number;
}

/**
 * Feature #10: Advanced Image Recognition & Product Matching.
 * Takes a customer-provided product photo URL, describes it using a Vision model,
 * embeds the visual description, and vector-searches the merchant's catalog chunks.
 */
export async function matchProductsByImage({
  chatbotId,
  imageUrl,
  limit = 4,
  userId,
  workspaceId,
  sessionId,
}: ImageProductMatchInput): Promise<ImageProductMatchResult> {
  if (!imageUrl || !imageUrl.trim()) {
    return { description: "", products: [], rawMatchesCount: 0 };
  }

  // 1. Call Vision Model to analyze the uploaded image
  const visionResult = await callModel({
    task: "image_search",
    model: "google/gemini-2.5-flash",
    userId,
    chatbotId,
    workspaceId,
    sessionId,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "You are an expert e-commerce catalog search assistant. Analyze this product photo carefully. Identify and describe the item for searching a merchant product catalog: product category (e.g. panjabi, saree, dress, sneaker, t-shirt, shirt, watch, handbag), color(s), pattern, material/fabric, neckline/collar, style, and distinctive visual details. Provide a concise 2-3 sentence product summary.",
          },
          {
            type: "image_url",
            image_url: { url: imageUrl.trim() },
          },
        ],
      },
    ],
  });

  const description = visionResult.text?.trim() || "";
  if (!description) {
    return { description: "", products: [], rawMatchesCount: 0 };
  }

  // 2. Embed the visual description
  const vectors = await getGeminiEmbeddings(description, 3, {
    chatbotId,
    userId,
    workspaceId,
  });

  const queryEmbedding = vectors[0];
  if (!queryEmbedding || queryEmbedding.length === 0) {
    return { description, products: [], rawMatchesCount: 0 };
  }

  const embeddingString = `[${queryEmbedding.join(",")}]`;

  // 3. Vector similarity search against Chunk table
  const matchingChunks = await db.$queryRaw<
    { id: string; content: string; metadata: Record<string, unknown> | null; distance: number }[]
  >`
    SELECT id, content, metadata, embedding <=> ${embeddingString}::vector AS distance
    FROM "Chunk"
    WHERE embedding IS NOT NULL
      AND (
        "chatbotId" = ${chatbotId}
        OR metadata->>'chatbotId' = ${chatbotId}
      )
    ORDER BY distance ASC
    LIMIT 20;
  `;

  // 4. Extract entityId / productId from chunk metadata
  const productDistanceMap = new Map<string, number>();
  for (const chunk of matchingChunks) {
    const meta = chunk.metadata;
    const entityId = (meta?.entityId || meta?.productId) as string | undefined;
    if (entityId && typeof entityId === "string") {
      const current = productDistanceMap.get(entityId);
      if (current === undefined || chunk.distance < current) {
        productDistanceMap.set(entityId, chunk.distance);
      }
    }
  }

  const matchedProductIds = Array.from(productDistanceMap.keys());
  let products = matchedProductIds.length > 0
    ? await db.product.findMany({
        where: {
          chatbotId,
          productId: { in: matchedProductIds },
          isActive: true,
        },
      })
    : [];

  // 5. Fallback keyword search if no chunks matched products directly
  if (products.length === 0) {
    const keywords = description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 6);

    if (keywords.length > 0) {
      products = await db.product.findMany({
        where: {
          chatbotId,
          isActive: true,
          OR: keywords.map((k) => ({
            OR: [
              { name: { contains: k, mode: "insensitive" } },
              { description: { contains: k, mode: "insensitive" } },
            ],
          })),
        },
        take: limit,
      });
    }
  }

  // 6. Format matched products into product card payloads
  const formattedProducts: MatchedProductItem[] = products
    .map((p) => {
      const distance = productDistanceMap.get(p.productId);
      const score = distance !== undefined
        ? Math.round(Math.max(0, Math.min(1, 1 - distance)) * 100)
        : 75;

      return {
        productId: p.productId,
        name: p.name,
        price: p.price,
        currency: p.currency || "BDT",
        imageUrl: p.imageUrl || (p.imageUrls && p.imageUrls[0]) || "",
        postUrl: p.postUrl || undefined,
        description: p.description,
        stock: p.stock,
        variants: p.variants,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    description,
    products: formattedProducts,
    rawMatchesCount: matchingChunks.length,
  };
}

