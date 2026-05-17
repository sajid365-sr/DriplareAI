import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { getPlan, type PlanKey } from "@/lib/domain/plan-config";
import type { Region } from "@/lib/core/region";

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

    // 2. Quota Check (Optional, but good to keep in Next.js)
    const user = await db.user.findUnique({ where: { userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const region = (user.region || "bd") as Region;
    const planConfig = getPlan(region, user.plan as PlanKey);

    if (user.plan === "starter" && user.messagesUsedThisCycle >= planConfig.includedMessages) {
      return NextResponse.json({ 
        error: "Quota exhausted. Please upgrade.",
        code: "QUOTA_EXHAUSTED"
      }, { status: 402 });
    }

    // 3. Forward to n8n Hybrid Backend
    // This sends the message to n8n to handle RAG, AI Agent, and Database Saving.
    const n8nWebhookUrl = process.env.N8N_WEB_WEBHOOK_URL;
    
    if (!n8nWebhookUrl) {
      console.error("[CHAT] N8N_WEBHOOK_URL not set in .env");
      return NextResponse.json({ error: "Backend configuration error" }, { status: 500 });
    }

    const response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatInput: message,
        sessionId: normalizedSessionId,
        chatbotId: chatbotId,
        userId: userId,
        platform: "web_test",
        secret: process.env.N8N_CALLBACK_SECRET // For verification
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[CHAT_N8N_ERROR]", errorText);
      return NextResponse.json({ error: "Failed to get response from AI Agent" }, { status: 502 });
    }

    const data = await response.json();
    console.log('Data from n8n:', JSON.stringify(data, null, 2));
    
    // Robust extraction based on your n8n screenshot
    let reply = "";
    if (Array.isArray(data) && data.length > 0) {
      reply = data[0].output || data[0].reply || data[0].text || "";
    } else if (data && typeof data === 'object') {
      reply = data.output || data.reply || data.text || "";
    }

    if (!reply && typeof data === 'string') {
      reply = data;
    }

    return NextResponse.json({ reply });

  } catch (error) {
    console.error("[CHAT_PROXY_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
