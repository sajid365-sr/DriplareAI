import OpenAI from 'openai';

// We use the OpenAI SDK but point it to OpenRouter
export const openRouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const getGeminiEmbeddings = async (
  text: string | string[],
  maxRetries = 3
): Promise<number[][]> => {
  // Single embedding model used for BOTH saving chunks and retrieving RAG context.
  // Must stay consistent across save (source-ingestion) and retrieval (compare) paths.
  //
  // Retries transient failures (network blips, rate limits) with linear backoff so a
  // momentary error doesn't leave a FAQ / reply / product silently un-embedded.
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await openRouter.embeddings.create({
        model: 'google/gemini-embedding-001',
        input: text,
      });

      return response.data.map((item) => item.embedding);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        // Linear backoff: 500ms, 1000ms, ...
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }

  // Exhausted all retries — surface the failure so callers can flag the record.
  throw lastError;
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
