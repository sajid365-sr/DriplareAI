import "server-only";

import { callModel } from "@/lib/ai/gateway";

export type TranslationMeta = {
  chatbotId?: string;
  userId?: string;
  workspaceId?: string;
};

const TRANSLATION_MODEL = "google/gemini-2.5-flash-lite";

/**
 * Translates the system prompt to English if it contains Bengali characters.
 * If it does not contain Bengali characters (i.e. is already English/non-Bangla),
 * it returns the input text immediately without calling the OpenRouter API.
 */
export async function translateToEnglish(text: string, meta?: TranslationMeta): Promise<string> {
  if (!text || text.trim() === "") return text;

  // Bengali Unicode Range: ঀ - ৿
  const hasBengali = /[ঀ-৿]/.test(text);

  // If there are no Bengali characters, bypass the API call entirely.
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
    const { text: translated } = await callModel({
      task: "translate",
      model: TRANSLATION_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      userId: meta?.userId,
      chatbotId: meta?.chatbotId,
      workspaceId: meta?.workspaceId,
      // ⚠️ `quick_setup` is not a customer channel, but it is the value this call
      //    already wrote into the column and dashboards read it. The gateway's
      //    new `task` column is what separates "translate" from "chat"; rewriting
      //    the historical channel at the same time would silently move numbers
      //    in existing analytics.
      channel: "quick_setup",
    });

    // ⚠️ Degrades rather than throws: a merchant mid-onboarding should still get
    //    their chatbot, and an untranslated prompt still works — n8n reads
    //    Bengali perfectly well.
    return translated.trim() || text;
  } catch (error) {
    console.error("[translateToEnglish] Error translating system prompt:", error);
    return text; // Fallback to original text on error
  }
}
