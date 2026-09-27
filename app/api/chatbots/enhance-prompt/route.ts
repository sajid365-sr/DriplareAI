import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/core/auth";
import { openRouter } from "@/lib/ai/embeddings";

/**
 * POST /api/chatbots/enhance-prompt
 *
 * Accepts `{ rawPrompt, category }` and returns `{ enhancedPrompt }`.
 * Uses OpenRouter (`google/gemini-2.5-flash`) to expand a simple merchant
 * statement into a robust, high-converting business AI system prompt.
 */
export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { rawPrompt, category } = body;

    if (!rawPrompt || typeof rawPrompt !== "string" || !rawPrompt.trim()) {
      return NextResponse.json({ error: "rawPrompt is required" }, { status: 400 });
    }

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      return NextResponse.json({ error: "AI Service is not configured properly." }, { status: 500 });
    }

    const categoryHint = category ? `Business category: ${category}.` : "";

    const response = await openRouter.chat.completions.create({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are an expert AI prompt engineer for e-commerce businesses.
Your job is to take a simple merchant statement (often in Bengali, Banglish, or English) and expand it into a robust, high-converting business AI system prompt.

Guidelines:
1. Keep the same language as the user's statement. If it is Bengali/Banglish, keep it in Bengali/Banglish.
2. Structure the output with clear sections: "Role & Identity:", "Tone & Style:", and "Rules:".
3. Add persuasive, conversion-focused language while keeping the merchant's core intent intact.
4. Include rules for handling product questions, orders, delivery, and customer care.
5. Do NOT include titles like '# System Prompt:' or 'Here is the prompt:'. Start directly with 'Role & Identity:'.
6. Do NOT use markdown asterisks (**text**) or italics (*text*). Use plain text formatting only.
7. Return ONLY the raw enhanced prompt text.`,
        },
        { role: "user", content: `${categoryHint}\n\nMerchant statement:\n${rawPrompt}` },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const enhancedPrompt = response.choices?.[0]?.message?.content?.trim();
    if (!enhancedPrompt) {
      return NextResponse.json({ error: "AI returned empty response." }, { status: 500 });
    }

    return NextResponse.json({ enhancedPrompt });
  } catch (error) {
    console.error("[ENHANCE_PROMPT_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}