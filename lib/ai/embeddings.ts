import OpenAI from 'openai';

// We use the OpenAI SDK but point it to OpenRouter
export const openRouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const getEmbeddings = async (text: string | string[]) => {
  // OpenRouter supports OpenAI's text-embedding-3-small via this route
  const response = await openRouter.embeddings.create({
    model: 'openai/text-embedding-3-small',
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
