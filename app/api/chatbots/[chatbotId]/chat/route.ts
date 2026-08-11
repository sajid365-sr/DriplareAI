import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { getTestChatCreditCost } from "@/lib/domain/credit-config";
import { resolveModelConfig } from "@/lib/ai/model-mapper";
import { compilePrompt } from "@/lib/ai/prompt-assembler";

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

    const { message, sessionId = "default" } = await req.json();
    const normalizedSessionId = String(sessionId || "default").slice(0, 120);

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // 1. Verify Ownership
    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    // 2. Resolve the effective OpenRouter model + credit cost.
    //    - Simple mode: tier key (fast/smart/genius) or model string.
    //    - Pro mode: exact model ID stored on the chatbot.
    const resolved = resolveModelConfig(bot.promptMode, bot.model);
    const model = resolved.modelId;

    // 3. Resolve the production system prompt (dual-prompt assembly).
    //    Always prefer the stored compiled prompt; otherwise recompile the
    //    human-readable raw prompt (SYSTEM_HEADER + translated + SYSTEM_FOOTER).
    let systemPrompt = bot.compiledPrompt;
    if (!systemPrompt && bot.rawPrompt) {
      try {
        systemPrompt = await compilePrompt(bot.rawPrompt, bot.chatbotMode);
      } catch (err) {
        console.error("[CHAT_COMPILE_PROMPT_ERROR]", err);
      }
    }
    // Legacy fallback — the stored compiled prompt from the old dual-prompt flow.
    systemPrompt = systemPrompt || bot.systemPrompt || "You are a helpful assistant.";

    // 4. Credit Check — dashboard test chat → ×2 multiplier
    const creditsRequired = getTestChatCreditCost(model);

    const user = await db.user.findUnique({
      where: { userId },
      select: { creditsBalance: true, plan: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Enterprise plan-এ unlimited
    if (user.creditsBalance < creditsRequired) {
      return NextResponse.json(
        {
          error: "Insufficient credits. Please upgrade your plan.",
          code: "INSUFFICIENT_CREDITS",
          credits_required: creditsRequired,
          credits_balance: user.creditsBalance,
        },
        { status: 402 }
      );
    }

    // 5. Forward to n8n Hybrid Backend
    const n8nWebhookUrl = process.env.N8N_WEB_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      console.error("[CHAT] N8N_WEBHOOK_URL not set in .env");
      return NextResponse.json({ error: "Backend configuration error" }, { status: 500 });
    }

    const response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Standard n8n payload — resolved model + compiled system prompt
        chatbotId:    chatbotId,
        sessionId:    normalizedSessionId,
        userMessage:  message,
        systemPrompt: systemPrompt,
        model:        model,
        creditCost:   resolved.credits,
        // Legacy fields — kept for the existing n8n Web Integration workflow
        chatInput:    message,
        userId:       userId,
        platform:     "web_test",
        secret:       process.env.N8N_CALLBACK_SECRET,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[CHAT_N8N_ERROR]", errorText);
      return NextResponse.json({ error: "Failed to get response from AI Agent" }, { status: 502 });
    }

    const data = await response.json();

    // Robust extraction based on n8n response format
    let reply = "";
    if (Array.isArray(data) && data.length > 0) {
      reply = data[0].output || data[0].reply || data[0].text || "";
    } else if (data && typeof data === "object") {
      reply = data.output || data.reply || data.text || "";
    }

    if (!reply && typeof data === "string") {
      reply = data;
    }

    // 6. n8n-এ credit deduction হয় (Sync Next.js Database node-এ)।
    // তবে enterprise plan-এ deduction skip করা হয় উপরেই।

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[CHAT_PROXY_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
