import {
  createSourceWithEmbeddings,
  updateSourceWithEmbeddings,
  deleteSourceById,
} from "@/lib/ai/source-ingestion";
import type { ChunkType } from "@/lib/ai/rag";
import { db } from "@/lib/core/db";

/**
 * Shared helpers for mirroring structured rows (FAQ / Sample-Reply / Product) into
 * the RAG store. Each structured row keeps a 1:1 companion `Source` (+ embedded
 * Chunks) so `getContext` (which matches `Chunk` by chatbotId) retrieves them at
 * chat time — in both the n8n production runtime and the in-code compare route.
 */

/** How a FAQ is embedded and surfaced back as `[Context N]`. */
export function formatFaqContent(question: string, answer: string): string {
  return `Question: ${question}\nAnswer: ${answer}`;
}

/** How a sample reply is embedded and surfaced back as `[Context N]`. */
export function formatSampleReplyContent(customerMessage: string, reply: string): string {
  return `When a customer says: "${customerMessage}"\nThe ideal reply is: "${reply}"`;
}

type ProductForEmbedding = {
  name: string;
  price?: number | null;
  currency?: string | null;
  stock?: number | null;
  description?: string | null;
  variants?: unknown;
};

/**
 * How a product is embedded and surfaced back as `[Context N]`.
 * Reads ALL variant keys (not just colors/sizes) so custom attributes survive.
 */
export function formatProductContent(product: ProductForEmbedding): string {
  const lines: string[] = [];
  lines.push(`Product Name: ${product.name}`);
  lines.push(
    `Price: ${product.price ? `${product.price} ${product.currency || "BDT"}` : "N/A"}`
  );
  lines.push(`Stock: ${typeof product.stock === "number" ? product.stock : "N/A"}`);

  // Flatten every variant array key generically (colors, sizes, and any custom key).
  if (product.variants && typeof product.variants === "object") {
    for (const [key, val] of Object.entries(product.variants as Record<string, unknown>)) {
      if (Array.isArray(val) && val.length > 0) {
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        lines.push(`${label}: ${val.map((v) => String(v)).join(", ")}`);
      }
    }
  }

  lines.push(`Description: ${product.description || ""}`);
  return lines.join("\n");
}

/** Result of a companion-Source embedding sync. */
export type EmbeddingSyncResult = {
  /** sourceId to persist on the structured row (existing one on failure). */
  sourceId: string | null;
  /** "synced" when embeddings were (re)generated; "failed" otherwise. */
  status: "synced" | "failed";
};

type SyncTrainingSourceInput = {
  chatbotId: string;
  /** Existing companion sourceId, if this row was already embedded. */
  existingSourceId?: string | null;
  type: "faq" | "sample_reply" | "product";
  /** Human-readable label for the Source row (truncated). */
  name: string;
  /** Pre-formatted text to embed. */
  content: string;
  /** Originating row id (faqId / sampleReplyId / productId) stored in chunk metadata. */
  entityId?: string;
};

/**
 * Creates (or updates) the companion Source that carries the embeddings for a
 * structured row. Returns the sourceId to persist plus a status flag — embedding
 * problems never break structured CRUD, but the caller can now record whether the
 * embedding actually succeeded (embeddingStatus) instead of failing silently.
 */
export async function syncTrainingSource(
  input: SyncTrainingSourceInput
): Promise<EmbeddingSyncResult> {
  const name = input.name.trim().slice(0, 200) || input.type;
  const chunkType = input.type as ChunkType;
  try {
    if (input.existingSourceId) {
      await updateSourceWithEmbeddings(
        input.existingSourceId,
        input.chatbotId,
        input.content,
        name,
        { chunkType, entityId: input.entityId }
      );
      return { sourceId: input.existingSourceId, status: "synced" };
    }

    const source = await createSourceWithEmbeddings({
      chatbotId: input.chatbotId,
      type: input.type,
      name,
      content: input.content,
      chunkType,
      entityId: input.entityId,
    });
    return { sourceId: source.sourceId, status: "synced" };
  } catch (err) {
    console.error("[QA_TRAINING_SYNC]", err);
    return { sourceId: input.existingSourceId ?? null, status: "failed" };
  }
}

type ProductRow = ProductForEmbedding & {
  productId: string;
  chatbotId: string;
  /** Existing companion sourceId, if this product was already embedded. */
  sourceId?: string | null;
};

/**
 * Embeds (or re-embeds) a Product into its companion Source and persists the
 * resulting sourceId + embeddingStatus back onto the Product row. Mirrors the
 * FAQ / Sample-Reply companion-Source flow so products are retrievable at chat
 * time and are never left silently un-embedded. Best-effort — never throws, so
 * product CRUD is unaffected by an embedding hiccup.
 */
export async function syncProductEmbedding(
  product: ProductRow
): Promise<EmbeddingSyncResult> {
  const result = await syncTrainingSource({
    chatbotId: product.chatbotId,
    existingSourceId: product.sourceId,
    type: "product",
    name: product.name,
    entityId: product.productId,
    content: formatProductContent(product),
  });

  try {
    await db.product.update({
      where: { productId: product.productId },
      data: { sourceId: result.sourceId, embeddingStatus: result.status },
    });
  } catch (err) {
    console.error("[PRODUCT_EMBEDDING_PERSIST]", err);
  }

  return result;
}

/** Best-effort delete of the companion Source. Its Chunks cascade away. */
export async function deleteTrainingSource(sourceId?: string | null): Promise<void> {
  await deleteSourceById(sourceId);
}
