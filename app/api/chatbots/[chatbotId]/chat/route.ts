import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { getTestChatCreditCost } from "@/lib/domain/credit-config";
import { resolveModelConfig } from "@/lib/ai/chat-models";
import { compilePrompt } from "@/lib/ai/prompt-assembler";
import { logAiUsage } from "@/lib/ai/usage-logger";

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
    const resolved = await resolveModelConfig(bot.promptMode, bot.model);
    const model = resolved.modelId;

    // 3. Resolve the production system prompt (dual-prompt assembly).
    let systemPrompt = bot.compiledPrompt;
    if (!systemPrompt && bot.rawPrompt) {
      try {
        systemPrompt = await compilePrompt(bot.rawPrompt, bot.chatbotMode);
      } catch (err) {
        console.error("[CHAT_COMPILE_PROMPT_ERROR]", err);
      }
    }
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
        chatbotId:    bot.chatbotId,
        sessionId:    normalizedSessionId,
        userMessage:  message,
        systemPrompt: systemPrompt,
        model:        model,
        creditCost:   resolved.credits,
        temperature:  bot.temperature,
        topP:         bot.topP,
        maxTokens:    bot.maxTokens,
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

    // Extract or estimate tokens
    let promptTokens = 0;
    let completionTokens = 0;

    if (data && typeof data === "object" && !Array.isArray(data)) {
      const obj = data as Record<string, any>;
      if (obj.usage) {
        promptTokens = obj.usage.prompt_tokens || obj.usage.promptTokens || 0;
        completionTokens = obj.usage.completion_tokens || obj.usage.completionTokens || 0;
      } else {
        promptTokens = obj.promptTokens || 0;
        completionTokens = obj.completionTokens || 0;
      }
    }

    if (!promptTokens) {
      const fullInputText = (systemPrompt || "") + "\n" + (message || "");
      promptTokens = Math.ceil(fullInputText.length / 4);
    }
    if (!completionTokens) {
      completionTokens = Math.ceil((reply || "").length / 4);
    }

    // Fire-and-forget async token logging
    logAiUsage({
      workspaceId: bot.workspaceId || undefined,
      chatbotId: bot.chatbotId,
      sessionId: normalizedSessionId,
      channel: "playground",
      modelId: model,
      promptTokens,
      completionTokens,
      userId,
      creditsDeducted: creditsRequired,
    }).catch((err) => console.error("[CHAT_LOG_USAGE_ERROR]", err));

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[CHAT_PROXY_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
