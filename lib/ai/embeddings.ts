import OpenAI from 'openai';

// We use the OpenAI SDK but point it to OpenRouter
export const openRouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const getGeminiEmbeddings = async (text: string | string[]) => {
  // Single embedding model used for BOTH saving chunks and retrieving RAG context.
  // Must stay consistent across save (source-ingestion) and retrieval (compare) paths.
  const response = await openRouter.embeddings.create({
    model: 'google/gemini-embedding-001',
    input: text,
  });

  return response.data.map((item) => item.embedding);
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
