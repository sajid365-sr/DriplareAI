import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/core/auth";
import { callModel } from "@/lib/ai/gateway";
import { aiErrorResponse } from "@/lib/ai/gateway-http";
import { compilePrompt } from "@/lib/ai/prompt-assembler";

export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { businessName, description, goal, tone, category = "custom" } = body;

    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json(
        { error: "Business description is required" },
        { status: 400 }
      );
    }

    const promptInstructions = `You are an expert AI system prompt engineer for businesses using the DriplareAI platform.
A merchant has provided details about their unique business:
- Business/Brand Name: ${businessName || "Unnamed Business"}
- What the business does: ${description}
- Primary Bot Goal: ${goal || "Assist customers and collect inquiries"}
- Tone: ${tone || "Friendly and Professional"}

Your job is to generate a comprehensive, structured system prompt in Bengali for this AI assistant.

Formatting Requirements:
1. Output MUST be in Bengali (Bangla).
2. Structure into three clear sections:
   Role & Identity:
   (Who the AI is, what company it represents, and its mission)

   Business Rules & Policies:
   (Bullet points covering operating principles, response rules, privacy, and polite human handoff)

   Tone & Style:
   (Polite, professional, natural, responding in the customer's language)

3. Do NOT include markdown bold markers (**text**), headers (###), or conversational preambles.
4. Output ONLY the raw prompt text.`;

    const { text: rawPrompt } = await callModel({
      task: "enhance_prompt",
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: promptInstructions }],
      temperature: 0.7,
      maxTokens: 1500,
      userId: user.userId,
      channel: "generate_custom_prompt",
    });

    const cleanRawPrompt = (rawPrompt || "").trim();

    // Assemble the production prompt using the custom dynamic sandwich
    const compiledPrompt = await compilePrompt(
      cleanRawPrompt,
      category,
      { userId: user.userId }
    );

    return NextResponse.json({
      rawPrompt: cleanRawPrompt,
      compiledPrompt,
    });
  } catch (error) {
    const handled = aiErrorResponse(error);
    if (handled) return handled;
    console.error("[GENERATE_CUSTOM_PROMPT_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

