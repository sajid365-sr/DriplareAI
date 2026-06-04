import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { draftPrompt } = body;
    if (!draftPrompt) {
      return NextResponse.json({ error: "Draft prompt is required" }, { status: 400 });
    }

    // Verify user plan and points
    const user = await db.user.findUnique({
      where: { userId },
      select: { plan: true, includedMessages: true, messagesUsedThisCycle: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.plan.toLowerCase() === "starter") {
      return NextResponse.json({ error: "Enhance feature requires a premium plan." }, { status: 403 });
    }

    const availableCredits = user.includedMessages - user.messagesUsedThisCycle;
    if (availableCredits < 5) {
      return NextResponse.json({ error: "Insufficient message points. Requires 5 points." }, { status: 402 });
    }

    // Call OpenRouter
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      return NextResponse.json({ error: "AI Service is not configured properly." }, { status: 500 });
    }

    const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an expert AI prompt engineer. Your job is to take the user's rough draft of a chatbot identity/system prompt and rewrite it into a highly professional, structured, and effective System Prompt. It should clearly define the Role & Identity, Tone & Style, and Rules.\n\nCRITICAL INSTRUCTIONS:\n1. Keep the same language as the user's draft.\n2. Do NOT include any titles like '# System Prompt:' or 'Here is the prompt:'. Start directly with 'Role & Identity:'.\n3. Do NOT use markdown asterisks (**text**) or italics (*text*) anywhere in the response. Use plain text formatting only (numbered lists are fine, but no bold/italic markers).\n4. Return ONLY the raw prompt text."
          },
          {
            role: "user",
            content: `Draft:\n${draftPrompt}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!openRouterRes.ok) {
      const errorText = await openRouterRes.text();
      console.error("[OPENROUTER_ERROR]", errorText);
      return NextResponse.json({ error: "Failed to enhance prompt from AI provider." }, { status: 500 });
    }

    const aiData = await openRouterRes.json();
    const enhancedPrompt = aiData.choices?.[0]?.message?.content?.trim();

    if (!enhancedPrompt) {
      return NextResponse.json({ error: "AI returned empty response." }, { status: 500 });
    }

    // Deduct 5 points and log usage
    await db.user.update({
      where: { userId },
      data: {
        messagesUsedThisCycle: { increment: 5 }
      }
    });

    return NextResponse.json({ enhancedPrompt });

  } catch (error) {
    console.error("[ENHANCE_PROMPT_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
