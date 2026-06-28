import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { getTestChatCreditCost } from "@/lib/domain/credit-config";
import { normalizeChatModel } from "@/lib/ai/chat-models";

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

    // 2. Credit Check — dashboard test chat → ×2 multiplier
    const botModel = normalizeChatModel(bot.provider, bot.model);
    const creditsRequired = getTestChatCreditCost(botModel.openRouterModel);

    const user = await db.user.findUnique({
      where: { userId },
      select: { creditsBalance: true, plan: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Enterprise plan-এ unlimited
    if (user.plan !== "enterprise" && user.creditsBalance < creditsRequired) {
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

    // 3. Forward to n8n Hybrid Backend
    const n8nWebhookUrl = process.env.N8N_WEB_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      console.error("[CHAT] N8N_WEBHOOK_URL not set in .env");
      return NextResponse.json({ error: "Backend configuration error" }, { status: 500 });
    }

    const response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatInput:  message,
        sessionId:  normalizedSessionId,
        chatbotId:  chatbotId,
        userId:     userId,
        platform:   "web_test",
        secret:     process.env.N8N_CALLBACK_SECRET,
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

    // 4. n8n-এ credit deduction হয় (Sync Next.js Database node-এ)।
    // তবে enterprise plan-এ deduction skip করা হয় উপরেই।

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[CHAT_PROXY_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
