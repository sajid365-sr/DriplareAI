import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { db } from "@/lib/core/db";
import { getGeminiEmbeddings } from "@/lib/ai/embeddings";
import { addChunksToDb, type ChunkType } from "@/lib/ai/rag";

// Source.type persisted on the Source row. "product" companion sources are hidden
// from the Content Training tab (see /sources GET), just like faq / sample_reply.
type SourceType = "file" | "text" | "website" | "faq" | "sample_reply" | "product";

type CreateSourceInput = {
  chatbotId: string;
  type: SourceType;
  name: string;
  content: string;
  /** Overrides the chunk-metadata `type`. Defaults to a mapping from the Source type. */
  chunkType?: ChunkType;
  /** Originating row id (faqId / sampleReplyId / productId) stored in chunk metadata. */
  entityId?: string;
};

/** Maps a Source.type to the standardized chunk-metadata `type`. */
function resolveChunkType(sourceType: string, override?: ChunkType): ChunkType {
  if (override) return override;
  if (sourceType === "faq") return "faq";
  if (sourceType === "sample_reply") return "sample_reply";
  if (sourceType === "product") return "product";
  return "document";
}

export function normalizeSourceText(text: string, maxChars = 50000) {
  return text.replace(/\s+/g, " ").trim().slice(0, maxChars);
}

export async function splitSourceText(
  text: string,
  chunkSize = 800,
  chunkOverlap = 120
) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    separators: ["\n\n", "\n", ". ", "? ", "! ", " ", ""],
  });

  const chunks = await splitter.splitText(text);
  const uniqueChunks = Array.from(
    new Set(chunks.map((chunk) => chunk.trim()).filter((chunk) => chunk.length >= 40))
  );

  return uniqueChunks;
}

export async function createSourceWithEmbeddings(input: CreateSourceInput) {
  const normalizedText = normalizeSourceText(input.content);

  if (!normalizedText) {
    throw new Error("No usable text found in source");
  }

  const source = await db.source.create({
    data: {
      chatbotId: input.chatbotId,
      type: input.type,
      name: input.name,
      content: normalizedText,
      charCount: normalizedText.length,
    },
  });

  const chunks = await splitSourceText(normalizedText);
  if (chunks.length > 0) {
    const embeddings = await getGeminiEmbeddings(chunks, 3, { chatbotId: input.chatbotId });
    await addChunksToDb(source.sourceId, input.chatbotId, chunks, embeddings, {
      type: resolveChunkType(input.type, input.chunkType),
      ...(input.entityId ? { entityId: input.entityId } : {}),
    });
  }

  return source;
}

export async function updateSourceWithEmbeddings(
  sourceId: string,
  chatbotId: string,
  content: string,
  name?: string,
  meta?: { chunkType?: ChunkType; entityId?: string }
) {
  const normalizedText = normalizeSourceText(content);

  if (!normalizedText) {
    throw new Error("No usable text found in source");
  }

  const source = await db.source.update({
    where: { sourceId },
    data: {
      content: normalizedText,
      charCount: normalizedText.length,
      ...(name ? { name } : {}),
    },
  });

  // Delete old chunks and embeddings
  await db.chunk.deleteMany({
    where: { sourceId },
  });

  // Create new chunks and embeddings
  const chunks = await splitSourceText(normalizedText);
  if (chunks.length > 0) {
    const embeddings = await getGeminiEmbeddings(chunks, 3, { chatbotId });
    await addChunksToDb(source.sourceId, chatbotId, chunks, embeddings, {
      type: resolveChunkType(source.type, meta?.chunkType),
      ...(meta?.entityId ? { entityId: meta.entityId } : {}),
    });
  }

  return source;
}

/**
 * Best-effort delete of a Source by id. Its Chunks cascade away (Chunk.source
 * onDelete: Cascade). Shared by FAQ / Sample Reply / Product cleanup paths so a
 * deleted entity never leaves orphan embeddings behind.
 */
export async function deleteSourceById(sourceId?: string | null): Promise<void> {
  if (!sourceId) return;
  try {
    await db.source.delete({ where: { sourceId } });
  } catch (err) {
    console.error("[SOURCE_DELETE_BY_ID]", err);
  }
}
