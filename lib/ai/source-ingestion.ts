import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { db } from "@/lib/core/db";
import { getGeminiEmbeddings } from "@/lib/ai/embeddings";
import { addChunksToDb, type ChunkMetadata, type ChunkType } from "@/lib/ai/rag";
import { formatWebsiteMarkdown } from "@/lib/ai/website-ingestion";

// Source.type persisted on the Source row. "product" companion sources are hidden
// from the Content Training tab (see /sources GET), just like faq / sample_reply.
type SourceType = "file" | "text" | "website" | "faq" | "sample_reply" | "product";

type CreateSourceInput = {
  sourceId?: string;
  chatbotId?: string;
  workspaceId?: string;
  isGlobal?: boolean;
  type: SourceType;
  name: string;
  content: string;
  /** Overrides the chunk-metadata `type`. Defaults to a mapping from the Source type. */
  chunkType?: ChunkType;
  /** Originating row id (faqId / sampleReplyId / productId) stored in chunk metadata. */
  entityId?: string;
  provenance?: ChunkMetadata["provenance"];
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
  const uniqueChunks = Array.from(new Set(chunks.map((chunk) => chunk.trim()).filter(Boolean)));

  return uniqueChunks;
}

export async function createSourceWithEmbeddings(input: CreateSourceInput) {
  const normalizedText = input.type === "website"
    ? formatWebsiteMarkdown(input.content)
    : normalizeSourceText(input.content);

  if (!normalizedText) {
    throw new Error("No usable text found in source");
  }

  const chunks = await splitSourceText(normalizedText);
  if (chunks.length === 0) {
    throw new Error("No usable text chunks found in source");
  }
  const embeddings = await getGeminiEmbeddings(chunks, 3, {
    ...(input.chatbotId ? { chatbotId: input.chatbotId } : {}),
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
  });
  if (embeddings.length !== chunks.length) {
    throw new Error("Failed to generate embeddings for every source chunk");
  }

  const sourceData = {
    chatbotId: input.chatbotId,
    workspaceId: input.workspaceId,
    isGlobal: input.isGlobal ?? false,
    type: input.type,
    name: input.name,
    content: normalizedText,
    charCount: normalizedText.length,
    ingestionStatus: "ready",
  };

  return db.$transaction(async (transaction) => {
    const existingSource = input.sourceId
      ? await transaction.source.findUnique({ where: { sourceId: input.sourceId }, select: { sourceId: true } })
      : null;
    const source = existingSource
      ? await transaction.source.update({ where: { sourceId: input.sourceId }, data: sourceData })
      : await transaction.source.create({
        data: {
          ...(input.sourceId ? { sourceId: input.sourceId } : {}),
          ...sourceData,
        },
      });

    if (existingSource) {
      await transaction.chunk.deleteMany({ where: { sourceId: source.sourceId } });
    }

    await addChunksToDb(source.sourceId, input.chatbotId ?? null, chunks, embeddings, {
      type: resolveChunkType(input.type, input.chunkType),
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...(input.provenance ? { provenance: input.provenance } : {}),
    }, transaction);

    return source;
  }, { maxWait: 10_000, timeout: 60_000 });
}

export async function updateSourceWithEmbeddings(
  sourceId: string,
  chatbotId: string | null,
  content: string,
  name?: string,
  meta?: { chunkType?: ChunkType; entityId?: string; workspaceId?: string; provenance?: ChunkMetadata["provenance"] }
) {
  const normalizedText = await db.source.findUnique({
    where: { sourceId },
    select: { type: true },
  }).then((source) => source?.type === "website"
    ? formatWebsiteMarkdown(content)
    : normalizeSourceText(content));

  if (!normalizedText) {
    throw new Error("No usable text found in source");
  }

  const chunks = await splitSourceText(normalizedText);
  if (chunks.length === 0) {
    throw new Error("No usable text chunks found in source");
  }
  const embeddings = await getGeminiEmbeddings(chunks, 3, {
    ...(chatbotId ? { chatbotId } : {}),
    ...(meta?.workspaceId ? { workspaceId: meta.workspaceId } : {}),
  });
  if (embeddings.length !== chunks.length) {
    throw new Error("Failed to generate embeddings for every source chunk");
  }

  return db.$transaction(async (transaction) => {
    const source = await transaction.source.update({
      where: { sourceId },
      data: {
        content: normalizedText,
        charCount: normalizedText.length,
        ingestionStatus: "ready",
        ...(meta?.workspaceId ? { workspaceId: meta.workspaceId, isGlobal: true } : {}),
        ...(name ? { name } : {}),
      },
    });

    await transaction.chunk.deleteMany({ where: { sourceId } });
    await addChunksToDb(source.sourceId, chatbotId, chunks, embeddings, {
      type: resolveChunkType(source.type, meta?.chunkType),
      ...(meta?.workspaceId ? { workspaceId: meta.workspaceId } : {}),
      ...(meta?.entityId ? { entityId: meta.entityId } : {}),
      ...(meta?.provenance ? { provenance: meta.provenance } : {}),
    }, transaction);

    return source;
  }, { maxWait: 10_000, timeout: 60_000 });
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
