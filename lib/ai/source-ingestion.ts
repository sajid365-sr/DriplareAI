import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { db } from "@/lib/core/db";
import { getEmbeddings } from "@/lib/ai/embeddings";
import { addChunksToDb } from "@/lib/ai/rag";

type SourceType = "file" | "text" | "website";

type CreateSourceInput = {
  chatbotId: string;
  type: SourceType;
  name: string;
  content: string;
};

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
    const embeddings = await getEmbeddings(chunks);
    await addChunksToDb(source.sourceId, input.chatbotId, chunks, embeddings);
  }

  return source;
}

export async function updateSourceWithEmbeddings(
  sourceId: string,
  chatbotId: string,
  content: string,
  name?: string
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
    const embeddings = await getEmbeddings(chunks);
    await addChunksToDb(source.sourceId, chatbotId, chunks, embeddings);
  }

  return source;
}

