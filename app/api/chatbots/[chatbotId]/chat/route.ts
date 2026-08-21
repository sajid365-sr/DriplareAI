import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { getTestChatCreditCost } from "@/lib/domain/credit-config";
import { resolveModelConfig } from "@/lib/ai/chat-models";
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
    const resolved = await resolveModelConfig(bot.promptMode, bot.model);
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
        chatbotId:    bot.chatbotId,
        sessionId:    normalizedSessionId,
        userMessage:  message,
        systemPrompt: systemPrompt,
        model:        model,
        creditCost:   resolved.credits,
        // Model generation params (persisted on the chatbot) — forwarded so the
        // Temperature / Top-P / max-tokens settings actually reach the model.
        temperature:  bot.temperature,
        topP:         bot.topP,
        maxTokens:    bot.maxTokens,
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

    // Safe response parsing — n8n can return an empty body when a sub-workflow
    // errors before reaching the Respond to Webhook node. Using text() first
    // prevents "Unexpected end of JSON input" crashes.
    const rawText = await response.text();
    let data: Record<string, unknown> | unknown[] | null = null;

    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        console.error("[CHAT_PARSE_ERROR] Non-JSON response from n8n:", rawText.slice(0, 200));
        return NextResponse.json({ error: "Failed to get response from AI Agent" }, { status: 502 });
      }
    }

    if (!data) {
      console.error("[CHAT_EMPTY_ERROR] Empty response body from n8n webhook");
      return NextResponse.json({ error: "Failed to get response from AI Agent" }, { status: 502 });
    }

    // Robust extraction — supports both the new Web-Playground-Integration
    // format (replyText) and legacy n8n formats (output / reply / text)
    let reply = "";
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0] as Record<string, unknown>;
      reply = String(first.replyText || first.output || first.reply || first.text || "");
    } else if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      reply = String(obj.replyText || obj.output || obj.reply || obj.text || "");
    }

    if (!reply && typeof data === "string") {
      reply = data;
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[CHAT_PROXY_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
