import { db } from "@/lib/core/db";
import {
  createSourceWithEmbeddings,
  updateSourceWithEmbeddings,
} from "@/lib/ai/source-ingestion";

/**
 * Shared helpers for mirroring structured FAQ / Sample-Reply rows into the RAG
 * store. Each structured row keeps a 1:1 companion `Source` (+ embedded Chunks)
 * so `getContext` (which filters `Chunk` by `chatbotId`) retrieves them at chat
 * time — in both the n8n production runtime and the in-code compare route.
 */

/** How a FAQ is embedded and surfaced back as `[Context N]`. */
export function formatFaqContent(question: string, answer: string): string {
  return `Question: ${question}\nAnswer: ${answer}`;
}

/** How a sample reply is embedded and surfaced back as `[Context N]`. */
export function formatSampleReplyContent(customerMessage: string, reply: string): string {
  return `When a customer says: "${customerMessage}"\nThe ideal reply is: "${reply}"`;
}

type SyncTrainingSourceInput = {
  chatbotId: string;
  /** Existing companion sourceId, if this row was already embedded. */
  existingSourceId?: string | null;
  type: "faq" | "sample_reply";
  /** Human-readable label for the Source row (truncated). */
  name: string;
  /** Pre-formatted text to embed. */
  content: string;
};

/**
 * Creates (or updates) the companion Source that carries the embeddings for a
 * FAQ / Sample Reply. Returns the sourceId to persist on the structured row, or
 * the existing one on failure — embedding problems never break structured CRUD.
 */
export async function syncTrainingSource(
  input: SyncTrainingSourceInput
): Promise<string | null> {
  const name = input.name.trim().slice(0, 200) || input.type;
  try {
    if (input.existingSourceId) {
      await updateSourceWithEmbeddings(
        input.existingSourceId,
        input.chatbotId,
        input.content,
        name
      );
      return input.existingSourceId;
    }

    const source = await createSourceWithEmbeddings({
      chatbotId: input.chatbotId,
      type: input.type,
      name,
      content: input.content,
    });
    return source.sourceId;
  } catch (err) {
    console.error("[QA_TRAINING_SYNC]", err);
    return input.existingSourceId ?? null;
  }
}

/** Best-effort delete of the companion Source. Its Chunks cascade away. */
export async function deleteTrainingSource(sourceId?: string | null): Promise<void> {
  if (!sourceId) return;
  try {
    await db.source.delete({ where: { sourceId } });
  } catch (err) {
    console.error("[QA_TRAINING_DELETE]", err);
  }
}
