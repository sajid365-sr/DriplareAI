import { db } from "@/lib/core/db";

export async function addChunksToDb(sourceId: string, chatbotId: string, chunks: string[], embeddings: number[][]) {
  // Prisma $executeRaw is used because pgvector Unsupported types can't be created via standard Prisma client create()
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];
    const embeddingString = `[${embedding.join(",")}]`;

    // Wait, first we create the chunk entry, then update the vector
    const chunkRecord = await db.chunk.create({
      data: {
        sourceId,
        chatbotId,
        content: chunk,
        chunkIndex: i,
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

  // Semantic search using cosine distance (<=>)
  // Ensure the extension vector is created and indexes exist for performance, but small datasets don't strictly need indexes.
  const chunks = await db.$queryRaw<{ content: string; distance: number }[]>`
    SELECT content, embedding <=> ${embeddingString}::vector AS distance
    FROM "Chunk"
    WHERE "chatbotId" = ${chatbotId}
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
