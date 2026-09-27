import { db } from "@/lib/core/db";

/**
 * Standardized shape stored in `Chunk.metadata` for EVERY in-code ingestion path.
 * Keeping this consistent lets retrieval and downstream tooling treat all chunks
 * uniformly regardless of which entity produced them.
 *
 *   type      — what kind of knowledge this chunk represents
 *   sourceId  — the parent Source.sourceId (also mirrored to the top-level column)
 *   chatbotId — owning chatbot (also mirrored to the top-level column)
 *   entityId  — optional id of the originating row (faqId / sampleReplyId / productId)
 */
export type ChunkType = "faq" | "sample_reply" | "product" | "document";

export type ChunkMetadata = {
  type: ChunkType;
  sourceId: string;
  chatbotId: string;
  entityId?: string;
};

export async function addChunksToDb(
  sourceId: string,
  chatbotId: string,
  chunks: string[],
  embeddings: number[][],
  metadata?: Omit<ChunkMetadata, "sourceId" | "chatbotId">
) {
  // Prisma $executeRaw is used because pgvector Unsupported types can't be created via standard Prisma client create()
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];
    const embeddingString = `[${embedding.join(",")}]`;

    // Always populate BOTH the top-level columns AND the standardized metadata JSON,
    // so retrieval works whether it filters on the column (in-code path) or the JSON
    // (n8n / langchain path). type defaults to "document" for generic Sources.
    const chunkMetadata: ChunkMetadata = {
      type: metadata?.type ?? "document",
      sourceId,
      chatbotId,
      ...(metadata?.entityId ? { entityId: metadata.entityId } : {}),
    };

    // First we create the chunk entry (with columns + metadata), then update the vector.
    const chunkRecord = await db.chunk.create({
      data: {
        sourceId,
        chatbotId,
        content: chunk,
        chunkIndex: i,
        metadata: chunkMetadata,
      },
    });

    // Update with vector
    await db.$executeRaw`
      UPDATE "Chunk"
      SET embedding = ${embeddingString}::vector
      WHERE id = ${chunkRecord.id}
    `;
  }
}

export async function getContext(chatbotId: string, queryEmbedding: number[], limit = 5): Promise<string> {
  const embeddingString = `[${queryEmbedding.join(",")}]`;

  // Semantic search using cosine distance (<=>).
  // Dual-path chatbot match: in-code chunks set the top-level "chatbotId" column,
  // while n8n/langchain-ingested chunks only carry it inside the metadata JSON.
  // Matching either keeps retrieval consistent across BOTH ingestion pipelines.
  // Skip rows whose embedding never got written (embedding IS NULL) so a partially
  // ingested chunk can't pollute results.
  const chunks = await db.$queryRaw<{ content: string; distance: number }[]>`
    SELECT content, embedding <=> ${embeddingString}::vector AS distance
    FROM "Chunk"
    WHERE embedding IS NOT NULL
      AND (
        "chatbotId" = ${chatbotId}
        OR metadata->>'chatbotId' = ${chatbotId}
      )
    ORDER BY distance ASC
    LIMIT ${limit}
  `;

  if (!chunks || chunks.length === 0) {
    return "";
  }

  const maxContextChars = 3500;
  const selected: string[] = [];
  let usedChars = 0;

  for (const chunk of chunks) {
    if (chunk.distance > 0.65) {
      continue;
    }

    if (usedChars + chunk.content.length > maxContextChars) {
      break;
    }

    selected.push(chunk.content);
    usedChars += chunk.content.length;
  }

  const finalChunks = selected.length > 0 ? selected : chunks.slice(0, 3).map((chunk) => chunk.content);
  return finalChunks.map((content, i) => `[Context ${i + 1}]:\n${content}`).join("\n\n");
}
