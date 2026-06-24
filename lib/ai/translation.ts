import { openRouter } from "./embeddings";

/**
 * Translates the system prompt to English if it contains Bengali characters.
 * If it does not contain Bengali characters (i.e. is already English/non-Bangla),
 * it returns the input text immediately without calling the OpenRouter API.
 */
export async function translateToEnglish(text: string): Promise<string> {
  if (!text || text.trim() === "") return text;

  // Bengali Unicode Range: \u0980 - \u09FF
  const hasBengali = /[\u0980-\u09FF]/.test(text);

  // If there are no Bengali characters, bypass OpenRouter API call and return immediately
  if (!hasBengali) {
    return text;
  }

  const prompt = `You are a professional system prompt translator.
Your task is to translate the user's system prompt (which describes how an AI chatbot should behave) into clear, professional, and optimized English.

Guidelines:
1. Translate the prompt to English. If it is already in English, return it exactly as it is.
2. Preserve any technical terms, instructions, variable placeholders (like {guestName}), emojis, and formatting.
3. Improve the clarity of instructions where appropriate while keeping the exact same behavior and personality.
4. Output ONLY the translated/original system prompt. Do not include any introduction, explanations, markdown formatting (do not wrap in markdown code blocks like \`\`\`), or extra text.

System Prompt to translate:
"${text}"`;

  try {
    const response = await openRouter.chat.completions.create({
      model: "google/gemini-2.5-flash-lite", // Fast and low cost model
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });
    
    return response.choices[0]?.message?.content?.trim() || text;
  } catch (error) {
    console.error("[translateToEnglish] Error translating system prompt:", error);
    return text; // Fallback to original text on error
  }
}
