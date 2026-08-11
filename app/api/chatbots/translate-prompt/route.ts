import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/core/auth";
import { openRouter } from "@/lib/ai/embeddings";
import { detectLanguage } from "@/lib/ai/prompt-assembler";

/**
 * POST /api/chatbots/translate-prompt
 *
 * Accepts `{ rawPrompt }` and returns `{ englishPrompt }`.
 * Detects the input language via OpenRouter (`google/gemini-2.5-flash`).
 * If the input is Bengali/Banglish it is translated and restructured into
 * professional English system instructions. Already-English input is returned
 * as-is without spending an AI call.
 */
export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { rawPrompt } = body;

    if (!rawPrompt || typeof rawPrompt !== "string" || !rawPrompt.trim()) {
      return NextResponse.json({ error: "rawPrompt is required" }, { status: 400 });
    }

    const trimmed = rawPrompt.trim();

    // Fast path: already English → return as-is (no AI call needed).
    if (detectLanguage(trimmed) === "en") {
      return NextResponse.json({ englishPrompt: trimmed, detectedLanguage: "en" });
    }

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      return NextResponse.json({ error: "AI Service is not configured properly." }, { status: 500 });
    }

    const response = await openRouter.chat.completions.create({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are a professional system prompt translator and restructurer.
Your task is to detect the language of the user's input and, if it is Bengali or Banglish, translate and restructure it into clear, professional English system instructions for an AI chatbot.

Guidelines:
1. Detect the language first. If the input is already English, return it exactly as-is.
2. If the input is Bengali or Banglish, translate it to professional English while preserving the exact behavior, personality, and rules.
3. Preserve technical terms, variable placeholders (like {guestName}), emojis, and formatting.
4. Structure the output clearly with sections like "Role & Identity:", "Tone & Style:", and "Rules:".
5. Output ONLY the translated/restructured English prompt. Do not include any introduction, explanations, markdown code blocks, or extra text.`,
        },
        { role: "user", content: trimmed },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    });

    const englishPrompt = response.choices?.[0]?.message?.content?.trim();
    if (!englishPrompt) {
      return NextResponse.json({ error: "AI returned empty response." }, { status: 500 });
    }

    return NextResponse.json({ englishPrompt, detectedLanguage: "bn" });
  } catch (error) {
    console.error("[TRANSLATE_PROMPT_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}