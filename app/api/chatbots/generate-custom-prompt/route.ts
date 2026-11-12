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

    const promptInstructions = `You are an expert AI system prompt engineer for Agents using the DriplareAI platform.
The Workspace already stores the business identity, profile, products, services, and shared policies. Do not ask for or invent those facts.
Agent identity: ${businessName || "the current business"}.
Agent role and responsibilities provided by the merchant: ${description}
Optional role goal: ${goal || "Handle only the responsibilities listed above"}.
Optional response style: ${tone || "Follow the shared Workspace style"}

Generate a structured system prompt in Bengali that defines only this Agent's role, task boundaries, response behavior, and when to hand off to a human. Refer to Workspace business facts as the source of truth instead of repeating or inventing them.

Formatting Requirements:
1. Output MUST be in Bengali (Bangla).
2. Structure into three clear sections:
   Role & Identity:
   (This Agent's assigned role and responsibilities)

   Responsibilities & Boundaries:
   (Only the Agent-specific work it should handle, avoid, or hand off)

   Tone & Style:
   (Follow Workspace-wide style and respond in the customer's language)

4. Do NOT include business names, product/service details, prices, hours, destinations, or shared policies; these are injected from Workspace at runtime.
5. Output ONLY the raw prompt text.`;

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
