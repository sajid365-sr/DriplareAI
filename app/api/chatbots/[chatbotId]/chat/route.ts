import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { resolveReplyCredits } from "@/lib/ai/credit-resolver";
import { resolveModelForPlan } from "@/lib/ai/chat-models";
import { toDeniedResponse } from "@/lib/ai/plan-model-access";
import type { Region } from "@/lib/core/region";
import { compilePrompt } from "@/lib/ai/prompt-assembler";
import { chargeUsage } from "@/lib/ai/charge-usage";

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

    // 2. Resolve the effective OpenRouter model, then verify it against the
    //    user's plan before a single token is spent.
    //
    // ⚠️ ক্রমটা গুরুত্বপূর্ণ: `user` আগে পড়তে হয়, কারণ plan ছাড়া যাচাই চলে না।
    //    আগে এই row-টা কেবল credit-এর জন্য পড়া হত, আর `plan` ফিল্ডটা তুলে
    //    আনা হয়েও কোথাও ব্যবহার হত না — অর্থাৎ plan-এর কোনো ভূমিকাই ছিল না।
    const user = await db.user.findUnique({
      where: { userId },
      select: { creditsBalance: true, plan: true, region: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const resolved = await resolveModelForPlan(
      bot.promptMode,
      bot.model,
      user.plan,
      (user.region || "bd") as Region
    );

    // এখানেই সেই জায়গা যেখানে আগে চুপচাপ Fast-এ নেমে যাওয়া হত। এখন না —
    // Starter plan-এর user-কে Pro মোড দেওয়া হয় না, স্পষ্ট জানানো হয়।
    //
    // ⚠️ এটাই আসল প্রয়োগ-বিন্দু: chatbot সেভ করার গার্ড কেবল তখনই খাটে যখন
    //    কেউ সেভ করেন। কিন্তু plan পরে নেমে গেলে (downgrade, বা admin-এর হাতে
    //    plan বদল) DB-তে `promptMode: "pro"` পড়ে থাকতে পারে — আর তখন থামানোর
    //    একমাত্র জায়গা এই রুট, কারণ n8n-এর আসল উত্তর এখান থেকেই যায়।
    const denied = toDeniedResponse(resolved);
    if (denied) return denied;

    const model = resolved.config.modelId;

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

    // 4. Credit Check — dashboard test chat → admin-নির্ধারিত গুণক প্রয়োগ হবে
    // ⚠️ এই মান আর এখানে হিসাব করা হয় না; `credit-resolver.ts` থেকে আসে,
    //    তাই আসল deduction-এর সাথে সবসময় মিলবে।
    const creditsRequired = (await resolveReplyCredits(model, { isTestChat: true })).credits;

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
        creditCost:   resolved.config.credits,
        temperature:  bot.temperature,
        topP:         bot.topP,
        maxTokens:    bot.maxTokens,
        chatInput:    message,
        userId:       userId,
        platform:     "playground",
        channel:      "playground",
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

    // n8n-এর উত্তর array বা object — দুইভাবেই আসতে পারে, তাই একটাই payload বানাই
    const payload: Record<string, unknown> =
      Array.isArray(data) && data.length > 0
        ? ((data[0] as Record<string, unknown>) ?? {})
        : typeof data === "object"
          ? (data as Record<string, unknown>)
          : {};

    let reply = String(
      payload.replyText || payload.output || payload.reply || payload.text || "",
    );
    if (!reply && typeof data === "string") {
      reply = data;
    }

    // 6. Billing — Playground-এর credit এখানেই কাটা হয়।
    //
    // কেন এখানে, n8n-এর callback-এ নয়: n8n আছে itnut VPS-এ, সে ডেভেলপারের
    // localhost:3000-এ কখনোই পৌঁছাতে পারে না — তাই লোকাল টেস্টে callback দিয়ে
    // credit কাটা অসম্ভব ছিল। অথচ কলটা তো প্ল্যাটফর্মই করেছিল, আর n8n উত্তরে
    // token ফেরতও দেয় — তাই কাটার দায়িত্বও প্ল্যাটফর্মেরই।
    //
    // Facebook / WhatsApp / Instagram-এ প্ল্যাটফর্ম পথে থাকে না, তাই সেখানে
    // n8n নিজেই `POST /api/internal/ai-usage`-এ ফিরে এসে কাটে। দুটো পথ একসাথে
    // চললেও **দ্বিগুণ কাটে না** — n8n সফল হলে সে উত্তরে `billingOk: true` পাঠায়।
    if (payload.billingOk !== true) {
      try {
        const charge = await chargeUsage({
          userId,
          chatbotId: bot.chatbotId,
          sessionId: normalizedSessionId,
          channel: "playground",
          modelId: model,
          promptTokens: Number(payload.promptTokens) || 0,
          completionTokens: Number(payload.completionTokens) || 0,
          llmCallCount: 1,
          isTestChat: true,
          isFreeMessage: false,
          tokensAreExact: payload.tokensAreExact === true,
        });

        if (charge.kind === "insufficient") {
          // উপরের চেকে ধরা পড়ার কথা; তবুও এলে চুপচাপ থামি না।
          console.warn("[CHAT_BILLING] ব্যালেন্স যথেষ্ট নয়, credit কাটা হয়নি", {
            chatbotId,
            creditsRequired: charge.creditsRequired,
          });
        }
      } catch (err) {
        // বিলিং ব্যর্থ হলেও গ্রাহকের উত্তর আটকাবে না — খরচটা Step 7-এর
        // reconciler পরে ধরে ফেলবে।
        console.error("[CHAT_BILLING_ERROR]", err);
      }
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[CHAT_PROXY_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
