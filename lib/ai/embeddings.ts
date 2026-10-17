import "server-only";

import { callEmbeddings } from "@/lib/ai/gateway";

// ══════════════════════════════════════════════════════════════════════════════
// Embeddings
// ══════════════════════════════════════════════════════════════════════════════
//
// ⚠️ The OpenRouter client used to live here as an eagerly-created module-level
//    `new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY })`. That throws during
//    *import* when the key is missing, which takes down the whole route with an
//    OpenAI-internal stack trace instead of failing one call with a clear "not
//    configured". The client now lives in `lib/ai/openrouter-client.ts` and is
//    created lazily, and this file no longer talks to a provider at all — it
//    goes through the gateway like everything else, which is what gives
//    embeddings their quota gate, their retry budget and their usage row.
// ══════════════════════════════════════════════════════════════════════════════

export type EmbeddingMeta = {
  chatbotId?: string;
  userId?: string;
  workspaceId?: string;
};

/**
 * The single embedding model, used for BOTH writing chunks (source ingestion)
 * and reading them back (RAG retrieval). It must stay the same on both sides: a
 * query embedded by a different model lives in a different vector space, and
 * the similarity search would return confident nonsense instead of an error.
 * The gateway enforces that — `AI_TASK_POLICY.embedding` forbids model fallback.
 */
export const EMBEDDING_MODEL = "google/gemini-embedding-001";

/**
 * @param maxRetries - Ignored, and kept only so existing call sites compile.
 *   Retry policy belongs to the gateway now, where it is measured against a
 *   wall-clock budget; the old local loop retried three times with linear
 *   backoff regardless of how long the caller had left.
 */
export const getGeminiEmbeddings = async (
  text: string | string[],
  maxRetries = 3,
  meta?: EmbeddingMeta
): Promise<number[][]> => {
  void maxRetries;

  const hasOwner = Boolean(meta?.chatbotId || meta?.userId || meta?.workspaceId);

  const { vectors } = await callEmbeddings({
    input: text,
    userId: meta?.userId,
    chatbotId: meta?.chatbotId,
    workspaceId: meta?.workspaceId,
    // Previously a call with no owner ids wrote no usage row at all. Keeping
    // that behaviour avoids turning every anonymous embed into a logged
    // "missing userId" warning.
    skipLogging: !hasOwner,
  });

  return vectors;
};

export const splitText = (text: string, chunkSize = 500, overlap = 50): string[] => {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
};
